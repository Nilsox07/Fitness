/**
 * Zeichnet eine Übungsfigur als SVG-Markup (String). Reine Funktion — wird
 * vom React-Component pro Frame in ein <g> geschrieben (kein React-Render pro
 * Frame) und ist so auch ohne DOM testbar.
 *
 * Farben kommen ausschließlich aus CSS-Variablen (--xf-*), die das Component
 * aus den App-Tokens ableitet (hell/dunkel).
 */
import { FLOOR, LEN, solvePose, type Frame, type LimbJoints, type Skeleton, type Vec3 } from './rig'
import type { FigureDef, MuscleRegion, PropLayer, PropSpec, Vec2 } from './types'

const C = {
  skin: 'var(--xf-skin)',
  skinFar: 'var(--xf-skin-far)',
  hair: 'var(--xf-hair)',
  equip: 'var(--xf-equip)',
  frame: 'var(--xf-frame)',
  metal: 'var(--xf-metal)',
  line: 'var(--xf-line)',
  floor: 'var(--xf-floor)',
  shadow: 'var(--xf-shadow)',
  glow: 'var(--xf-glow)',
  band: 'var(--xf-band)',
}

const f = (n: number) => (Math.round(n * 10) / 10).toString()
type P2 = [number, number]

// ---------------------------------------------------------------------------
// Primitive
// ---------------------------------------------------------------------------

function line(a: P2, b: P2, w: number, color: string, extra = ''): string {
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round"${extra}/>`
}
function circle(c: P2, r: number, fill: string, extra = ''): string {
  return `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="${fill}"${extra}/>`
}
function rect(x: number, y: number, w: number, h: number, rx: number, fill: string, extra = ''): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="${fill}"${extra}/>`
}

/** Konisch zulaufende Kapsel von a (Radius r1) nach b (Radius r2). */
function capsule(a: P2, b: P2, r1: number, r2: number, fill: string): string {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy)
  if (l < 0.5) return circle(a, Math.max(r1, r2), fill)
  const nx = -dy / l
  const ny = dx / l
  const p1: P2 = [a[0] + nx * r1, a[1] + ny * r1]
  const p2: P2 = [b[0] + nx * r2, b[1] + ny * r2]
  const p3: P2 = [b[0] - nx * r2, b[1] - ny * r2]
  const p4: P2 = [a[0] - nx * r1, a[1] - ny * r1]
  return (
    `<path d="M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${f(r2)} ${f(r2)} 0 0 0 ${f(p3[0])} ${f(p3[1])}` +
    `L${f(p4[0])} ${f(p4[1])}A${f(r1)} ${f(r1)} 0 0 0 ${f(p1[0])} ${f(p1[1])}Z" fill="${fill}"/>`
  )
}

/** Geschlossener, weicher Pfad (Catmull-Rom → Bézier). */
function smoothClosed(pts: P2[], fill: string): string {
  const n = pts.length
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1: P2 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: P2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return `<path d="${d}Z" fill="${fill}"/>`
}

const vadd = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k]
const vlerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const unit = (a: P2, b: P2): P2 => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return l > 1e-6 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0]
}
const rotP = (v: P2, deg: number): P2 => {
  const r = (deg * Math.PI) / 180
  return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)]
}
const fromAngle = (deg: number): P2 => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]

// ---------------------------------------------------------------------------
// Projektion
// ---------------------------------------------------------------------------

type Proj = (v: Vec3) => P2

function projector(def: FigureDef, hipX: number): Proj {
  // Frontansicht: x (Tiefe) entfällt, die Hüfte bestimmt die Bildmitte.
  if (def.view === 'front') return (v) => [hipX + v[2], v[1]]
  return (v) => [v[0], v[1]]
}

interface Limb2 {
  root: P2
  mid: P2
  end: P2
}
interface Sk2 {
  sk: Skeleton
  P: Proj
  front: boolean
  hip: P2
  waist: P2
  top: P2
  shoulderC: P2
  headC: P2
  armNear: Limb2
  armFar: Limb2
  legNear: Limb2
  legFar: Limb2
}

