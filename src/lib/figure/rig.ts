/**
 * Skelett der Übungsfigur: Vorwärtskinematik (Winkel) und 2-Knochen-IK
 * (Zielpunkt) in einem leichten 3D-Modell, das für die Seiten- bzw.
 * Frontansicht projiziert wird. Segmentlängen sind Konstanten — jede Pose
 * (auch interpolierte) erfüllt sie exakt.
 */
import type { AngleLimb, FigureDef, LimbSpec, PoseSpec, TargetLimb, TimelineKey, Vec2 } from './types'

export const VIEW_W = 400
export const VIEW_H = 300
export const FLOOR = 262

/** Segmentlängen (Figur ca. 215 px groß). */
export const LEN = {
  lowerTorso: 30,
  upperTorso: 36,
  neck: 7,
  headR: 13,
  upperArm: 42,
  forearm: 40,
  thigh: 56,
  shin: 52,
  foot: 22,
  /** Halbe Schulter-/Hüftbreite (nur für z/Frontansicht). */
  shoulderHalf: 19,
  hipHalf: 10,
} as const

/** Knöchelhöhe über dem Boden, wenn der Fuß flach steht. */
export const ANKLE_H = 7.5
/** Hüfthöhe im aufrechten Stand. */
export const STAND_HIP_Y = FLOOR - ANKLE_H - LEN.shin - LEN.thigh

export type Vec3 = [number, number, number]

const RAD = Math.PI / 180
export const rad = (d: number) => d * RAD

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: Vec3): Vec3 => {
  const l = len3(a)
  return l > 1e-9 ? mul(a, 1 / l) : [1, 0, 0]
}
export const dist3 = (a: Vec3, b: Vec3) => len3(sub(a, b))

/** Richtungsvektor aus Sagittalwinkel + Abspreizung (s = +1 nahe, −1 ferne Seite). */
export function dir3(a: number, out = 0, s = 1): Vec3 {
  const co = Math.cos(rad(out))
  return [co * Math.cos(rad(a)), co * Math.sin(rad(a)), s * Math.sin(rad(out))]
}

export function isTarget(l: LimbSpec): l is TargetLimb {
  return (l as TargetLimb).to !== undefined
}

export interface LimbJoints {
  root: Vec3
  mid: Vec3
  end: Vec3
}

export interface Skeleton {
  hip: Vec3
  waist: Vec3
  spineTop: Vec3
  /** Schultermitte (Gelenkhöhe). */
  shoulderC: Vec3
  headC: Vec3
  /** Winkel des unteren/oberen Rumpfabschnitts und des Kopfes (Grad). */
  torsoA: number
  upperA: number
  headA: number
  armNear: LimbJoints
  armFar: LimbJoints
  legNear: LimbJoints
  legFar: LimbJoints
  /** Zehenrichtung (Grad, Sagittalebene). */
  footNear: number
  footFar: number
}

/** 2-Knochen-IK im Raum: Ellbogen/Knie auf dem Kreis, Richtung über den Pol-Vektor. */
export function solveTwoBone(root: Vec3, target: Vec3, l1: number, l2: number, pole: Vec3): { mid: Vec3; end: Vec3 } {
  let d = dist3(root, target)
  const u = norm(sub(target, root))
  const maxD = l1 + l2 - 1e-6
  const minD = Math.abs(l1 - l2) + 1e-6
  if (d > maxD) d = maxD
  if (d < minD) d = minD
  const end = add(root, mul(u, d))
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  // Pol-Vektor senkrecht zur Achse
  let v = sub(pole, mul(u, dot(pole, u)))
  if (len3(v) < 1e-6) v = sub([0, 1, 0], mul(u, u[1]))
  if (len3(v) < 1e-6) v = [1, 0, 0]
  v = norm(v)
  const mid = add(add(root, mul(u, a)), mul(v, h))
  return { mid, end }
}

function solveLimb(
  spec: LimbSpec,
  root: Vec3,
  l1: number,
  l2: number,
  s: number,
  defaultPole: number,
): LimbJoints {
  if (isTarget(spec)) {
    const tz = spec.zw !== undefined ? spec.zw : spec.z !== undefined ? s * spec.z : root[2]
    const target: Vec3 = [spec.to[0], spec.to[1], tz]
    const p = dir3(spec.pole ?? defaultPole, spec.splay ?? 0, s)
    const { mid, end } = solveTwoBone(root, target, l1, l2, p)
    return { root, mid, end }
  }
  const a = spec as AngleLimb
  const out = a.out ?? [0, 0]
  const mid = add(root, mul(dir3(a.a[0], out[0], s), l1))
  const end = add(mid, mul(dir3(a.a[1], out[1], s), l2))
  return { root, mid, end }
}