function proj(sk: Skeleton, P: Proj, front: boolean): Sk2 {
  const L = (j: LimbJoints): Limb2 => ({ root: P(j.root), mid: P(j.mid), end: P(j.end) })
  return {
    sk,
    P,
    front,
    hip: P(sk.hip),
    waist: P(sk.waist),
    top: P(sk.spineTop),
    shoulderC: P(sk.shoulderC),
    headC: P(sk.headC),
    armNear: L(sk.armNear),
    armFar: L(sk.armFar),
    legNear: L(sk.legNear),
    legFar: L(sk.legFar),
  }
}

// ---------------------------------------------------------------------------
// Körperteile
// ---------------------------------------------------------------------------

const R = {
  uarm: [8, 6.4],
  farm: [6.2, 4.9],
  hand: 6.3,
  thigh: [11.5, 8.4],
  shin: [8.2, 5.6],
  neck: 5.6,
}

function drawArm(l: Limb2, color: string): string {
  return capsule(l.root, l.mid, R.uarm[0], R.uarm[1], color) + capsule(l.mid, l.end, R.farm[0], R.farm[1], color)
}
function drawHand(l: Limb2, color: string): string {
  return circle(l.end, R.hand, color)
}

function footPoints(s: Sk2, l: Limb2, footA: number): { heel: P2; toe: P2 } {
  if (s.front) {
    // Frontansicht: Fuß zeigt zur Kamera → kurzer Stummel nach unten/außen.
    const side = l.end[0] >= s.hip[0] ? 1 : -1
    return { heel: vadd(l.end, [0, 3]), toe: vadd(l.end, [side * 5, 5]) }
  }
  const d = fromAngle(footA)
  const sole: P2 = [-d[1], d[0]]
  const base = vadd(l.end, sole, 3)
  return { heel: vadd(base, d, -4), toe: vadd(base, d, LEN.foot - 4) }
}

function drawLeg(s: Sk2, l: Limb2, footA: number, color: string): string {
  const { heel, toe } = footPoints(s, l, footA)
  return (
    capsule(l.root, l.mid, R.thigh[0], R.thigh[1], color) +
    capsule(heel, toe, 4.6, 3.6, color) +
    capsule(l.mid, l.end, R.shin[0], R.shin[1], color)
  )
}

function torsoPoints(s: Sk2): P2[] {
  if (s.front) {
    const spine = unit(s.hip, s.top)
    const lat: P2 = [-spine[1], spine[0]]
    const sn = s.P(s.sk.armNear.root)
    const sf = s.P(s.sk.armFar.root)
    const w = Math.max(10, Math.abs(sn[0] - sf[0]) / 2)
    const chest = vlerp(s.waist, s.top, 0.45)
    const st = [
      { c: vadd(s.hip, spine, -7), hw: 15 },
      { c: s.hip, hw: 17 },
      { c: s.waist, hw: 14 },
      { c: chest, hw: Math.min(19, w + 1) },
      { c: vadd(s.top, spine, -5), hw: w + 4 },
      { c: s.top, hw: w - 2 },
    ]
    const right = st.map((p) => vadd(p.c, lat, p.hw))
    const left = st.map((p) => vadd(p.c, lat, -p.hw)).reverse()
    return [...right, ...left]
  }
  const dl = unit(s.hip, s.waist)
  const du = unit(s.waist, s.top)
  const nl: P2 = [-dl[1], dl[0]]
  const nu: P2 = [-du[1], du[0]]
  const st: { c: P2; n: P2; fr: number; bk: number }[] = [
    { c: vadd(s.hip, dl, -7), n: nl, fr: 11, bk: 12 },
    { c: vadd(s.hip, dl, 5), n: nl, fr: 12.5, bk: 15 },
    { c: s.waist, n: [(nl[0] + nu[0]) / 2, (nl[1] + nu[1]) / 2], fr: 12, bk: 11.5 },
    { c: vadd(s.waist, du, 15), n: nu, fr: 16, bk: 12.5 },
    { c: vadd(s.top, du, -6), n: nu, fr: 13, bk: 12.5 },
    { c: vadd(s.top, du, 1), n: nu, fr: 7, bk: 9 },
  ]
  const frontSide = st.map((p) => vadd(p.c, p.n, p.fr))
  const back = st.map((p) => vadd(p.c, p.n, -p.bk)).reverse()
  return [...frontSide, ...back]
}

function drawHead(s: Sk2): string {
  const neckEnd = vlerp(s.top, s.headC, 0.55)
  let out = capsule(s.top, neckEnd, R.neck, R.neck - 0.4, C.skin)
  out += circle(s.headC, LEN.headR, C.skin)
  if (s.front) {
    const up = unit(s.headC, s.top)
    const ang = (Math.atan2(-up[1], -up[0]) * 180) / Math.PI
    out += arcStroke(s.headC, LEN.headR - 3, ang - 70, ang + 70, 7, C.hair)
  } else {
    const ha = s.sk.headA
    // Haarkappe über Oberkopf und Hinterkopf (zeigt die Blickrichtung).
    out += arcStroke(s.headC, LEN.headR - 3, ha - 115, ha + 35, 7, C.hair)
    // kleine Nase/Kinn-Andeutung
    out += circle(vadd(s.headC, rotP(fromAngle(ha), 98), LEN.headR - 0.5), 2.6, C.skin)
  }
  return out
}

function arcStroke(c: P2, r: number, a0: number, a1: number, w: number, color: string): string {
  const p0 = vadd(c, fromAngle(a0), r)
  const p1 = vadd(c, fromAngle(a1), r)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `<path d="M${f(p0[0])} ${f(p0[1])}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(p1[0])} ${f(p1[1])}" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round"/>`
}

// ---------------------------------------------------------------------------
// Muskel-Leuchten
// ---------------------------------------------------------------------------

type SegKey = 'lower' | 'upper' | 'uarm' | 'farm' | 'thigh' | 'shin'
interface Stroke {
  seg: SegKey
  u: [number, number]
  v: number
  w: number
  /** Frontansicht: zusätzlich gespiegelt (−v) zeichnen. */
  sym?: boolean
}

const SIDE: Record<MuscleRegion, Stroke[]> = {
  chest: [{ seg: 'upper', u: [0.28, 0.66], v: 9.5, w: 11 }],
  abs: [
    { seg: 'lower', u: [0.1, 1], v: 8, w: 7.5 },
    { seg: 'upper', u: [0, 0.18], v: 9, w: 7.5 },
  ],
  obliques: [{ seg: 'lower', u: [0.15, 0.95], v: 1.5, w: 9 }],
  lowerBack: [{ seg: 'lower', u: [0.25, 1.02], v: -7.5, w: 7 }],
  lats: [{ seg: 'upper', u: [0.06, 0.62], v: -6.5, w: 10 }],
  traps: [{ seg: 'upper', u: [0.8, 1.08], v: -5.5, w: 8 }],
  glutes: [{ seg: 'thigh', u: [-0.06, 0.2], v: -6, w: 13 }],
  frontDelt: [{ seg: 'uarm', u: [0.04, 0.2], v: 2.6, w: 10.5 }],
  sideDelt: [{ seg: 'uarm', u: [0.03, 0.2], v: 0, w: 12.5 }],
  rearDelt: [{ seg: 'uarm', u: [0.04, 0.2], v: -2.6, w: 10.5 }],
  biceps: [{ seg: 'uarm', u: [0.32, 0.78], v: 3, w: 7 }],
  triceps: [{ seg: 'uarm', u: [0.28, 0.8], v: -3, w: 7 }],
  forearms: [{ seg: 'farm', u: [0.1, 0.5], v: 0.5, w: 7 }],
  quads: [{ seg: 'thigh', u: [0.16, 0.82], v: 3.5, w: 10 }],
  hamstrings: [{ seg: 'thigh', u: [0.2, 0.85], v: -4, w: 8 }],
  adductors: [{ seg: 'thigh', u: [0.08, 0.42], v: 0, w: 7 }],
  calves: [{ seg: 'shin', u: [0.1, 0.48], v: -2.4, w: 8.5 }],
}