/** Sagittalwinkel eines Segments (für Fuß/Hand). */
function angle2(a: Vec3, b: Vec3): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD
}

export function solvePose(p: PoseSpec): Skeleton {
  const hip: Vec3 = [p.hip[0], p.hip[1], 0]
  const torsoA = p.torso
  const upperA = p.torso + (p.bend ?? 0)
  const headA = upperA + (p.head ?? 0)
  const waist = add(hip, mul(dir3(torsoA), LEN.lowerTorso))
  const spineTop = add(waist, mul(dir3(upperA), LEN.upperTorso))
  const shoulderC = add(spineTop, mul(dir3(upperA), -5))
  const neckBase = add(spineTop, mul(dir3(upperA), 2))
  const headC = add(neckBase, mul(dir3(headA), LEN.neck + LEN.headR - 2))

  // Schulterlinie: z-Achse, gedreht um die Rumpfachse (twist) Richtung Brust.
  const tw = rad(p.twist ?? 0)
  const chestN = dir3(upperA + 90)
  const shoulderOff: Vec3 = add(mul([0, 0, 1], Math.cos(tw) * LEN.shoulderHalf), mul(chestN, Math.sin(tw) * LEN.shoulderHalf))
  const shNear = add(shoulderC, shoulderOff)
  const shFar = sub(shoulderC, shoulderOff)
  const hipNear = add(hip, [0, 0, LEN.hipHalf])
  const hipFar = add(hip, [0, 0, -LEN.hipHalf])

  const armPole = upperA + 210
  const legPole = torsoA + 80
  const armNear = solveLimb(p.arm, shNear, LEN.upperArm, LEN.forearm, 1, armPole)
  const armFar = solveLimb(p.armFar ?? p.arm, shFar, LEN.upperArm, LEN.forearm, -1, armPole)
  const legNearSpec = p.leg
  const legFarSpec = p.legFar ?? p.leg
  const legNear = solveLimb(legNearSpec, hipNear, LEN.thigh, LEN.shin, 1, legPole)
  const legFar = solveLimb(legFarSpec, hipFar, LEN.thigh, LEN.shin, -1, legPole)

  const footDefault = (spec: LimbSpec, j: LimbJoints) => (isTarget(spec) ? 0 : angle2(j.mid, j.end) - 90)
  const footNear = p.foot ?? footDefault(legNearSpec, legNear)
  const footFar = p.footFar ?? p.foot ?? footDefault(legFarSpec, legFar)

  return { hip, waist, spineTop, shoulderC, headC, torsoA, upperA, headA, armNear, armFar, legNear, legFar, footNear, footFar }
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpV = (a: Vec2, b: Vec2, t: number): Vec2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
const lerpOpt = (a: number | undefined, b: number | undefined, t: number, d = 0) =>
  a === undefined && b === undefined ? undefined : lerp(a ?? d, b ?? d, t)

export function lerpLimb(a: LimbSpec, b: LimbSpec, t: number): LimbSpec {
  if (isTarget(a) && isTarget(b)) {
    return {
      to: lerpV(a.to, b.to, t),
      z: lerpOpt(a.z, b.z, t),
      zw: lerpOpt(a.zw, b.zw, t),
      pole: lerpOpt(a.pole, b.pole, t),
      splay: lerpOpt(a.splay, b.splay, t),
    }
  }
  if (!isTarget(a) && !isTarget(b)) {
    return { a: lerpV(a.a, b.a, t), out: a.out || b.out ? lerpV(a.out ?? [0, 0], b.out ?? [0, 0], t) : undefined }
  }
  // Gemischte Arten: nicht interpolierbar → Umschalten in der Mitte (vom Test ausgeschlossen).
  return t < 0.5 ? a : b
}

export function lerpPose(a: PoseSpec, b: PoseSpec, t: number): PoseSpec {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    bend: lerpOpt(a.bend, b.bend, t),
    twist: lerpOpt(a.twist, b.twist, t),
    head: lerpOpt(a.head, b.head, t),
    arm: lerpLimb(a.arm, b.arm, t),
    armFar: a.armFar || b.armFar ? lerpLimb(a.armFar ?? a.arm, b.armFar ?? b.arm, t) : undefined,
    leg: lerpLimb(a.leg, b.leg, t),
    legFar: a.legFar || b.legFar ? lerpLimb(a.legFar ?? a.leg, b.legFar ?? b.leg, t) : undefined,
    foot: lerpOpt(a.foot, b.foot, t),
    footFar: a.footFar !== undefined || b.footFar !== undefined ? lerp(a.footFar ?? a.foot ?? 0, b.footFar ?? b.foot ?? 0, t) : undefined,
  }
}