const FRONT: Record<MuscleRegion, Stroke[]> = {
  chest: [{ seg: 'upper', u: [0.38, 0.7], v: 8, w: 11, sym: true }],
  abs: [{ seg: 'lower', u: [0.05, 1.3], v: 0, w: 9 }],
  obliques: [{ seg: 'lower', u: [0.15, 0.95], v: 11, w: 6, sym: true }],
  lowerBack: [],
  lats: [{ seg: 'upper', u: [0.1, 0.6], v: 14, w: 6, sym: true }],
  traps: [{ seg: 'upper', u: [0.95, 1.12], v: 9, w: 7, sym: true }],
  glutes: [{ seg: 'thigh', u: [-0.05, 0.15], v: 0, w: 11 }],
  frontDelt: [{ seg: 'uarm', u: [0.02, 0.18], v: 0, w: 11 }],
  sideDelt: [{ seg: 'uarm', u: [0.02, 0.2], v: 0, w: 13 }],
  rearDelt: [{ seg: 'uarm', u: [0.02, 0.18], v: 0, w: 10 }],
  biceps: [{ seg: 'uarm', u: [0.32, 0.78], v: 0, w: 7 }],
  triceps: [{ seg: 'uarm', u: [0.3, 0.8], v: 0, w: 6 }],
  forearms: [{ seg: 'farm', u: [0.1, 0.5], v: 0, w: 6 }],
  quads: [{ seg: 'thigh', u: [0.15, 0.82], v: 0, w: 10 }],
  hamstrings: [{ seg: 'thigh', u: [0.2, 0.8], v: 0, w: 7 }],
  adductors: [{ seg: 'thigh', u: [0.08, 0.45], v: 0, w: 7 }],
  calves: [{ seg: 'shin', u: [0.12, 0.5], v: 0, w: 8 }],
}

function segPoints(s: Sk2, key: SegKey, far: boolean): [P2, P2, number] | null {
  // Rückgabe: Start, Ende, Normalen-Vorzeichen (Rumpf +90°, Gliedmaßen −90°)
  const arm = far ? s.armFar : s.armNear
  const leg = far ? s.legFar : s.legNear
  switch (key) {
    case 'lower':
      return [s.hip, s.waist, 1]
    case 'upper':
      return [s.waist, s.top, 1]
    case 'uarm':
      return [arm.root, arm.mid, -1]
    case 'farm':
      return [arm.mid, arm.end, -1]
    case 'thigh':
      return [leg.root, leg.mid, -1]
    case 'shin':
      return [leg.mid, leg.end, -1]
  }
}

function glowStroke(s: Sk2, st: Stroke, far: boolean, opacity: number, halo: number): string {
  const sp = segPoints(s, st.seg, far)
  if (!sp) return ''
  const [a, b, sign] = sp
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 4) return ''
  const d = unit(a, b)
  const n: P2 = sign > 0 ? [-d[1], d[0]] : [d[1], -d[0]]
  const variants = st.sym ? [st.v, -st.v] : [st.v]
  let out = ''
  for (const v of variants) {
    const p0 = vadd(vlerp(a, b, st.u[0]), n, v)
    const p1 = vadd(vlerp(a, b, st.u[1]), n, v)
    if (halo > 0) out += line(p0, p1, st.w + 7, C.glow, ` opacity="${f(halo)}"`)
    out += line(p0, p1, st.w, C.glow, ` opacity="${f(opacity)}"`)
  }
  return out
}

const LIMB_SEGS: SegKey[] = ['uarm', 'farm', 'thigh', 'shin']
const ARM_SEGS: SegKey[] = ['uarm', 'farm']

interface GlowSet {
  primary: MuscleRegion[]
  secondary: MuscleRegion[]
}

function glows(s: Sk2, set: GlowSet, part: 'torso' | 'arm' | 'leg', far: boolean, intensity: number): string {
  const table = s.front ? FRONT : SIDE
  const pOp = 0.42 + 0.55 * intensity
  const sOp = 0.2 + 0.28 * intensity
  const farK = far && !s.front ? 0.7 : 1
  let out = ''
  const emit = (regions: MuscleRegion[], op: number, halo: number) => {
    for (const r of regions) {
      for (const st of table[r]) {
        const isLimb = LIMB_SEGS.includes(st.seg)
        const isArm = ARM_SEGS.includes(st.seg)
        if (part === 'torso' && isLimb) continue
        if (part === 'arm' && !isArm) continue
        if (part === 'leg' && (!isLimb || isArm)) continue
        out += glowStroke(s, st, far, op * farK, halo * farK)
      }
    }
  }
  emit(set.secondary, sOp, 0)
  emit(set.primary, pOp, 0.12 + 0.22 * intensity)
  return out
}