// ---------------------------------------------------------------------------
// Zeitachse
// ---------------------------------------------------------------------------

/** cubic-bezier(.45,0,.35,1) — gleiche Kurve wie im Prototyp. */
export function ease(x: number): number {
  const x1 = 0.45, y1 = 0, x2 = 0.35, y2 = 1
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
  let lo = 0, hi = 1, t = x
  for (let i = 0; i < 24; i++) {
    t = (lo + hi) / 2
    if (bx(t) < x) lo = t
    else hi = t
  }
  return by(t)
}

export interface Frame {
  pose: PoseSpec
  /** Muskelspannung 0..1 (konzentrische Phase → hoch). */
  intensity: number
}

function keyAt(tl: TimelineKey[], t: number): number {
  for (let i = 0; i < tl.length - 1; i++) if (t <= tl[i + 1].at) return i
  return tl.length - 2
}

/** Pose und Spannung zum Zeitpunkt t (0..1) des Zyklus. */
export function sampleFigure(def: FigureDef, t: number): Frame {
  const tl = def.timeline
  t = ((t % 1) + 1) % 1
  const i = keyAt(tl, t)
  const k0 = tl[i]
  const k1 = tl[i + 1]
  const span = k1.at - k0.at
  const s = span > 0 ? Math.min(1, Math.max(0, (t - k0.at) / span)) : 1
  const a = def.poses[k0.pose]
  const b = def.poses[k1.pose]
  const pose = k0.pose === k1.pose ? a : lerpPose(a, b, ease(s))
  const rest = (k: TimelineKey) => (k.c ? 0.55 : 0.25)
  let intensity: number
  if (k0.pose === k1.pose) intensity = lerp(rest(k0), rest(k0), s)
  else if (k1.c) intensity = lerp(rest(k0), rest(k1), s) + 0.6 * Math.sin(Math.PI * Math.min(1, s * 1.1))
  else intensity = lerp(rest(k0), rest(k1), s)
  return { pose, intensity: Math.max(0, Math.min(1, intensity)) }
}

/** Standbild-Pose (für reduzierte Bewegung / Thumbnails). */
export function peakFrame(def: FigureDef): Frame {
  const name = def.peak ?? def.timeline.find((k) => k.pose !== def.timeline[0].pose)?.pose ?? def.timeline[0].pose
  return { pose: def.poses[name], intensity: 0.8 }
}

/** Standard-Zyklus: A halten · A→B · B halten · B→A · A halten. */
export function cycle(a: string, b: string, concentric: 'ab' | 'ba', holds: [number, number] = [0.08, 0.1]): TimelineKey[] {
  const [h0, h1] = holds
  const mid1 = 0.5 - h1 / 2
  const mid2 = 0.5 + h1 / 2
  return [
    { at: 0, pose: a },
    { at: h0, pose: a },
    { at: mid1, pose: b, c: concentric === 'ab' },
    { at: mid2, pose: b },
    { at: 1 - h0, pose: a, c: concentric === 'ba' },
    { at: 1, pose: a },
  ]
}

/** Gleichmäßiger Wechsel ohne Pausen (Cardio): A → B → A. */
export function swing(a: string, b: string, concentric: 'ab' | 'ba' | 'both' = 'both'): TimelineKey[] {
  return [
    { at: 0, pose: a },
    { at: 0.5, pose: b, c: concentric !== 'ba' },
    { at: 1, pose: a, c: concentric !== 'ab' },
  ]
}

/** Hüfte so setzen, dass ein gestrecktes/gebeugtes Bein mit gegebenen Winkeln am Knöchel `ankle` endet. */
export function hipFromAnkle(ankle: Vec2, thighA: number, shinA: number): Vec2 {
  return [
    ankle[0] - Math.cos(rad(thighA)) * LEN.thigh - Math.cos(rad(shinA)) * LEN.shin,
    ankle[1] - Math.sin(rad(thighA)) * LEN.thigh - Math.sin(rad(shinA)) * LEN.shin,
  ]
}

/** Schultermitte zu Hüfte/Rumpf (für Zielpunkte relativ zur Schulter beim Autorieren). */
export function shoulderOf(hip: Vec2, torso: number, bend = 0): Vec2 {
  const u = torso + bend
  return [
    hip[0] + Math.cos(rad(torso)) * LEN.lowerTorso + Math.cos(rad(u)) * (LEN.upperTorso - 5),
    hip[1] + Math.sin(rad(torso)) * LEN.lowerTorso + Math.sin(rad(u)) * (LEN.upperTorso - 5),
  ]
}