// ---------------------------------------------------------------------------
// Geräte
// ---------------------------------------------------------------------------

type LayerOut = Record<PropLayer | 'nearGrip' | 'farGrip', string>

function grip(s: Sk2, which: 'near' | 'far' = 'near'): P2 {
  return which === 'near' ? s.armNear.end : s.armFar.end
}

function soleCenter(s: Sk2, far = false): P2 {
  const l = far ? s.legFar : s.legNear
  const { heel, toe } = footPoints(s, l, far ? s.sk.footFar : s.sk.footNear)
  return vlerp(heel, toe, 0.5)
}

function drawProps(def: FigureDef, s: Sk2): LayerOut {
  const o: LayerOut = { back: '', far: '', mid: '', front: '', nearGrip: '', farGrip: '' }
  for (const p of def.props ?? []) drawProp(p, s, o)
  return o
}

function drawProp(p: PropSpec, s: Sk2, o: LayerOut) {
  switch (p.kind) {
    case 'bench': {
      const top = p.top ?? 200
      o.back +=
        line([p.x + 20, top + 10], [p.x + 20, FLOOR], 8, C.frame) +
        line([p.x + p.w - 20, top + 10], [p.x + p.w - 20, FLOOR], 8, C.frame) +
        line([p.x + 8, FLOOR - 1], [p.x + 32, FLOOR - 1], 6, C.frame) +
        line([p.x + p.w - 32, FLOOR - 1], [p.x + p.w - 8, FLOOR - 1], 6, C.frame) +
        rect(p.x, top, p.w, 16, 8, C.equip)
      break
    }
    case 'incline': {
      const top = p.top ?? 200
      const len = p.len ?? 112
      const hinge: P2 = [p.x, top + 8]
      const d = fromAngle(180 + p.angle)
      const end = vadd(hinge, d, len)
      o.back +=
        line([p.x + 4, top + 10], [p.x + 4, FLOOR], 8, C.frame) +
        line(vadd(hinge, d, len * 0.65), [vadd(hinge, d, len * 0.65)[0] + 6, FLOOR], 7, C.frame) +
        line([p.x - 14, FLOOR - 1], [p.x + 22, FLOOR - 1], 6, C.frame) +
        line(hinge, end, 16, C.equip) +
        line(hinge, [p.x + 46, top + 8], 16, C.equip)
      break
    }
    case 'rack': {
      o.back +=
        line([p.x, FLOOR], [p.x, p.y - 30], 7, C.frame) +
        line([p.x, p.y], [p.x - 14, p.y], 6, C.frame) +
        line([p.x - 14, p.y], [p.x - 14, p.y - 7], 5, C.frame)
      break
    }
    case 'barbell': {
      const g = grip(s, p.hand ?? 'near')
      const r = p.plate ?? 34
      o.back +=
        circle(g, r, C.equip, ' opacity=".95"') +
        `<circle cx="${f(g[0])}" cy="${f(g[1])}" r="${f(r * 0.78)}" fill="none" stroke="var(--xf-ring)" stroke-width="2"/>`
      o.nearGrip += circle(g, 4.8, C.metal)
      break
    }
    case 'dumbbell': {
      const db = (g: P2, l: Limb2) => {
        if (p.style !== 'hammer') return circle(g, 10.5, C.equip) + circle(g, 3.6, C.metal)
        // Neutralgriff: Hantelachse quer zum Unterarm, Scheiben oben/unten sichtbar.
        const d = unit(l.mid, l.end)
        const ax: P2 = [-d[1], d[0]]
        return line(vadd(g, ax, -12), vadd(g, ax, 12), 4, C.metal) + capsule(vadd(g, ax, -14), vadd(g, ax, -9), 7.5, 7.5, C.equip) + capsule(vadd(g, ax, 9), vadd(g, ax, 14), 7.5, 7.5, C.equip)
      }
      o.nearGrip += db(grip(s, 'near'), s.armNear)
      if (!p.one) o.farGrip += db(grip(s, 'far'), s.armFar)
      break
    }
    case 'kettlebell': {
      const g = grip(s, p.hand ?? 'near')
      const l = p.hand === 'far' ? s.armFar : s.armNear
      // Hängt nach unten — beim Swing in Verlängerung des Unterarms.
      const down: P2 = p.along ? unit(l.mid, l.end) : [0, 1]
      const ang = (Math.atan2(down[1], down[0]) * 180) / Math.PI - 90
      const c = vadd(g, down, 15)
      o.nearGrip +=
        `<g transform="rotate(${f(ang)} ${f(g[0])} ${f(g[1])})"><path d="M${f(g[0] - 7)} ${f(g[1] + 8)}Q${f(g[0] - 8)} ${f(g[1] - 5)} ${f(g[0])} ${f(g[1] - 5)}Q${f(g[0] + 8)} ${f(g[1] - 5)} ${f(g[0] + 7)} ${f(g[1] + 8)}" fill="none" stroke="${C.equip}" stroke-width="4" stroke-linecap="round"/>` +
        rect(g[0] - 8, g[1] + 23, 16, 5.5, 2.5, C.equip) +
        '</g>' +
        circle(c, 12.5, C.equip)
      break
    }
    case 'cable': {
      if (p.column !== undefined) {
        const topY = Math.min(p.from[1], p.stackTop ?? p.from[1]) - 14
        o.back +=
          line([p.column, FLOOR], [p.column, topY], 10, C.frame) +
          line([p.column, topY + 4], [p.from[0], p.from[1]], 6, C.frame) +
          rect(p.column - 11, FLOOR - 70, 22, 64, 4, C.equip, ' opacity=".9"')
      }
      o.back += circle(p.from, 7, C.equip) + circle(p.from, 2.5, C.metal)
      const hands: ('near' | 'far')[] = p.hand === 'both' ? ['far', 'near'] : [p.hand ?? 'near']
      for (const h of hands) {
        const g = grip(s, h)
        o[p.layer ?? 'mid'] += line(p.from, g, 2.2, C.line)
      }
      const g = grip(s, hands[hands.length - 1])
      if (p.handle === 'rope') o.nearGrip += line(vadd(g, [0, -5]), vadd(g, [0, 7]), 6, C.equip)
      else if (p.handle === 'handle') o.nearGrip += circle(g, 7.5, 'none', ` stroke="${C.equip}" stroke-width="3.5"`)
      else o.nearGrip += circle(g, 4.8, C.metal)
      break
    }
    case 'pullupBar': {
      const px = p.x + (p.post ?? 74)
      o.back +=
        line([px, FLOOR], [px, p.y - 10], 9, C.frame) +
        line([px, p.y - 6], [p.x, p.y], 6, C.frame) +
        circle([p.x, p.y], 6, C.equip)
      break
    }
    case 'dipBars': {
      o.back +=
        line([p.x1 + 12, p.y], [p.x1 + 6, FLOOR], 7, C.frame) +
        line([p.x2 - 12, p.y], [p.x2 - 6, FLOOR], 7, C.frame)
      o.mid += line([p.x1, p.y], [p.x2, p.y], 8, C.equip)
      break
    }
    case 'latMachine': {
      const g = grip(s, 'near')
      o.back +=
        line([p.x, FLOOR], [p.x, p.pulley[1] - 8], 10, C.frame) +
        line([p.x, p.pulley[1] - 4], p.pulley, 6, C.frame) +
        rect(p.x - 11, FLOOR - 70, 22, 64, 4, C.equip, ' opacity=".9"') +
        circle(p.pulley, 7, C.equip) +
        line([p.seat[0], p.seat[1] + 8], [p.seat[0], FLOOR], 8, C.frame) +
        line([p.seat[0] - 18, FLOOR - 1], [p.seat[0] + 18, FLOOR - 1], 6, C.frame) +
        rect(p.seat[0] - 26, p.seat[1], 52, 13, 6.5, C.equip) +
        line(p.pulley, g, 2.2, C.line)
      if (p.pad) o.front += line([p.pad[0] - 9, p.pad[1]], [p.pad[0] + 9, p.pad[1]], 13, C.equip) + line([p.pad[0], p.pad[1]], [p.x - 4, p.pad[1] + 8], 5, C.frame)
      o.nearGrip += line(vadd(g, [-6, 0]), vadd(g, [6, 0]), 6, C.equip)
      break
    }
    case 'legPress': {
      const tdir = fromAngle(p.angle)
      const sc = soleCenter(s)
      const sc2 = soleCenter(s, true)
      const c: P2 = vlerp(sc, sc2, 0.5)
      const n: P2 = [-tdir[1], tdir[0]]
      const plateC = vadd(c, tdir, 5)
      // Schiene (fest, entlang der Fahrtrichtung durch den Sitz)
      const railA = vadd(p.seat, tdir, 40)
      const railB = vadd(p.seat, tdir, 230)
      o.back +=
        line(vadd(railA, n, 30), vadd(railB, n, 30), 7, C.frame) +
        line([railB[0] + n[0] * 30, railB[1] + n[1] * 30], [railB[0] + n[0] * 30, FLOOR], 7, C.frame) +
        line([p.seat[0] - 10, p.seat[1] + 10], [p.seat[0] - 10, FLOOR], 8, C.frame) +
        line([p.seat[0] - 40, FLOOR - 1], [railB[0] + 20, FLOOR - 1], 6, C.frame) +
        line(p.seat, vadd(p.seat, [36, -4]), 15, C.equip) +
        line(vadd(p.seat, [-6, -4]), vadd(p.seat, fromAngle(180 + p.back), 80), 15, C.equip)
      o.front += line(vadd(plateC, n, -36), vadd(plateC, n, 36), 9, C.equip) + line(vadd(plateC, tdir, 6), vadd(plateC, tdir, 22), 6, C.equip)
      break
    }
    case 'legExtension': {
      const ank = s.legNear.end
      const shinD = unit(s.legNear.mid, s.legNear.end)
      const front: P2 = [shinD[1], -shinD[0]]
      const pad = vadd(vadd(ank, front, 10), shinD, -6)
      o.back +=
        line([p.seat[0] - 20, p.seat[1] + 8], [p.seat[0] - 20, FLOOR], 8, C.frame) +
        line([p.seat[0] - 56, FLOOR - 1], [p.seat[0] + 16, FLOOR - 1], 6, C.frame) +
        line([p.seat[0] - 48, p.seat[1] + 4], [p.seat[0] + 4, p.seat[1] + 4], 15, C.equip) +
        line([p.seat[0] - 54, p.seat[1] - 2], [p.seat[0] - 64, p.seat[1] - 82], 15, C.equip) +
        line(p.pivot, pad, 5, C.frame) +
        circle(p.pivot, 5, C.equip)
      o.front += circle(pad, 8.5, C.equip)
      break
    }
    case 'legCurl': {
      const ank = s.legNear.end
      const shinD = unit(s.legNear.mid, s.legNear.end)
      const back: P2 = [-shinD[1], shinD[0]]
      const pad = vadd(vadd(ank, back, 10), shinD, -4)
      o.back +=
        line([p.x + 24, p.top + 8], [p.x + 24, FLOOR], 8, C.frame) +
        line([p.x + p.w - 24, p.top + 8], [p.x + p.w - 24, FLOOR], 8, C.frame) +
        rect(p.x, p.top, p.w, 15, 7.5, C.equip) +
        line(p.pivot, pad, 5, C.frame) +
        circle(p.pivot, 5, C.equip)
      o.front += circle(pad, 8.5, C.equip)
      break
    }
    case 'mat': {
      o.back += rect(p.x, FLOOR - 4, p.w, 5, 2.5, C.frame)
      break
    }
    case 'box': {
      o.back += rect(p.x, FLOOR - p.h, p.w, p.h, 6, C.frame) + rect(p.x, FLOOR - p.h, p.w, 7, 3.5, C.equip, ' opacity=".55"')
      break
    }
    case 'band': {
      const from = p.foot ? soleCenter(s) : p.anchor ?? [s.hip[0], FLOOR]
      if (p.anchor) o.back += circle(p.anchor, 5, C.equip)
      o.mid += line(from, grip(s, 'near'), 4, C.band)
      break
    }
    case 'wall': {
      o.back += rect(p.x, 30, 14, FLOOR - 30, 4, C.frame)
      break
    }
    case 'seat': {
      o.back +=
        line([p.x + p.w / 2, p.top + 8], [p.x + p.w / 2, FLOOR], 8, C.frame) +
        line([p.x + p.w / 2 - 20, FLOOR - 1], [p.x + p.w / 2 + 20, FLOOR - 1], 6, C.frame) +
        rect(p.x, p.top, p.w, 14, 7, C.equip)
      if (p.back && s.front) o.back += rect(p.x + p.w / 2 - 24, p.top - p.back, 48, p.back + 4, 12, C.equip)
      else if (p.back) o.back += line([p.x + 6, p.top + 2], [p.x + 2, p.top - p.back], 14, C.equip)
      break
    }
    case 'calfBlock': {
      o.back += rect(p.x, FLOOR - p.h, 40, p.h, 4, C.equip)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Gesamtbild
// ---------------------------------------------------------------------------

export interface RenderOptions {
  primary: MuscleRegion[]
  secondary: MuscleRegion[]
}

export function renderFigure(def: FigureDef, frame: Frame, muscles: RenderOptions, opts: { floor?: boolean } = {}): string {
  const front = def.view === 'front'
  const sk = solvePose(frame.pose)
  const s = proj(sk, projector(def, frame.pose.hip[0]), front)
  const props = drawProps(def, s)
  const I = frame.intensity
  const set: GlowSet = muscles

  let ground = ''
  let shadow = ''
  if (!def.noFloor && opts.floor !== false) {
    const xs = [s.hip[0], s.legNear.end[0], s.legFar.end[0], s.shoulderC[0], s.headC[0]]
    const cx = def.shadowX ?? (Math.min(...xs) + Math.max(...xs)) / 2
    const rx = Math.max(70, (Math.max(...xs) - Math.min(...xs)) / 2 + 46)
    ground = rect(14, FLOOR, 372, 26, 13, C.floor)
    shadow = `<ellipse cx="${f(cx)}" cy="${FLOOR + 1}" rx="${f(rx)}" ry="6" fill="${C.shadow}"/>`
  }

  const farArm = drawArm(s.armFar, C.skinFar) + glows(s, set, 'arm', true, I)
  const farHand = drawHand(s.armFar, C.skinFar)
  const farLeg = drawLeg(s, s.legFar, sk.footFar, C.skinFar) + glows(s, set, 'leg', true, I)
  const torso = smoothClosed(torsoPoints(s), C.skin) + glows(s, set, 'torso', false, I)
  const head = drawHead(s)
  const nearLeg = drawLeg(s, s.legNear, sk.footNear, C.skin) + glows(s, set, 'leg', false, I)
  const nearArm = drawArm(s.armNear, C.skin) + glows(s, set, 'arm', false, I)
  const nearHand = drawHand(s.armNear, C.skin)

  let body: string
  if (front) {
    // Frontansicht: Beine, Rumpf, Kopf, dann Arme (beide gleich hell).
    body =
      farLeg +
      nearLeg +
      torso +
      head +
      props.far +
      props.mid +
      farArm +
      props.farGrip +
      farHand +
      nearArm +
      props.nearGrip +
      nearHand
  } else {
    body =
      farLeg +
      farArm +
      props.farGrip +
      farHand +
      props.far +
      torso +
      head +
      nearLeg +
      props.mid +
      nearArm +
      props.nearGrip +
      nearHand
  }

  let content = props.back + body + props.front
  if (def.roll) content = `<g transform="rotate(${def.roll.deg} ${def.roll.cx} ${def.roll.cy})">${content}</g>`
  content = shadow + content
  if (def.zoom && def.zoom !== 1) content = `<g transform="translate(200 ${FLOOR}) scale(${def.zoom}) translate(-200 ${-FLOOR})">${content}</g>`
  if (def.mirror) {
    ground = `<g transform="translate(${400} 0) scale(-1 1)">${ground}</g>`
    content = `<g transform="translate(${400} 0) scale(-1 1)">${content}</g>`
  }
  return ground + content
}

export type { Vec2 }
