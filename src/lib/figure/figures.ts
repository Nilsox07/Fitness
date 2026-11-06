/**
 * Figuren-Definitionen (Posen + Zeitachse + Geräte) der Übungen.
 *
 * Konventionen: Seitenansicht, Figur blickt nach +x. Liegend auf dem Rücken
 * heißt Kopf links (Rumpf 180°); `mirror` dreht das Bild bei Bedarf.
 * Zielpunkte (TargetLimb) halten Hände/Füße fest, die Gelenke folgen per IK.
 */
import { ANKLE_H, FLOOR, LEN, STAND_HIP_Y, cycle, hipFromAnkle, rad, solvePose, swing } from './rig'
import type { FigureDef, LimbSpec, PoseSpec, PropSpec, TimelineKey, Vec2 } from './types'

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const AY = FLOOR - ANKLE_H // Knöchelhöhe bei flachem Fuß
const HIP = STAND_HIP_Y
const HAND_FLOOR = FLOOR - 6.3 // Handmitte auf dem Boden
const STAND: LimbSpec = { a: [90, 90] }
const planted = (x: number, pole?: number): LimbSpec => ({ to: [x, AY], pole })
const at = (p: Vec2, d: number, len: number): Vec2 => [p[0] + Math.cos(rad(d)) * len, p[1] + Math.sin(rad(d)) * len]
const add = (p: Vec2, dx: number, dy: number): Vec2 => [p[0] + dx, p[1] + dy]

/** Punkt am Rumpf: s = Abstand ab Hüfte entlang der Wirbelsäule, n = zur Brust (+) bzw. zum Rücken (−). */
function onTorso(hip: Vec2, torso: number, s: number, n: number, bend = 0): Vec2 {
  const lo = LEN.lowerTorso
  if (s <= lo) return at(at(hip, torso, s), torso + 90, n)
  const u = torso + bend
  return at(at(at(hip, torso, lo), u, s - lo), u + 90, n)
}
const SHOULDER_S = LEN.lowerTorso + LEN.upperTorso - 5
const shoulder = (hip: Vec2, torso: number, bend = 0) => onTorso(hip, torso, SHOULDER_S, 0, bend)

function headOf(hip: Vec2, torso: number, bend = 0, head = 0): { c: Vec2; a: number } {
  const sk = solvePose({ hip, torso, bend, head, arm: STAND, leg: STAND })
  return { c: [sk.headC[0], sk.headC[1]], a: sk.headA }
}

/** Zehenspitze fest auf dem Boden, Ferse um `footA` angehoben → Knöchelposition. */
function ankleOnToes(toeX: number, footA: number): Vec2 {
  const d: Vec2 = [Math.cos(rad(footA)), Math.sin(rad(footA))]
  const sole: Vec2 = [-d[1], d[0]]
  const toe: Vec2 = [toeX, FLOOR - 3.6]
  return [toe[0] - d[0] * (LEN.foot - 4) - sole[0] * 3, toe[1] - d[1] * (LEN.foot - 4) - sole[1] * 3]
}

/** Gestreckter Körper (Liegestütz/Plank): Linie Knöchel → Schulter unter `ang` Grad. */
function bodyLine(ankle: Vec2, ang: number): { hip: Vec2; torso: number; legs: LimbSpec; shoulder: Vec2 } {
  const hip = at(ankle, -ang, LEN.thigh + LEN.shin)
  return { hip, torso: -ang, legs: { a: [180 - ang, 180 - ang] }, shoulder: at(hip, -ang, SHOULDER_S) }
}

const loop = cycle

// ---------------------------------------------------------------------------
// Brust
// ---------------------------------------------------------------------------

// Flachbank: Rücken auf der Bank (Polster oben bei y=200), Kopf links → gespiegelt.
const BENCH_HIP: Vec2 = [252, 188]
const BENCH_SH = shoulder(BENCH_HIP, 180)
const benchLegs: Pick<PoseSpec, 'leg' | 'legFar'> = {
  leg: { to: [308, AY], pole: -70 },
  legFar: { to: [298, AY], pole: -70 },
}
const lying = (arm: LimbSpec, extra: Partial<PoseSpec> = {}): PoseSpec => ({
  hip: BENCH_HIP,
  torso: 180,
  head: 6,
  arm,
  ...benchLegs,
  ...extra,
})

export const benchPress: FigureDef = {
  mirror: true,
  poses: {
    top: lying({ to: add(BENCH_SH, 3, -78), z: 30, pole: 90, splay: 45 }),
    bottom: lying({ to: add(BENCH_SH, 19, -25), z: 30, pole: 90, splay: 45 }),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'bench', x: 140, w: 160 }, { kind: 'rack', x: 150, y: 96 }, { kind: 'barbell' }],
}

export const dbBenchPress: FigureDef = {
  mirror: true,
  poses: {
    top: lying({ to: add(BENCH_SH, 2, -79), z: 20, pole: 90, splay: 40 }),
    bottom: lying({ to: add(BENCH_SH, 15, -20), z: 38, pole: 90, splay: 55 }),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'bench', x: 140, w: 160 }, { kind: 'dumbbell' }],
}

export const dbFly: FigureDef = {
  mirror: true,
  poses: {
    top: lying({ to: add(BENCH_SH, 4, -76), z: 14, pole: 90, splay: 80 }),
    open: lying({ to: add(BENCH_SH, 6, -6), z: 86, pole: 90, splay: 70 }),
  },
  timeline: loop('top', 'open', 'ba'),
  peak: 'open',
  props: [{ kind: 'bench', x: 140, w: 160 }, { kind: 'dumbbell' }],
}

// Schrägbank 35°: Scharnier bei x=250, Lehne steigt nach links.
const INC_HIP: Vec2 = [256, 192]
const INC_T = 215
const INC_SH = shoulder(INC_HIP, INC_T)
const inclineBase = (arm: LimbSpec): PoseSpec => ({
  hip: INC_HIP,
  torso: INC_T,
  head: 4,
  arm,
  leg: { to: [320, AY], pole: -60 },
  legFar: { to: [310, AY], pole: -60 },
})
export const inclinePress: FigureDef = {
  mirror: true,
  poses: {
    top: inclineBase({ to: add(INC_SH, 2, -78), z: 30, pole: 90, splay: 45 }),
    bottom: inclineBase({ to: add(onTorso(INC_HIP, INC_T, 50, 22), 0, -2), z: 30, pole: 90, splay: 45 }),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'incline', x: 250, angle: 35 }, { kind: 'barbell' }],
}

// Butterfly an der Maschine (Frontansicht, sitzend).
const BF_HIP: Vec2 = [200, 196]
const bfLegs: Pick<PoseSpec, 'leg'> = { leg: { a: [12, 90], out: [14, 4] } }
export const butterfly: FigureDef = {
  view: 'front',
  poses: {
    open: { hip: BF_HIP, torso: -90, arm: { a: [2, -90], out: [84, 0] }, ...bfLegs },
    closed: { hip: BF_HIP, torso: -90, arm: { a: [0, -88], out: [14, 0] }, ...bfLegs },
  },
  timeline: loop('open', 'closed', 'ab'),
  peak: 'closed',
  props: [{ kind: 'seat', x: 172, w: 56, top: 206, back: 100 }],
}

// Liegestütze: Hände fest, Körper als Linie um die Fußspitzen.
const PU_ANKLE: Vec2 = [112, 240]
const puTop = bodyLine(PU_ANKLE, 22.4)
const puBot = bodyLine(PU_ANKLE, 4)
const PU_HAND: Vec2 = [puTop.shoulder[0] - 2, HAND_FLOOR]
export const pushUp: FigureDef = {
  poses: {
    top: { hip: puTop.hip, torso: puTop.torso, head: -6, arm: { to: PU_HAND, z: 26, splay: 25 }, leg: puTop.legs },
    bottom: { hip: puBot.hip, torso: puBot.torso, head: -10, arm: { to: PU_HAND, z: 26, splay: 25 }, leg: puBot.legs },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'mat', x: 70, w: 260 }],
}

// Dips am Barren (Hände fest auf dem Holm).
const DIP_GRIP: Vec2 = [212, 122]
const dipPose = (sh: Vec2, torso: number): PoseSpec => ({
  hip: at(sh, torso + 180, SHOULDER_S),
  torso,
  head: 4,
  arm: { to: DIP_GRIP, z: 24 },
  leg: { a: [104, 168] },
  legFar: { a: [98, 174] },
})
export const dips: FigureDef = {
  zoom: 0.9,
  poses: {
    top: dipPose(add(DIP_GRIP, -4, -79), -80),
    bottom: dipPose(add(DIP_GRIP, 4, -40), -66),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'dipBars', y: 128, x1: 140, x2: 290 }],
}

// ---------------------------------------------------------------------------
// Schultern
// ---------------------------------------------------------------------------

const ST_HIP: Vec2 = [200, HIP]
const ST_SH = shoulder(ST_HIP, -90)
const standing = (arm: LimbSpec, extra: Partial<PoseSpec> = {}): PoseSpec => ({
  hip: ST_HIP,
  torso: -90,
  arm,
  leg: STAND,
  ...extra,
})

export const ohpBarbell: FigureDef = {
  zoom: 0.84,
  poses: {
    bottom: standing({ to: add(ST_SH, 16, -6), z: 26, pole: 75, splay: 30 }, { head: -4 }),
    top: standing({ to: add(ST_SH, 2, -79), z: 26, pole: 75, splay: 30 }),
  },
  timeline: loop('bottom', 'top', 'ab'),
  peak: 'bottom',
  props: [{ kind: 'barbell' }],
}

// Sitzend auf der Bank mit Lehne.
const SEAT_HIP: Vec2 = [190, 193]
const SEAT_SH = shoulder(SEAT_HIP, -90)
const seated = (arm: LimbSpec, extra: Partial<PoseSpec> = {}): PoseSpec => ({
  hip: SEAT_HIP,
  torso: -90,
  arm,
  leg: planted(SEAT_HIP[0] + 58, -20),
  ...extra,
})
export const dbShoulderPress: FigureDef = {
  poses: {
    bottom: seated({ to: add(SEAT_SH, 4, -12), z: 44, pole: 90, splay: 70 }),
    top: seated({ to: add(SEAT_SH, 2, -79), z: 22, pole: 90, splay: 70 }),
  },
  timeline: loop('bottom', 'top', 'ab'),
  peak: 'bottom',
  props: [{ kind: 'seat', x: 150, w: 70, top: 203, back: 92 }, { kind: 'dumbbell' }],
}

export const lateralRaise: FigureDef = {
  view: 'front',
  poses: {
    down: { hip: ST_HIP, torso: -90, arm: { a: [90, 90], out: [7, 10] }, leg: { a: [90, 90], out: [3, 3] } },
    up: { hip: ST_HIP, torso: -90, arm: { a: [90, 90], out: [84, 76] }, leg: { a: [90, 90], out: [3, 3] } },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}

export const frontRaise: FigureDef = {
  poses: {
    down: standing({ a: [86, 84] }),
    up: standing({ a: [-6, -8] }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}

// Reverse Flys vorgebeugt: Arme öffnen seitlich (Hände steigen bis auf Rumpfhöhe).
const RF_HIP: Vec2 = [170, 152]
export const reverseFly: FigureDef = {
  poses: {
    down: { hip: RF_HIP, torso: -24, head: -16, arm: { a: [92, 86], out: [8, 6] }, leg: planted(206) },
    up: { hip: RF_HIP, torso: -24, head: -16, arm: { a: [150, 140], out: [58, 48] }, leg: planted(206) },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}

// Face Pulls am Kabel (Seil auf Gesichtshöhe).
export const facePull: FigureDef = {
  poses: {
    start: standing({ to: [276, 92], z: 16, pole: 100, splay: 40 }, { torso: -88 }),
    pull: standing({ to: add(ST_SH, 20, -14), z: 34, pole: 180, splay: 75 }, { torso: -92 }),
  },
  timeline: loop('start', 'pull', 'ab'),
  peak: 'pull',
  props: [{ kind: 'cable', from: [334, 90], column: 352, handle: 'rope' }],
}

// ---------------------------------------------------------------------------
// Rücken
// ---------------------------------------------------------------------------

const BAR: Vec2 = [200, 26]
const hangPose = (sh: Vec2, torso: number, legs: LimbSpec, extra: Partial<PoseSpec> = {}): PoseSpec => ({
  hip: at(sh, torso + 180, SHOULDER_S),
  torso,
  arm: { to: BAR, z: 34, pole: 90, splay: 60 },
  leg: legs,
  ...extra,
})
export const pullUp: FigureDef = {
  poses: {
    hang: hangPose(add(BAR, -2, 79), -92, { a: [100, 162] }, { legFar: { a: [96, 166] } }),
    top: hangPose(add(BAR, -8, 20), -100, { a: [104, 150] }, { legFar: { a: [100, 155] }, head: -8 }),
  },
  timeline: loop('hang', 'top', 'ab'),
  peak: 'top',
  props: [{ kind: 'pullupBar', x: BAR[0], y: BAR[1] }],
}

export const hangingLegRaise: FigureDef = {
  poses: {
    hang: hangPose(add(BAR, -2, 79), -92, { a: [96, 162] }, { arm: { to: BAR, z: 30 } }),
    up: hangPose(add(BAR, -6, 79), -100, { a: [8, 16] }, { arm: { to: BAR, z: 30 }, head: 6, bend: 10 }),
  },
  timeline: loop('hang', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'pullupBar', x: BAR[0], y: BAR[1], post: -80 }],
}

// Latzug sitzend: Knie unter dem Polster.
const LAT_HIP: Vec2 = [184, 194]
const latPose = (torso: number, grip: Vec2): PoseSpec => ({
  hip: LAT_HIP,
  torso,
  arm: { to: grip, z: 42, pole: 100, splay: 55 },
  leg: planted(246, -10),
})
export const latPulldown: FigureDef = {
  poses: {
    top: latPose(-96, [204, 56]),
    bottom: latPose(-104, add(shoulder(LAT_HIP, -104), 22, -12)),
  },
  timeline: loop('top', 'bottom', 'ab'),
  peak: 'bottom',
  props: [{ kind: 'latMachine', x: 300, seat: [182, 204], pulley: [206, 36], pad: [240, 182] }],
}

// Langhantelrudern vorgebeugt
const ROW_HIP: Vec2 = [170, 152]
const ROW_T = -32
const ROW_SH = shoulder(ROW_HIP, ROW_T)
const rowPose = (arm: LimbSpec): PoseSpec => ({ hip: ROW_HIP, torso: ROW_T, head: -18, arm, leg: planted(206) })
export const bentOverRow: FigureDef = {
  poses: {
    down: rowPose({ to: add(ROW_SH, 4, 79), z: 28 }),
    up: rowPose({ to: onTorso(ROW_HIP, ROW_T, 26, 20), z: 28, pole: -120, splay: 25 }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'barbell' }],
}
export const bentOverRowDb: FigureDef = { ...bentOverRow, props: [{ kind: 'dumbbell' }] }

// Kurzhantelrudern einarmig: ferne Hand + fernes Knie auf der Bank.
const OAR_HIP: Vec2 = [188, 148]
const OAR_T = -14
const OAR_SH = shoulder(OAR_HIP, OAR_T)
const oarPose = (arm: LimbSpec): PoseSpec => ({
  hip: OAR_HIP,
  torso: OAR_T,
  head: -14,
  arm,
  armFar: { to: [OAR_SH[0] + 6, 198], z: 18 },
  leg: { to: [176, AY], pole: -20 },
  legFar: { a: [92, 178] },
})
export const oneArmRow: FigureDef = {
  poses: {
    down: oarPose({ to: add(OAR_SH, 4, 79), z: 22 }),
    up: oarPose({ to: onTorso(OAR_HIP, OAR_T, 28, 16), z: 26, pole: -110, splay: 10 }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'bench', x: 110, w: 180, top: 207 },
    { kind: 'dumbbell', one: true },
  ],
}

// Kabelrudern sitzend
const CR_HIP: Vec2 = [176, 216]
const crPose = (torso: number, grip: Vec2): PoseSpec => ({
  hip: CR_HIP,
  torso,
  arm: { to: grip, z: 16 },
  leg: { to: [282, 222], pole: -90 },
  foot: -88,
})
export const cableRow: FigureDef = {
  poses: {
    reach: crPose(-74, [270, 190]),
    pull: crPose(-94, onTorso(CR_HIP, -94, 30, 20)),
  },
  timeline: loop('reach', 'pull', 'ab'),
  peak: 'pull',
  props: [
    { kind: 'seat', x: 120, w: 100, top: 228 },
    { kind: 'box', x: 292, w: 12, h: 60 },
    { kind: 'cable', from: [340, 214], column: 358, layer: 'far' },
  ],
}

// Kreuzheben: Stange startet auf dem Boden über dem Mittelfuß, nah am Bein.
const DL_ANKLE = 206
const DL_T0 = -28
const DL_BAR0: Vec2 = [DL_ANKLE + 8, FLOOR - 34]
const DL_SH0 = add(DL_BAR0, 3, -79)
const DL_HIP0 = at(DL_SH0, DL_T0 + 180, SHOULDER_S)
const DL_HIP1: Vec2 = [198, HIP + 1]
export const deadlift: FigureDef = {
  poses: {
    floor: { hip: DL_HIP0, torso: DL_T0, head: -22, arm: { to: DL_BAR0, z: 24 }, leg: planted(DL_ANKLE) },
    top: { hip: DL_HIP1, torso: -88, arm: { to: add(shoulder(DL_HIP1, -88), 4, 79), z: 24 }, leg: planted(DL_ANKLE) },
  },
  timeline: loop('floor', 'top', 'ab'),
  peak: 'floor',
  props: [{ kind: 'barbell' }],
}

const RDL_HIP: Vec2 = [166, 157]
const RDL_T = -24
export const romanianDeadlift: FigureDef = {
  poses: {
    top: { hip: DL_HIP1, torso: -88, arm: { to: add(shoulder(DL_HIP1, -88), 4, 79), z: 24 }, leg: planted(DL_ANKLE) },
    hinge: {
      hip: RDL_HIP,
      torso: RDL_T,
      head: -16,
      arm: { to: add(shoulder(RDL_HIP, RDL_T), 3, 79), z: 24 },
      leg: planted(DL_ANKLE),
    },
  },
  timeline: loop('top', 'hinge', 'ba'),
  peak: 'hinge',
  props: [{ kind: 'barbell' }],
}

// ---------------------------------------------------------------------------
// Beine
// ---------------------------------------------------------------------------

function backBar(hip: Vec2, torso: number): Vec2 {
  return onTorso(hip, torso, SHOULDER_S + 3, -13)
}
const SQ_ANKLE = 206
const sqTop: Vec2 = [199, HIP + 1]
const sqBot: Vec2 = [166, 198]
export const backSquat: FigureDef = {
  poses: {
    top: { hip: sqTop, torso: -88, arm: { to: backBar(sqTop, -88) }, leg: planted(SQ_ANKLE) },
    bottom: { hip: sqBot, torso: -52, head: -18, arm: { to: backBar(sqBot, -52) }, leg: planted(SQ_ANKLE) },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'barbell' }],
}

const gbBot: Vec2 = [170, 204]
const gobletArm = (hip: Vec2, torso: number): LimbSpec => ({
  to: onTorso(hip, torso, 48, 17),
  z: 8,
  pole: 90,
  splay: 20,
})
export const gobletSquat: FigureDef = {
  poses: {
    top: { hip: sqTop, torso: -88, arm: gobletArm(sqTop, -88), leg: planted(SQ_ANKLE) },
    bottom: { hip: gbBot, torso: -64, head: -12, arm: gobletArm(gbBot, -64), leg: planted(SQ_ANKLE) },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'kettlebell' }],
}

const asBot: Vec2 = [168, 200]
export const airSquat: FigureDef = {
  poses: {
    top: { hip: sqTop, torso: -88, arm: { a: [92, 90] }, leg: planted(SQ_ANKLE) },
    bottom: { hip: asBot, torso: -56, head: -16, arm: { a: [2, 0] }, leg: planted(SQ_ANKLE) },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
}

// Sprungkniebeuge: alle Beine über Winkel, damit die Füße abheben können.
const JS_BOT = hipFromAnkle([SQ_ANKLE, AY], 18, 112)
export const jumpSquat: FigureDef = {
  duration: 1700,
  poses: {
    bottom: { hip: JS_BOT, torso: -52, head: -16, arm: { a: [100, 60] }, leg: { a: [18, 112] }, foot: 0 },
    stand: { hip: [200, HIP], torso: -88, arm: { a: [40, -20] }, leg: { a: [90, 90] }, foot: 0 },
    air: { hip: [202, HIP - 26], torso: -90, arm: { a: [-60, -75] }, leg: { a: [92, 96] }, foot: 50 },
  },
  timeline: [
    { at: 0, pose: 'bottom' },
    { at: 0.1, pose: 'bottom' },
    { at: 0.3, pose: 'stand', c: true },
    { at: 0.45, pose: 'air', c: true },
    { at: 0.62, pose: 'stand' },
    { at: 0.9, pose: 'bottom' },
    { at: 1, pose: 'bottom' },
  ],
  peak: 'bottom',
}

// Wandsitzen (isometrisch, leichtes „Atmen").
const WS_HIP: Vec2 = [160, AY - LEN.shin]
export const wallSit: FigureDef = {
  duration: 3600,
  poses: {
    a: { hip: WS_HIP, torso: -90, arm: { a: [70, 8] }, leg: planted(WS_HIP[0] + LEN.thigh) },
    b: { hip: add(WS_HIP, 0, 1.5), torso: -89, head: 3, arm: { a: [72, 10] }, leg: planted(WS_HIP[0] + LEN.thigh) },
  },
  timeline: [
    { at: 0, pose: 'a' },
    { at: 0.5, pose: 'b', c: true },
    { at: 1, pose: 'a', c: true },
  ],
  peak: 'a',
  props: [{ kind: 'wall', x: 132 }],
}

// Beinpresse 45°: Fahrtrichtung −45°, Rücken zurückgelehnt.
const LP_HIP: Vec2 = [150, 214]
const LP_T = 228
const LP_DIR = -46
const lpPose = (d: number): PoseSpec => ({
  hip: LP_HIP,
  torso: LP_T,
  head: 22,
  arm: { a: [70, 30] },
  leg: { to: at(LP_HIP, LP_DIR, d), pole: -120 },
  legFar: { to: at(add(LP_HIP, 0, 0), LP_DIR, d), pole: -120 },
  foot: LP_DIR - 90,
})
export const legPress: FigureDef = {
  poses: {
    out: lpPose(102),
    in: lpPose(58),
  },
  timeline: loop('out', 'in', 'ba'),
  peak: 'in',
  props: [{ kind: 'legPress', angle: LP_DIR, seat: [146, 226], back: 48 }],
}

// Ausfallschritte (Körpergewicht, Hände an der Hüfte).
const handsOnHips = (hip: Vec2, torso: number): LimbSpec => ({
  to: onTorso(hip, torso, 6, 2),
  z: 22,
  pole: 180,
  splay: 60,
})
const LU_FRONT = 252
const LU_BACK = ankleOnToes(150, 42)
const luTop: Vec2 = [198, 160]
const luBot: Vec2 = [194, 205]
export const lunge: FigureDef = {
  poses: {
    top: {
      hip: luTop,
      torso: -90,
      arm: handsOnHips(luTop, -90),
      leg: planted(LU_FRONT),
      legFar: { to: LU_BACK, pole: 0 },
      footFar: 42,
    },
    bottom: {
      hip: luBot,
      torso: -88,
      arm: handsOnHips(luBot, -88),
      leg: planted(LU_FRONT),
      legFar: { to: LU_BACK, pole: 100 },
      footFar: 42,
    },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
}

// Bulgarian Split Squat: hinterer Fuß auf der Bank, Kurzhanteln.
const BSS_BACK: Vec2 = [128, 196]
const bssTop: Vec2 = [196, 160]
const bssBot: Vec2 = [180, 198]
export const bulgarianSplitSquat: FigureDef = {
  poses: {
    top: {
      hip: bssTop,
      torso: -86,
      arm: { a: [92, 90] },
      leg: planted(244),
      legFar: { to: BSS_BACK, pole: 30 },
      footFar: 196,
    },
    bottom: {
      hip: bssBot,
      torso: -80,
      head: -8,
      arm: { a: [94, 92] },
      leg: planted(244),
      legFar: { to: BSS_BACK, pole: 110 },
      footFar: 200,
    },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'bench', x: 70, w: 80, top: 200 }, { kind: 'dumbbell' }],
}

// Hip Thrust: oberer Rücken auf der Bankkante, Langhantel auf der Hüfte.
const HT_SH: Vec2 = [150, 188]
const htPose = (torso: number): PoseSpec => {
  const hip = at(HT_SH, torso + 180, SHOULDER_S)
  return {
    hip,
    torso,
    head: torso === 180 ? 14 : 4,
    arm: { to: onTorso(hip, torso, 4, 17), z: 30, pole: 80 },
    leg: { to: [270, AY], pole: -80 },
    legFar: { to: [262, AY], pole: -80 },
  }
}
export const hipThrust: FigureDef = {
  poses: {
    down: htPose(212),
    up: htPose(180),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'bench', x: 56, w: 96, top: 196 },
    { kind: 'barbell', plate: 30 },
  ],
}

// Glute Bridge: Schultern am Boden.
const GB_SH: Vec2 = [138, FLOOR - 13]
const gbPose = (torso: number): PoseSpec => ({
  hip: at(GB_SH, torso + 180, SHOULDER_S),
  torso,
  arm: { a: [2, 0] },
  leg: { to: [264, AY], pole: -80 },
  legFar: { to: [256, AY], pole: -80 },
})
export const gluteBridge: FigureDef = {
  poses: {
    down: gbPose(180),
    up: gbPose(152),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 70, w: 240 }],
}

// Beinstrecker
const LE_HIP: Vec2 = [180, 186]
const LE_KNEE = at(LE_HIP, 3, LEN.thigh)
const lePose = (shin: number): PoseSpec => ({
  hip: LE_HIP,
  torso: -96,
  arm: { to: [200, 200], z: 26 },
  leg: { a: [3, shin] },
})
export const legExtension: FigureDef = {
  poses: {
    down: lePose(96),
    up: lePose(6),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'legExtension', seat: [228, 200], pivot: LE_KNEE }],
}

// Beinbeuger liegend: bäuchlings, Kopf rechts.
const LC_HIP: Vec2 = [192, 180]
const LC_KNEE = at(LC_HIP, 180, LEN.thigh)
const lcPose = (shin: number): PoseSpec => ({
  hip: LC_HIP,
  torso: -3,
  head: -12,
  arm: { a: [96, 30] },
  leg: { a: [180, shin] },
})
export const legCurl: FigureDef = {
  poses: {
    down: lcPose(180),
    up: lcPose(258),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'legCurl', top: 192, x: 120, w: 180, pivot: LC_KNEE }],
}

// Wadenheben (Kurzhanteln): Ballen fest, Ferse hebt.
const CALF_TOE = 226
const calfPose = (footA: number): PoseSpec => {
  const ankle = ankleOnToes(CALF_TOE, footA)
  return { hip: [ankle[0], ankle[1] - LEN.thigh - LEN.shin], torso: -90, arm: { a: [92, 90] }, leg: STAND, foot: footA }
}
export const calfRaise: FigureDef = {
  poses: {
    down: calfPose(0),
    up: calfPose(36),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}

// ---------------------------------------------------------------------------
// Arme
// ---------------------------------------------------------------------------

export const dbCurl: FigureDef = {
  poses: {
    down: standing({ a: [93, 86] }),
    up: standing({ a: [97, -62] }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}
export const bbCurl: FigureDef = { ...dbCurl, props: [{ kind: 'barbell', plate: 22 }] }
export const hammerCurl: FigureDef = { ...dbCurl, props: [{ kind: 'dumbbell', style: 'hammer' }] }

export const tricepsPushdown: FigureDef = {
  poses: {
    up: standing({ a: [96, -58] }, { torso: -84, head: 4 }),
    down: standing({ a: [96, 86] }, { torso: -84, head: 4 }),
  },
  timeline: loop('up', 'down', 'ab'),
  peak: 'down',
  props: [{ kind: 'cable', from: [238, 30], column: 306, handle: 'rope' }],
}

// Skull Crusher: Oberarm fest, leicht Richtung Kopf geneigt.
export const skullCrusher: FigureDef = {
  mirror: true,
  poses: {
    top: lying({ a: [-100, -94] }),
    bottom: lying({ a: [-102, 152] }),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [
    { kind: 'bench', x: 140, w: 160 },
    { kind: 'barbell', plate: 22 },
  ],
}

export const overheadTriceps: FigureDef = {
  poses: {
    down: seated({ a: [-104, 112] }, { head: 4 }),
    up: seated({ a: [-98, -92] }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'down',
  props: [
    { kind: 'seat', x: 150, w: 70, top: 203 },
    { kind: 'dumbbell', one: true },
  ],
}

export const tricepsKickback: FigureDef = {
  poses: {
    bent: { hip: ROW_HIP, torso: -24, head: -14, arm: { a: [160, 90] }, leg: planted(206) },
    ext: { hip: ROW_HIP, torso: -24, head: -14, arm: { a: [162, 164] }, leg: planted(206) },
  },
  timeline: loop('bent', 'ext', 'ab'),
  peak: 'ext',
  props: [{ kind: 'dumbbell' }],
}

// ---------------------------------------------------------------------------
// Rumpf
// ---------------------------------------------------------------------------

// Crunches: Rückenlage auf der Matte, Kopf links, Hände hinter dem Kopf.
const CR_FLOOR_HIP: Vec2 = [214, FLOOR - 13]
function crunchPose(bend: number, head: number): PoseSpec {
  const h = headOf(CR_FLOOR_HIP, 180, bend, head)
  const hand = at(at(h.c, h.a - 90, 9), h.a, -3)
  return {
    hip: CR_FLOOR_HIP,
    torso: 180,
    bend,
    head,
    arm: { to: hand, z: 12, pole: 180 + bend + 90, splay: 70 },
    leg: { to: [282, AY], pole: -80 },
    legFar: { to: [274, AY], pole: -80 },
  }
}
export const crunch: FigureDef = {
  poses: {
    down: crunchPose(0, 6),
    up: crunchPose(34, 16),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 80, w: 240 }],
}

// Unterarmstütz
const PL = bodyLine([92, 240], 8.9)
const PL_HAND: Vec2 = [PL.shoulder[0] + 38, HAND_FLOOR]
export const plank: FigureDef = {
  duration: 3600,
  poses: {
    a: { hip: PL.hip, torso: PL.torso, head: -4, arm: { to: PL_HAND, z: 18, pole: 100 }, leg: PL.legs },
    b: { hip: PL.hip, torso: PL.torso, bend: -1.2, head: -6, arm: { to: PL_HAND, z: 18, pole: 100 }, leg: PL.legs },
  },
  timeline: [
    { at: 0, pose: 'a' },
    { at: 0.5, pose: 'b', c: true },
    { at: 1, pose: 'a', c: true },
  ],
  peak: 'a',
  props: [{ kind: 'mat', x: 60, w: 290 }],
}

// Seitstütz: Frontansicht, um die Füße gekippt.
const SP_HIP: Vec2 = [104, 140]
const spPose = (out: number): PoseSpec => ({
  hip: SP_HIP,
  torso: -90,
  arm: { a: [90, 0], out: [70, 0] },
  armFar: { a: [-90, -90], out: [out, out] },
  leg: { a: [90, 90], out: [1, 1] },
})
export const sidePlank: FigureDef = {
  view: 'front',
  roll: { deg: 67, cx: SP_HIP[0], cy: SP_HIP[1] + 114 },
  shadowX: 200,
  duration: 3600,
  poses: {
    a: spPose(72),
    b: spPose(76),
  },
  timeline: [
    { at: 0, pose: 'a' },
    { at: 0.5, pose: 'b', c: true },
    { at: 1, pose: 'a', c: true },
  ],
  peak: 'a',
}

// Russian Twist: Frontansicht, sitzend zurückgelehnt, Hände wandern seitlich.
const RT_HIP: Vec2 = [200, FLOOR - 15]
const rtPose = (side: number): PoseSpec => ({
  hip: RT_HIP,
  torso: -122,
  twist: -side * 40,
  head: 10,
  arm: { to: [RT_HIP[0] + 30, RT_HIP[1] - 58], zw: side * 54, splay: 30 },
  leg: { a: [-30, 44], out: [26, 6] },
})
export const russianTwist: FigureDef = {
  view: 'front',
  duration: 2400,
  poses: {
    left: rtPose(1),
    right: rtPose(-1),
  },
  timeline: [
    { at: 0, pose: 'left' },
    { at: 0.1, pose: 'left' },
    { at: 0.5, pose: 'right', c: true },
    { at: 0.6, pose: 'right' },
    { at: 1, pose: 'left', c: true },
  ],
  peak: 'left',
}

// Mountain Climbers: Liegestütz-Position, Knie wechseln zur Brust.
const MC = bodyLine(PU_ANKLE, 22.4)
const MC_DRIVE: LimbSpec = { a: [6, 126] }
export const mountainClimber: FigureDef = {
  duration: 900,
  poses: {
    a: { hip: MC.hip, torso: MC.torso, head: -6, arm: { to: PU_HAND, z: 26 }, leg: MC_DRIVE, legFar: MC.legs },
    b: { hip: MC.hip, torso: MC.torso, head: -6, arm: { to: PU_HAND, z: 26 }, leg: MC.legs, legFar: MC_DRIVE },
  },
  timeline: swing('a', 'b'),
  peak: 'a',
}

// Burpees: Stand → Hocke → Liegestütz → Hocke → Strecksprung.
const BP_SQ = hipFromAnkle([206, AY], -15, 105)
const BP_HAND: Vec2 = at(at(BP_SQ, -45, SHOULDER_S), 72, LEN.upperArm + LEN.forearm)
const BP_SH: Vec2 = [BP_HAND[0], BP_HAND[1] - LEN.upperArm - LEN.forearm]
const BP_ANG = (Math.asin((240 - BP_SH[1]) / (SHOULDER_S + LEN.thigh + LEN.shin)) * 180) / Math.PI
const BP_HIP = at(BP_SH, 180 - BP_ANG, SHOULDER_S)
export const burpee: FigureDef = {
  zoom: 0.84,
  duration: 3400,
  poses: {
    stand: { hip: [200, HIP], torso: -90, arm: { a: [92, 90] }, leg: { a: [90, 90] }, foot: 0 },
    squat: { hip: BP_SQ, torso: -45, head: -10, arm: { a: [72, 72] }, leg: { a: [-15, 105] }, foot: 0 },
    plank: { hip: BP_HIP, torso: -BP_ANG, head: -6, arm: { a: [90, 90] }, leg: { a: [180 - BP_ANG, 180 - BP_ANG] } },
    air: { hip: [200, HIP - 24], torso: -90, arm: { a: [-82, -86] }, leg: { a: [92, 95] }, foot: 50 },
  },
  timeline: [
    { at: 0, pose: 'stand' },
    { at: 0.16, pose: 'squat' },
    { at: 0.32, pose: 'plank' },
    { at: 0.42, pose: 'plank' },
    { at: 0.58, pose: 'squat', c: true },
    { at: 0.76, pose: 'air', c: true },
    { at: 0.9, pose: 'stand' },
    { at: 1, pose: 'stand' },
  ],
  peak: 'plank',
}

// Hampelmann: Frontansicht.
const JJ_OPEN_HIP: Vec2 = [200, AY - (LEN.thigh + LEN.shin) * Math.cos(rad(14))]
export const jumpingJack: FigureDef = {
  view: 'front',
  zoom: 0.9,
  duration: 1000,
  poses: {
    closed: { hip: [200, HIP], torso: -90, arm: { a: [90, 90], out: [7, 9] }, leg: { a: [90, 90], out: [3, 3] } },
    open: { hip: JJ_OPEN_HIP, torso: -90, arm: { a: [90, 90], out: [158, 166] }, leg: { a: [90, 90], out: [14, 14] } },
  },
  timeline: swing('closed', 'open'),
  peak: 'open',
}

// High Knees: Laufen auf der Stelle.
const HK_HIP: Vec2 = [200, HIP - 4]
export const highKnees: FigureDef = {
  duration: 760,
  poses: {
    a: {
      hip: HK_HIP,
      torso: -86,
      arm: { a: [124, 44] },
      armFar: { a: [52, -36] },
      leg: { a: [-6, 84] },
      legFar: { a: [92, 94] },
      foot: -4,
      footFar: 20,
    },
    b: {
      hip: HK_HIP,
      torso: -86,
      arm: { a: [52, -36] },
      armFar: { a: [124, 44] },
      leg: { a: [92, 94] },
      legFar: { a: [-6, 84] },
      foot: 20,
      footFar: -4,
    },
  },
  timeline: swing('a', 'b'),
  peak: 'a',
}

// Superman: bäuchlings, Arme und Beine heben.
const SM_HIP: Vec2 = [176, FLOOR - 15]
export const superman: FigureDef = {
  poses: {
    down: { hip: SM_HIP, torso: 0, arm: { a: [2, 1] }, leg: { a: [180, 180] }, foot: 172 },
    up: { hip: SM_HIP, torso: -2, bend: -14, head: -10, arm: { a: [-14, -16] }, leg: { a: [190, 192] }, foot: 182 },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 50, w: 300 }],
}

// Kettlebell Swing
const KS_HIP: Vec2 = [168, 156]
export const kettlebellSwing: FigureDef = {
  duration: 2000,
  poses: {
    hinge: { hip: KS_HIP, torso: -26, head: -16, arm: { a: [112, 114] }, leg: planted(206) },
    top: { hip: [199, HIP + 1], torso: -92, arm: { a: [-2, -4] }, leg: planted(206) },
  },
  timeline: swing('hinge', 'top', 'ab'),
  peak: 'top',
  props: [{ kind: 'kettlebell', along: true }],
}

// Glute Kickbacks im Vierfüßlerstand
const GK_HIP: Vec2 = [176, FLOOR - 8.4 - LEN.thigh]
const GK_T = -12
const GK_HAND: Vec2 = [shoulder(GK_HIP, GK_T)[0] + 2, HAND_FLOOR]
export const gluteKickback: FigureDef = {
  poses: {
    down: {
      hip: GK_HIP,
      torso: GK_T,
      head: -8,
      arm: { to: GK_HAND, z: 18 },
      leg: { a: [92, 180] },
      legFar: { a: [90, 180] },
      foot: 180,
      footFar: 180,
    },
    up: {
      hip: GK_HIP,
      torso: GK_T,
      head: -8,
      arm: { to: GK_HAND, z: 18 },
      leg: { a: [192, 268] },
      legFar: { a: [90, 180] },
      foot: 180,
      footFar: 180,
    },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 70, w: 240 }],
}

// ===========================================================================
// Erweiterung: weitere Bewegungsmuster
// ===========================================================================

/** Zyklus mit Zwischenpose (für Kreisbahnen, z. B. Knie als Drehpunkt): A → M → B → M → A. */
function via(a: string, m: string, b: string, concentric: 'ab' | 'ba'): TimelineKey[] {
  const ab = concentric === 'ab'
  return [
    { at: 0, pose: a },
    { at: 0.08, pose: a },
    { at: 0.27, pose: m, c: ab },
    { at: 0.45, pose: b, c: ab },
    { at: 0.55, pose: b },
    { at: 0.73, pose: m, c: !ab },
    { at: 0.92, pose: a, c: !ab },
    { at: 1, pose: a },
  ]
}
// --- Brust / Druck -----------------------------------------------------------

// Pullover: auf der Bank, gestreckte Arme vom Brustkorb nach hinten über den Kopf.
export const pullover: FigureDef = {
  mirror: true,
  poses: {
    top: lying({ a: [-94, -98] }),
    back: lying({ a: [-186, -196] }),
  },
  timeline: loop('top', 'back', 'ba'),
  peak: 'back',
  props: [
    { kind: 'bench', x: 140, w: 160 },
    { kind: 'dumbbell', one: true },
  ],
}

// Stehendes Drücken nach vorn (Kabel-Brustpresse, Medizinball-Stoß, Landmine).
const SP_STAND: Vec2 = [196, HIP + 4]
const SP_SH = shoulder(SP_STAND, -86)
const standPress = (arm: LimbSpec): PoseSpec => ({
  hip: SP_STAND,
  torso: -86,
  arm,
  leg: planted(216),
  legFar: planted(178),
})
export const standingPress: FigureDef = {
  poses: {
    chest: standPress({ to: add(SP_SH, 16, 10), z: 24, pole: 170, splay: 50 }),
    out: standPress({ to: add(SP_SH, 80, 6), z: 14, pole: 120, splay: 40 }),
  },
  timeline: loop('chest', 'out', 'ab'),
  peak: 'out',
  props: [{ kind: 'cable', from: [96, 92], column: 80, handle: 'handle', hand: 'both', layer: 'far' }],
}
export const chestPass: FigureDef = { ...standingPress, duration: 2000, props: [{ kind: 'ball', r: 14, dx: 8 }] }

// --- Schultern -----------------------------------------------------------------

// Aufrechtes Rudern: Stange vom Oberschenkel zur Brust, Ellbogen führen hoch.
export const uprightRow: FigureDef = {
  poses: {
    down: standing({ to: add(ST_SH, 8, 76), z: 12, pole: 180, splay: 40 }),
    up: standing({ to: add(ST_SH, 16, 0), z: 12, pole: -110, splay: 70 }, { head: -4 }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'barbell', plate: 22 }],
}

// Shrugs: Frontansicht, Schultern heben die hängenden Arme.
const SH_LEGS: LimbSpec = { a: [90, 90], out: [3, 3] }
export const shrug: FigureDef = {
  view: 'front',
  poses: {
    down: { hip: ST_HIP, torso: -90, arm: { a: [90, 90], out: [9, 6] }, leg: SH_LEGS },
    up: { hip: ST_HIP, torso: -90, shrug: 10, head: 4, arm: { a: [90, 90], out: [9, 6] }, leg: SH_LEGS },
  },
  timeline: loop('down', 'up', 'ab', [0.08, 0.16]),
  peak: 'up',
  props: [{ kind: 'dumbbell' }],
}

// Außenrotation: Oberarm am Körper, Unterarm dreht nach außen (Frontansicht).
const ER_ARM_FAR: LimbSpec = { a: [90, 90], out: [7, 9] }
export const externalRotation: FigureDef = {
  view: 'front',
  poses: {
    in: { hip: ST_HIP, torso: -90, arm: { a: [90, 0], out: [5, -62] }, armFar: ER_ARM_FAR, leg: SH_LEGS },
    out: { hip: ST_HIP, torso: -90, arm: { a: [90, 0], out: [5, 72] }, armFar: ER_ARM_FAR, leg: SH_LEGS },
  },
  timeline: loop('in', 'out', 'ab'),
  peak: 'out',
  props: [{ kind: 'dumbbell', one: true }],
}

// Battle Ropes: halbe Kniebeuge, Arme schlagen abwechselnd Wellen.
const BR_HIP: Vec2 = [184, 166]
const brPose = (near: Vec2, far: Vec2): PoseSpec => ({
  hip: BR_HIP,
  torso: -72,
  head: -6,
  arm: { a: near },
  armFar: { a: far },
  leg: planted(212),
  legFar: planted(196),
})
export const battlingRopes: FigureDef = {
  duration: 700,
  poses: {
    a: brPose([30, -6], [72, 40]),
    b: brPose([72, 40], [30, -6]),
  },
  timeline: swing('a', 'b'),
  peak: 'a',
  props: [{ kind: 'cable', from: [372, 250], hand: 'both' }],
}

// Handstand-Liegestütz: Überkopfdrücken kopfüber (Hände fest am Boden).
const HS_HAND: Vec2 = [200, 40]
const hsPose = (shDist: number): PoseSpec => {
  const sh: Vec2 = [HS_HAND[0] - 2, HS_HAND[1] + shDist]
  return {
    hip: [sh[0], sh[1] + SHOULDER_S],
    torso: -90,
    head: -6,
    arm: { to: HS_HAND, z: 26, pole: 0, splay: 40 },
    leg: { a: [90, 90] },
    legFar: { a: [92, 92] },
  }
}
export const handstandPushUp: FigureDef = {
  zoom: 0.86,
  roll: { deg: 180, cx: 200, cy: (HS_HAND[1] + HAND_FLOOR) / 2 },
  shadowX: 200,
  poses: {
    top: hsPose(80),
    bottom: hsPose(44),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
}

// --- Olympisch / Ganzkörper ---------------------------------------------------------

// Frontablage: Hände vor den Schultern, Ellbogen vorn.
const rackArm = (hip: Vec2, torso: number): LimbSpec => ({
  to: onTorso(hip, torso, SHOULDER_S + 4, 15),
  z: 22,
  pole: -10,
  splay: 25,
})
const overArm = (hip: Vec2, torso: number): LimbSpec => ({
  to: at(shoulder(hip, torso), -94, 80),
  z: 30,
  pole: 180,
  splay: 40,
})
const EXT_HIP: Vec2 = [200, HIP - 1]
const CATCH_HIP: Vec2 = [186, 178]
const FS_BOT: Vec2 = [170, 202]
const OL = {
  floor: { hip: DL_HIP0, torso: DL_T0, head: -22, arm: { to: DL_BAR0, z: 24 }, leg: planted(DL_ANKLE) } as PoseSpec,
  ext: {
    hip: EXT_HIP,
    torso: -94,
    head: -6,
    shrug: 6,
    arm: { to: add(shoulder(EXT_HIP, -94), 4, 73), z: 24 },
    leg: planted(DL_ANKLE),
  } as PoseSpec,
  rack: { hip: DL_HIP1, torso: -88, arm: rackArm(DL_HIP1, -88), leg: planted(DL_ANKLE) } as PoseSpec,
  catch: { hip: CATCH_HIP, torso: -74, head: -6, arm: rackArm(CATCH_HIP, -74), leg: planted(DL_ANKLE) } as PoseSpec,
  over: { hip: DL_HIP1, torso: -88, arm: overArm(DL_HIP1, -88), leg: planted(DL_ANKLE) } as PoseSpec,
  overCatch: { hip: CATCH_HIP, torso: -78, head: -4, arm: overArm(CATCH_HIP, -78), leg: planted(DL_ANKLE) } as PoseSpec,
  frontBot: { hip: FS_BOT, torso: -66, head: -8, arm: rackArm(FS_BOT, -66), leg: planted(DL_ANKLE) } as PoseSpec,
  overBot: { hip: FS_BOT, torso: -70, head: -4, arm: overArm(FS_BOT, -70), leg: planted(DL_ANKLE) } as PoseSpec,
}
export const clean: FigureDef = {
  zoom: 0.94,
  duration: 3000,
  poses: { floor: OL.floor, ext: OL.ext, catch: OL.catch, rack: OL.rack },
  timeline: [
    { at: 0, pose: 'floor' },
    { at: 0.08, pose: 'floor' },
    { at: 0.28, pose: 'ext', c: true },
    { at: 0.38, pose: 'catch', c: true },
    { at: 0.52, pose: 'rack', c: true },
    { at: 0.64, pose: 'rack' },
    { at: 0.92, pose: 'floor' },
    { at: 1, pose: 'floor' },
  ],
  peak: 'catch',
  props: [{ kind: 'barbell' }],
}
export const cleanPress: FigureDef = {
  zoom: 0.84,
  duration: 4200,
  poses: { floor: OL.floor, ext: OL.ext, catch: OL.catch, rack: OL.rack, over: OL.over },
  timeline: [
    { at: 0, pose: 'floor' },
    { at: 0.06, pose: 'floor' },
    { at: 0.2, pose: 'ext', c: true },
    { at: 0.28, pose: 'catch', c: true },
    { at: 0.38, pose: 'rack', c: true },
    { at: 0.44, pose: 'rack' },
    { at: 0.58, pose: 'over', c: true },
    { at: 0.64, pose: 'over' },
    { at: 0.76, pose: 'rack' },
    { at: 0.94, pose: 'floor' },
    { at: 1, pose: 'floor' },
  ],
  peak: 'over',
  props: [{ kind: 'barbell' }],
}
export const snatch: FigureDef = {
  zoom: 0.84,
  duration: 3200,
  poses: { floor: OL.floor, ext: OL.ext, catch: OL.overCatch, over: OL.over },
  timeline: [
    { at: 0, pose: 'floor' },
    { at: 0.08, pose: 'floor' },
    { at: 0.26, pose: 'ext', c: true },
    { at: 0.38, pose: 'catch', c: true },
    { at: 0.52, pose: 'over', c: true },
    { at: 0.62, pose: 'over' },
    { at: 0.92, pose: 'floor' },
    { at: 1, pose: 'floor' },
  ],
  peak: 'catch',
  props: [{ kind: 'barbell' }],
}
export const thruster: FigureDef = {
  zoom: 0.84,
  poses: { bottom: OL.frontBot, over: OL.over },
  timeline: loop('bottom', 'over', 'ab'),
  peak: 'bottom',
  props: [{ kind: 'barbell' }],
}
export const frontSquat: FigureDef = {
  poses: { top: OL.rack, bottom: OL.frontBot },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'barbell' }],
}
export const overheadSquat: FigureDef = {
  zoom: 0.84,
  poses: { top: OL.over, bottom: OL.overBot },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'barbell' }],
}

// --- Beine ---------------------------------------------------------------------

// Kniebeuge mit hängenden Kurzhanteln.
export const dbSquat: FigureDef = {
  poses: {
    top: { hip: sqTop, torso: -88, arm: { a: [90, 90] }, leg: planted(SQ_ANKLE) },
    bottom: { hip: gbBot, torso: -62, head: -12, arm: { a: [94, 92] }, leg: planted(SQ_ANKLE) },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'dumbbell' }],
}

// Pistol Squat: einbeinig, freies Bein gestreckt nach vorn.
const PS_ANKLE = 196
export const pistolSquat: FigureDef = {
  poses: {
    top: {
      hip: [PS_ANKLE - 4, HIP + 1],
      torso: -88,
      arm: { a: [40, 30] },
      leg: planted(PS_ANKLE),
      legFar: { a: [70, 80] },
      footFar: -10,
    },
    bottom: {
      hip: [PS_ANKLE - 34, 208],
      torso: -50,
      head: -16,
      arm: { a: [-6, -6] },
      leg: planted(PS_ANKLE, -40),
      legFar: { a: [-6, -4] },
      footFar: -94,
    },
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
}

// Step-up: vorderer Fuß auf der Box, Körper steigt hinauf.
const STEP_H = 52
const STEP_ANK: Vec2 = [250, FLOOR - STEP_H - ANKLE_H]
export const stepUp: FigureDef = {
  zoom: 0.86,
  poses: {
    down: {
      hip: [206, HIP + 6],
      torso: -84,
      arm: { a: [90, 90] },
      leg: { to: STEP_ANK, pole: -40 },
      legFar: { to: [176, AY] },
    },
    up: {
      hip: [STEP_ANK[0] - 6, STEP_ANK[1] - 107],
      torso: -88,
      arm: { a: [90, 90] },
      leg: { to: STEP_ANK },
      legFar: { to: [STEP_ANK[0] - 12, STEP_ANK[1] - 30], pole: -10 },
    },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'box', x: 222, w: 74, h: STEP_H }, { kind: 'dumbbell' }],
}

// Seitlicher Ausfallschritt (Frontansicht): Hüfte wandert über das gebeugte Bein.
function sideLungeLegs(): { stand: PoseSpec; lunge: PoseSpec } {
  const nearT = { a: 30, o: 40 }
  const nearS = { a: 95, o: 10 }
  const c = (d: number) => Math.cos(rad(d))
  const s = (d: number) => Math.sin(rad(d))
  const h = LEN.thigh * c(nearT.o) * s(nearT.a) + LEN.shin * c(nearS.o) * s(nearS.a)
  const oFar = (Math.acos(h / (LEN.thigh + LEN.shin)) * 180) / Math.PI
  const zNear = LEN.hipHalf + LEN.thigh * s(nearT.o) + LEN.shin * s(nearS.o)
  const zFar = LEN.hipHalf + (LEN.thigh + LEN.shin) * s(oFar)
  const mid = (zNear - zFar) / 2
  const half = (zNear + zFar) / 2
  const oStand = (Math.asin((half - LEN.hipHalf) / (LEN.thigh + LEN.shin)) * 180) / Math.PI
  const hand = (hip: Vec2): LimbSpec => ({ to: [hip[0] + 34, hip[1] - 44], zw: 0, splay: 20 })
  const standHip: Vec2 = [200 + mid, AY - (LEN.thigh + LEN.shin) * c(oStand)]
  const lungeHip: Vec2 = [200, AY - h]
  return {
    stand: {
      hip: standHip,
      torso: -90,
      arm: hand(standHip),
      leg: { a: [90, 90], out: [oStand, oStand] },
      legFar: { a: [90, 90], out: [oStand, oStand] },
    },
    lunge: {
      hip: lungeHip,
      torso: -80,
      lean: 10,
      arm: hand(lungeHip),
      leg: { a: [nearT.a, nearS.a], out: [nearT.o, nearS.o] },
      legFar: { a: [90, 90], out: [oFar, oFar] },
    },
  }
}
const SL = sideLungeLegs()
export const sideLunge: FigureDef = {
  view: 'front',
  poses: { stand: SL.stand, lunge: SL.lunge },
  timeline: loop('stand', 'lunge', 'ba'),
  peak: 'lunge',
}

// Abduktoren-/Adduktorenmaschine (Frontansicht, sitzend).
const AB_HIP: Vec2 = [200, 196]
const abPose = (o: number): PoseSpec => ({
  hip: AB_HIP,
  torso: -90,
  arm: { a: [84, 96], out: [26, 14] },
  leg: { a: [6, 90], out: [o, 4] },
})
const abProps: PropSpec[] = [{ kind: 'seat', x: 172, w: 56, top: 206, back: 100 }]
export const hipAbduction: FigureDef = {
  view: 'front',
  poses: { closed: abPose(10), open: abPose(46) },
  timeline: loop('closed', 'open', 'ab'),
  peak: 'open',
  props: abProps,
}
export const hipAdduction: FigureDef = { ...hipAbduction, timeline: loop('open', 'closed', 'ab'), peak: 'closed' }

// Wadenheben sitzend: Knie unter dem Polster, Ferse hebt.
const SCR_HIP: Vec2 = [170, 194]
const scrPose = (footA: number): PoseSpec => {
  const ankle = ankleOnToes(244, footA)
  const knee: Vec2 = [ankle[0] - 2, ankle[1] - LEN.shin]
  return {
    hip: SCR_HIP,
    torso: -86,
    arm: { to: add(knee, -6, -10), z: 20, pole: 90 },
    leg: { to: ankle, pole: -60 },
    foot: footA,
  }
}
export const seatedCalfRaise: FigureDef = {
  poses: { down: scrPose(-6), up: scrPose(32) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'seat', x: 124, w: 80, top: 204 },
    { kind: 'dumbbell', one: true },
  ],
}

// Good Morning: Langhantel im Nacken, Hüfte schiebt nach hinten.
const GM_HIP: Vec2 = [164, 156]
export const goodMorning: FigureDef = {
  poses: {
    top: { hip: sqTop, torso: -88, arm: { to: backBar(sqTop, -88) }, leg: planted(SQ_ANKLE) },
    hinge: { hip: GM_HIP, torso: -14, head: -24, arm: { to: backBar(GM_HIP, -14) }, leg: planted(SQ_ANKLE) },
  },
  timeline: loop('top', 'hinge', 'ba'),
  peak: 'hinge',
  props: [{ kind: 'barbell' }],
}

// Rückenstrecker an der 45°-Bank: Beine fest, Rumpf beugt um die Hüfte.
const BE_HIP: Vec2 = [214, 148]
const BE_LEG = 135
const BE_ANK = at(BE_HIP, BE_LEG, LEN.thigh + LEN.shin)
const bePose = (torso: number, bend = 0): PoseSpec => ({
  hip: BE_HIP,
  torso,
  bend,
  head: bend ? 10 : -6,
  arm: { to: onTorso(BE_HIP, torso, 46, 17, bend), z: 10, pole: torso + 120, splay: 50 },
  leg: { a: [BE_LEG, BE_LEG] },
  foot: BE_LEG - 90 + 10,
})
const BE_PADN = at([0, 0], BE_LEG - 90, 15)
export const backExtension: FigureDef = {
  poses: { down: bePose(70, 10), up: bePose(-48) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    {
      kind: 'pad',
      from: add(at(BE_HIP, BE_LEG, 4), BE_PADN[0], BE_PADN[1]),
      to: add(at(BE_HIP, BE_LEG, 50), BE_PADN[0], BE_PADN[1]),
      w: 14,
      post: 196,
    },
    { kind: 'pad', from: add(BE_ANK, 10, 12), to: add(BE_ANK, 18, 4), w: 11 },
  ],
}

// Reverse Hyperextension: bäuchlings auf hoher Bank, Beine schwingen nach hinten hoch.
const RH_HIP: Vec2 = [160, 136]
const rhPose = (legA: number): PoseSpec => ({
  hip: RH_HIP,
  torso: -2,
  head: -10,
  arm: { to: [262, 152], z: 22, pole: 60 },
  leg: { a: [legA, legA] },
  foot: legA - 80,
})
export const reverseHyper: FigureDef = {
  poses: { down: rhPose(96), up: rhPose(182) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'pad', from: [160, 149], to: [276, 149], w: 15, post: 250 }],
}

// Kniend (Knie am Boden, Unterschenkel nach hinten): Oberschenkelwinkel → Hüfte.
const KNEE_X = 196
const KNEE: Vec2 = [KNEE_X, FLOOR - 8]
const kneelHip = (thighA: number, knee: Vec2 = KNEE): Vec2 => at(knee, thighA + 180, LEN.thigh)

// Nordic Curl / Glute-Ham-Raise: Körper kippt als Linie um die Knie nach vorn.
const nordicPose = (thighA: number, arm: Vec2): PoseSpec => ({
  hip: kneelHip(thighA),
  torso: thighA - 180,
  head: -6,
  arm: { a: arm },
  leg: { a: [thighA, 180] },
  foot: 92,
})
export const nordicCurl: FigureDef = {
  duration: 3600,
  poses: {
    top: nordicPose(90, [92, 20]),
    mid: nordicPose(116, [80, 30]),
    low: nordicPose(142, [64, 46]),
  },
  timeline: via('top', 'mid', 'low', 'ba'),
  peak: 'low',
  props: [
    { kind: 'mat', x: 90, w: 240 },
    { kind: 'pad', from: [KNEE_X - 52, FLOOR - 22], to: [KNEE_X - 40, FLOOR - 22], w: 10 },
  ],
}

// Rudern auf der Schrägbank (bäuchlings, Brust auf dem Polster).
const CSR_HIP: Vec2 = [176, 184]
const CSR_T = -38
const CSR_SH = shoulder(CSR_HIP, CSR_T)
const csrPose = (arm: LimbSpec): PoseSpec => ({
  hip: CSR_HIP,
  torso: CSR_T,
  head: -6,
  arm,
  leg: { to: [106, AY], pole: 40 },
  legFar: { to: [114, AY], pole: 40 },
})
const CSR_N = at([0, 0], CSR_T + 90, 17)
export const chestSupportedRow: FigureDef = {
  poses: {
    down: csrPose({ to: add(CSR_SH, 6, 78), z: 26 }),
    up: csrPose({ to: onTorso(CSR_HIP, CSR_T, 24, 22), z: 28, pole: -150, splay: 25 }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    {
      kind: 'pad',
      from: add(at(CSR_HIP, CSR_T, 6), CSR_N[0], CSR_N[1]),
      to: add(at(CSR_HIP, CSR_T, 56), CSR_N[0], CSR_N[1]),
      w: 15,
      post: 200,
    },
    { kind: 'dumbbell' },
  ],
}

// Überzüge am Kabel (gestreckte Arme von oben zu den Oberschenkeln).
const SAP_HIP: Vec2 = [190, HIP + 2]
export const straightArmPulldown: FigureDef = {
  poses: {
    up: standing({ a: [-34, -38] }, { hip: SAP_HIP, torso: -72, head: -6, leg: planted(212) }),
    down: standing({ a: [84, 82] }, { hip: SAP_HIP, torso: -72, head: -6, leg: planted(212) }),
  },
  timeline: loop('up', 'down', 'ab'),
  peak: 'down',
  props: [{ kind: 'cable', from: [300, 34], column: 330, handle: 'bar' }],
}

// Inverted Row: rücklings unter der Stange, Körper gestreckt (Kopf links → gespiegelt).
const IR_ANKLE: Vec2 = [302, AY - 2]
const IR_TOP = 34
const irShoulder = (ang: number) => at(IR_ANKLE, 180 + ang, LEN.thigh + LEN.shin + SHOULDER_S)
// Stange knapp über der Brust in der oberen Position.
const IR_BAR: Vec2 = at(irShoulder(IR_TOP), 270 + IR_TOP, 26)
function irPose(dist: number): PoseSpec {
  // Körperwinkel (unterhalb der oberen Position) so wählen, dass die Schulter `dist` unter der Stange liegt.
  let lo = 0
  let hi = IR_TOP
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    const sh = irShoulder(m)
    if (Math.hypot(sh[0] - IR_BAR[0], sh[1] - IR_BAR[1]) > dist) lo = m
    else hi = m
  }
  const ang = (lo + hi) / 2
  const hip = at(IR_ANKLE, 180 + ang, LEN.thigh + LEN.shin)
  return {
    hip,
    torso: 180 + ang,
    head: 8,
    arm: { to: IR_BAR, z: 30, pole: 90, splay: 50 },
    leg: { a: [ang, ang] },
    foot: ang - 80,
  }
}
export const invertedRow: FigureDef = {
  mirror: true,
  poses: { hang: irPose(78), top: irPose(27) },
  timeline: loop('hang', 'top', 'ab'),
  peak: 'top',
  props: [{ kind: 'pullupBar', x: IR_BAR[0], y: IR_BAR[1], post: -40 }],
}

// --- Arme ----------------------------------------------------------------------

// Scott-Curls: Oberarme liegen schräg auf dem Polster.
const PC_HIP: Vec2 = [168, 196]
const PC_T = -82
const PC_SH = shoulder(PC_HIP, PC_T)
const PC_UA = 48
const PC_ELB = at(PC_SH, PC_UA, LEN.upperArm)
const PC_N = at([0, 0], PC_UA + 90, 9)
const pcPose = (fore: number): PoseSpec => ({
  hip: PC_HIP,
  torso: PC_T,
  head: 8,
  arm: { a: [PC_UA, fore] },
  leg: planted(234, -20),
})
export const preacherCurl: FigureDef = {
  poses: { down: pcPose(78), up: pcPose(-70) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'seat', x: 128, w: 70, top: 206 },
    {
      kind: 'pad',
      from: add(at(PC_SH, PC_UA, 12), PC_N[0], PC_N[1]),
      to: add(PC_ELB, PC_N[0] + 2, PC_N[1] + 4),
      w: 15,
      post: 222,
    },
    { kind: 'barbell', plate: 22 },
  ],
}

// Konzentrationscurl: sitzend vorgebeugt, Ellbogen am Oberschenkel.
const CC_HIP: Vec2 = [168, 196]
const CC_T = -52
const ccPose = (a: Vec2): PoseSpec => ({
  hip: CC_HIP,
  torso: CC_T,
  head: -14,
  arm: { a },
  armFar: { to: [236, 196], z: 26, pole: 60 },
  leg: planted(244, -20),
  legFar: planted(236, -20),
})
export const concentrationCurl: FigureDef = {
  poses: { down: ccPose([96, 92]), up: ccPose([98, -56]) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'seat', x: 120, w: 76, top: 206 },
    { kind: 'dumbbell', one: true },
  ],
}

// Schrägbank-Curls: Rücken an der Lehne (60°), Arme hängen hinter dem Körper.
const IC_T = 236
const icBase = (a: Vec2): PoseSpec => ({
  hip: INC_HIP,
  torso: IC_T,
  head: 2,
  arm: { a },
  leg: { to: [326, AY], pole: -60 },
  legFar: { to: [316, AY], pole: -60 },
})
export const inclineCurl: FigureDef = {
  mirror: true,
  poses: { down: icBase([92, 90]), up: icBase([94, -58]) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'incline', x: 250, angle: 56 }, { kind: 'dumbbell' }],
}

// Bankdips: Hände hinter dem Körper auf der Bank, Fersen am Boden.
const BD_HAND: Vec2 = [150, 206]
const bdPose = (sh: Vec2, torso: number): PoseSpec => ({
  hip: at(sh, torso + 180, SHOULDER_S),
  torso,
  head: 2,
  arm: { to: BD_HAND, z: 22, pole: 180, splay: 10 },
  leg: { to: [236, AY], pole: -90 },
  foot: -30,
})
export const benchDips: FigureDef = {
  poses: {
    top: bdPose(add(BD_HAND, 6, -79), -86),
    bottom: bdPose(add(BD_HAND, 14, -42), -80),
  },
  timeline: loop('top', 'bottom', 'ba'),
  peak: 'bottom',
  props: [{ kind: 'bench', x: 60, w: 100, top: 210 }],
}

// Handgelenkcurls: Unterarme auf den Oberschenkeln, nur die Hand bewegt sich.
const WC_HIP: Vec2 = [168, 196]
const wcPose = (handY: number): PoseSpec => ({
  hip: WC_HIP,
  torso: -62,
  head: -12,
  arm: { to: [246, handY], z: 16, pole: 100, splay: 10 },
  leg: planted(240, -20),
})
export const wristCurl: FigureDef = {
  duration: 2400,
  poses: { down: wcPose(204), up: wcPose(184) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [
    { kind: 'seat', x: 118, w: 80, top: 206 },
    { kind: 'barbell', plate: 18 },
  ],
}

// --- Rumpf ---------------------------------------------------------------------

// Kabel-Crunch kniend: Seil am Kopf, Rumpf rollt ein.
const CCR_HIP = kneelHip(90)
function cableCrunchPose(torso: number, bend: number): PoseSpec {
  const h = headOf(CCR_HIP, torso, bend, 10)
  const hand = at(at(h.c, h.a + 90, 13), h.a, 2)
  return {
    hip: CCR_HIP,
    torso,
    bend,
    head: 10,
    arm: { to: hand, z: 10, pole: torso + bend + 90, splay: 30 },
    leg: { a: [90, 180] },
    foot: 92,
  }
}
export const cableCrunch: FigureDef = {
  poses: { up: cableCrunchPose(-62, 0), down: cableCrunchPose(-34, 44) },
  timeline: loop('up', 'down', 'ab'),
  peak: 'down',
  props: [
    { kind: 'mat', x: 100, w: 220 },
    { kind: 'cable', from: [262, 34], column: 330, handle: 'rope' },
  ],
}

// Rückenlage auf der Matte (Kopf links): Hüftmitte am Boden.
const SUP_HIP: Vec2 = [214, FLOOR - 13]
const SUP_SH: Vec2 = at(SUP_HIP, 180, SHOULDER_S)

// Reverse Crunch: Knie zur Brust, Becken rollt ein.
function revCrunchPose(lift: number, legs: Vec2): PoseSpec {
  const hip: Vec2 = [SUP_HIP[0] - lift * 0.5, SUP_HIP[1] - lift]
  const torso = (Math.atan2(SUP_SH[1] - hip[1], SUP_SH[0] - hip[0]) * 180) / Math.PI
  return { hip, torso, head: 6, arm: { a: [2, 0] }, leg: { a: legs } }
}
export const reverseCrunch: FigureDef = {
  poses: { down: revCrunchPose(0, [-74, 6]), up: revCrunchPose(14, [-128, -40]) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 70, w: 250 }],
}

// Beinheben liegend: gestreckte Beine bis senkrecht.
const supLegs = (a: number, far = a, extra: Partial<PoseSpec> = {}): PoseSpec => ({
  hip: SUP_HIP,
  torso: 180,
  head: 6,
  arm: { a: [2, 0] },
  leg: { a: [a, a] },
  legFar: { a: [far, far] },
  ...extra,
})
export const lyingLegRaise: FigureDef = {
  poses: { down: supLegs(-8), up: supLegs(-88) },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 70, w: 270 }],
}
export const flutterKick: FigureDef = {
  duration: 900,
  poses: { a: supLegs(-14, -34, { bend: 10, head: 14 }), b: supLegs(-34, -14, { bend: 10, head: 14 }) },
  timeline: swing('a', 'b'),
  peak: 'a',
  props: [{ kind: 'mat', x: 70, w: 270 }],
}

// Dead Bug: Arme senkrecht, Beine 90/90; Gegenarm und -bein strecken sich.
const dbugPose = (armN: number, armF: number, legN: Vec2, legF: Vec2): PoseSpec => ({
  hip: SUP_HIP,
  torso: 180,
  head: 8,
  arm: { a: [armN, armN] },
  armFar: { a: [armF, armF] },
  leg: { a: legN },
  legFar: { a: legF },
})
const DB_LEG: Vec2 = [-90, 0]
export const deadBug: FigureDef = {
  duration: 3600,
  poses: {
    rest: dbugPose(-90, -90, DB_LEG, DB_LEG),
    a: dbugPose(-176, -90, DB_LEG, [-10, -10]),
    b: dbugPose(-90, -176, [-10, -10], DB_LEG),
  },
  timeline: [
    { at: 0, pose: 'rest' },
    { at: 0.22, pose: 'a' },
    { at: 0.28, pose: 'a' },
    { at: 0.5, pose: 'rest', c: true },
    { at: 0.72, pose: 'b' },
    { at: 0.78, pose: 'b' },
    { at: 1, pose: 'rest', c: true },
  ],
  peak: 'a',
  props: [{ kind: 'mat', x: 70, w: 270 }],
}

// Rollout (Ab-Roller) kniend.
const roPose = (thighA: number, torso: number, hand: Vec2, head = -8): PoseSpec => ({
  hip: kneelHip(thighA, [150, FLOOR - 8]),
  torso,
  head,
  arm: { to: hand, z: 14, pole: 0 },
  leg: { a: [thighA, 180] },
  foot: 92,
})
export const abRollout: FigureDef = {
  poses: {
    in: roPose(104, -24, [222, FLOOR - 11], -14),
    mid: roPose(132, -14, [270, FLOOR - 11]),
    out: roPose(160, -6, [330, FLOOR - 11]),
  },
  timeline: via('in', 'mid', 'out', 'ba'),
  peak: 'out',
  props: [
    { kind: 'mat', x: 80, w: 280 },
    { kind: 'dumbbell', one: true },
  ],
}

// Seitbeugen (Frontansicht) mit Kurzhantel.
const sbPose = (lean: number): PoseSpec => ({
  hip: ST_HIP,
  torso: -90,
  lean,
  arm: { a: [90, 90], out: [6, 4] },
  armFar: { to: [ST_HIP[0], ST_HIP[1] - 4], zw: -16, pole: 0, splay: 90 },
  leg: SH_LEGS,
})
export const sideBend: FigureDef = {
  view: 'front',
  poses: { up: sbPose(-6), down: sbPose(24) },
  timeline: loop('up', 'down', 'ba'),
  peak: 'down',
  props: [{ kind: 'dumbbell', one: true }],
}

// Pallof Press: Kabel kommt von der Seite, Hände drücken vor die Brust und halten.
export const pallofPress: FigureDef = {
  poses: {
    chest: standing(
      { to: add(ST_SH, 16, 18), z: 4, pole: 150, splay: 50 },
      { leg: planted(214), legFar: planted(186) },
    ),
    out: standing({ to: add(ST_SH, 74, 16), z: 4, pole: 100, splay: 30 }, { leg: planted(214), legFar: planted(186) }),
  },
  timeline: loop('chest', 'out', 'ab', [0.08, 0.26]),
  peak: 'out',
  props: [{ kind: 'cable', from: [184, 104], column: 176, handle: 'handle', layer: 'far' }],
}

// Holzhacker (Frontansicht): Hände diagonal von oben außen nach unten innen.
const WC_LEGS: LimbSpec = { a: [90, 90], out: [10, 10] }
const wcHip: Vec2 = [200, HIP + 3]
export const woodChop: FigureDef = {
  view: 'front',
  poses: {
    high: { hip: wcHip, torso: -90, twist: 20, head: -4, arm: { to: [228, 54], zw: 50, splay: 20 }, leg: WC_LEGS },
    low: {
      hip: wcHip,
      torso: -84,
      twist: -30,
      head: 6,
      lean: -8,
      arm: { to: [222, 152], zw: -34, splay: 20 },
      leg: WC_LEGS,
    },
  },
  timeline: loop('high', 'low', 'ab'),
  peak: 'low',
  props: [{ kind: 'cable', from: [330, 34], handle: 'handle' }],
}

// Ball Slam: Ball über Kopf, kraftvoll vor die Füße schmettern.
const BS_HINGE: Vec2 = [172, 166]
export const ballSlam: FigureDef = {
  zoom: 0.86,
  duration: 1800,
  poses: {
    over: { hip: [200, HIP - 2], torso: -92, head: -6, arm: { a: [-96, -100] }, leg: planted(210), foot: 0 },
    slam: { hip: BS_HINGE, torso: -30, head: -20, arm: { a: [70, 80] }, leg: planted(210, -30) },
  },
  timeline: [
    { at: 0, pose: 'over' },
    { at: 0.2, pose: 'over' },
    { at: 0.38, pose: 'slam', c: true },
    { at: 0.5, pose: 'slam' },
    { at: 0.9, pose: 'over' },
    { at: 1, pose: 'over' },
  ],
  peak: 'slam',
  props: [{ kind: 'ball', r: 15 }],
}

// Box Jump: aus der Hocke auf die Box springen.
const BJ_BOX = 60
const BJ_BOT = hipFromAnkle([170, AY], 18, 112)
const BJ_LAND = hipFromAnkle([262, AY - BJ_BOX], 18, 112)
export const boxJump: FigureDef = {
  duration: 2600,
  poses: {
    bottom: { hip: BJ_BOT, torso: -50, head: -16, arm: { a: [110, 70] }, leg: { a: [18, 112] }, foot: 0 },
    air: { hip: [222, 118], torso: -70, head: -6, arm: { a: [-40, -60] }, leg: { a: [10, 100] }, foot: 10 },
    land: { hip: BJ_LAND, torso: -54, head: -14, arm: { a: [20, 0] }, leg: { a: [18, 112] }, foot: 0 },
    top: { hip: [258, HIP - BJ_BOX], torso: -88, arm: { a: [92, 90] }, leg: { a: [92, 92] }, foot: 0 },
    step: { hip: [200, HIP - 12], torso: -88, arm: { a: [92, 90] }, leg: { a: [86, 92] }, foot: 0 },
  },
  timeline: [
    { at: 0, pose: 'bottom' },
    { at: 0.08, pose: 'bottom' },
    { at: 0.22, pose: 'air', c: true },
    { at: 0.34, pose: 'land' },
    { at: 0.5, pose: 'top', c: true },
    { at: 0.6, pose: 'top' },
    { at: 0.76, pose: 'step' },
    { at: 0.92, pose: 'bottom' },
    { at: 1, pose: 'bottom' },
  ],
  peak: 'air',
  props: [{ kind: 'box', x: 226, w: 86, h: BJ_BOX }],
}

// Klappmesser (V-Up): Arme und Beine treffen sich über der Hüfte.
const VU_HIP: Vec2 = [206, FLOOR - 13]
export const vUp: FigureDef = {
  poses: {
    flat: { hip: VU_HIP, torso: 180, head: 4, arm: { a: [182, 182] }, leg: { a: [-4, -4] } },
    v: { hip: VU_HIP, torso: 234, head: 18, arm: { a: [298, 300] }, leg: { a: [-50, -50] } },
  },
  timeline: loop('flat', 'v', 'ab'),
  peak: 'v',
  props: [{ kind: 'mat', x: 60, w: 280 }],
}

// Windmühle (Frontansicht): Kettlebell über Kopf, Rumpf neigt zur Gegenseite.
const WM_LEGS: LimbSpec = { a: [90, 90], out: [12, 12] }
export const windmill: FigureDef = {
  view: 'front',
  zoom: 0.86,
  poses: {
    up: {
      hip: ST_HIP,
      torso: -90,
      arm: { a: [-90, -90], out: [4, 4] },
      armFar: { a: [90, 90], out: [8, 8] },
      leg: WM_LEGS,
    },
    down: {
      hip: ST_HIP,
      torso: -64,
      lean: -40,
      head: 10,
      arm: { a: [-90, -90], out: [-2, -2] },
      armFar: { a: [90, 90], out: [-20, -20] },
      leg: WM_LEGS,
    },
  },
  timeline: loop('up', 'down', 'ba'),
  peak: 'down',
  props: [{ kind: 'kettlebell', along: true }],
}

// Nacken: sitzend, Kopf beugt und streckt gegen den Widerstand der Hände.
function neckPose(head: number): PoseSpec {
  const h = headOf(SEAT_HIP, -90, 0, head)
  return seated({ to: at(at(h.c, h.a + 90, 12), h.a, 4), z: 8, pole: -40, splay: 60 }, { head })
}
export const neck: FigureDef = {
  duration: 3000,
  poses: { back: neckPose(-24), fwd: neckPose(26) },
  timeline: loop('back', 'fwd', 'ab'),
  peak: 'fwd',
  props: [{ kind: 'seat', x: 150, w: 70, top: 203 }],
}

// --- Halten, Tragen, Mobilität ----------------------------------------------------

const hold = (): TimelineKey[] => [
  { at: 0, pose: 'a' },
  { at: 0.5, pose: 'b', c: true },
  { at: 1, pose: 'a', c: true },
]

// Farmer Walk: Gehen mit schweren Kurzhanteln.
const FW_HIP: Vec2 = [200, AY - 105]
const fwPose = (near: Vec2, far: Vec2, fn: number, ff: number): PoseSpec => ({
  hip: FW_HIP,
  torso: -90,
  arm: { a: [90, 90] },
  leg: { a: near },
  legFar: { a: far },
  foot: fn,
  footFar: ff,
})
export const farmerWalk: FigureDef = {
  duration: 1100,
  poses: { a: fwPose([72, 96], [108, 100], -4, 22), b: fwPose([108, 100], [72, 96], 22, -4) },
  timeline: swing('a', 'b'),
  peak: 'a',
  props: [{ kind: 'dumbbell' }],
}

// Passives Hängen an der Stange.
export const deadHang: FigureDef = {
  duration: 3600,
  poses: {
    a: hangPose(add(BAR, -2, 79), -92, { a: [96, 164] }, { legFar: { a: [92, 168] } }),
    b: hangPose(add(BAR, -2, 79), -91, { a: [95, 165] }, { legFar: { a: [91, 168] }, head: 3 }),
  },
  timeline: hold(),
  peak: 'a',
  props: [{ kind: 'pullupBar', x: BAR[0], y: BAR[1] }],
}

// Hollow Body Hold: Rückenlage, Arme über Kopf, Beine knapp über dem Boden.
const hollowPose = (legs: number, bend: number): PoseSpec => ({
  hip: SUP_HIP,
  torso: 180,
  bend,
  head: 12,
  arm: { a: [192, 192] },
  leg: { a: [legs, legs] },
})
export const hollowHold: FigureDef = {
  duration: 3600,
  poses: { a: hollowPose(-14, 20), b: hollowPose(-16, 22) },
  timeline: hold(),
  peak: 'a',
  props: [{ kind: 'mat', x: 50, w: 300 }],
}

// Bird Dog: Vierfüßlerstand, Gegenarm und -bein strecken.
const GK_SH = shoulder(GK_HIP, GK_T)
const GK_REACH: Vec2 = add(GK_SH, 80, -6)
const KNEEL_LEG: LimbSpec = { a: [92, 180] }
const bdPoseQ = (armN: Vec2, armF: Vec2, legN: LimbSpec, legF: LimbSpec): PoseSpec => ({
  hip: GK_HIP,
  torso: GK_T,
  head: -8,
  arm: { to: armN, z: 18 },
  armFar: { to: armF, z: 18 },
  leg: legN,
  legFar: legF,
  foot: 180,
  footFar: 180,
})
export const birdDog: FigureDef = {
  duration: 4000,
  poses: {
    rest: bdPoseQ(GK_HAND, GK_HAND, KNEEL_LEG, { a: [90, 180] }),
    a: bdPoseQ(GK_HAND, GK_REACH, { a: [184, 184] }, { a: [90, 180] }),
    b: bdPoseQ(GK_REACH, GK_HAND, KNEEL_LEG, { a: [184, 184] }),
  },
  timeline: [
    { at: 0, pose: 'rest' },
    { at: 0.2, pose: 'a', c: true },
    { at: 0.3, pose: 'a' },
    { at: 0.5, pose: 'rest' },
    { at: 0.7, pose: 'b', c: true },
    { at: 0.8, pose: 'b' },
    { at: 1, pose: 'rest' },
  ],
  peak: 'a',
  props: [{ kind: 'mat', x: 70, w: 240 }],
}

// Katze-Kuh: Wirbelsäule rundet und streckt sich im Vierfüßlerstand.
const ccQ = (bend: number, head: number): PoseSpec => ({
  hip: GK_HIP,
  torso: GK_T,
  bend,
  head,
  arm: { to: GK_HAND, z: 18 },
  leg: KNEEL_LEG,
  legFar: { a: [90, 180] },
  foot: 180,
  footFar: 180,
})
export const catCow: FigureDef = {
  duration: 4000,
  poses: { cat: ccQ(18, 24), cow: ccQ(-16, -26) },
  timeline: loop('cat', 'cow', 'ab', [0.1, 0.14]),
  peak: 'cat',
  props: [{ kind: 'mat', x: 70, w: 240 }],
}

// Tiefe Hocke halten (Hände vor der Brust, Ellbogen drücken die Knie).
const DSQ_HIP: Vec2 = [174, 214]
const dsqPose = (t: number): PoseSpec => ({
  hip: DSQ_HIP,
  torso: t,
  head: -10,
  arm: { to: onTorso(DSQ_HIP, t, 48, 22), z: 4, pole: 70, splay: 70 },
  leg: planted(SQ_ANKLE),
})
export const deepSquatHold: FigureDef = {
  duration: 3600,
  poses: { a: dsqPose(-66), b: dsqPose(-70) },
  timeline: hold(),
  peak: 'a',
}

// Dehnung im Halbkniestand (Hüftbeuger/Couch-Stretch): Hüfte schiebt nach vorn.
const LS_KNEE: Vec2 = [150, FLOOR - 8]
const lsPose = (thighA: number): PoseSpec => {
  const hip = kneelHip(thighA, LS_KNEE)
  return {
    hip,
    torso: -90,
    arm: handsOnHips(hip, -90),
    leg: { to: [252, AY], pole: -40 },
    legFar: { a: [thighA, 180] },
    footFar: 92,
  }
}
export const lungeStretch: FigureDef = {
  duration: 4000,
  poses: { back: lsPose(98), fwd: lsPose(124) },
  timeline: loop('back', 'fwd', 'ab', [0.1, 0.22]),
  peak: 'fwd',
  props: [{ kind: 'mat', x: 90, w: 220 }],
}

// Schlitten schieben: Körper schräg, Arme an den Stangen, Beine treiben.
const SLD_HIP: Vec2 = [170, AY - 88.5]
const SLD_GRIP: Vec2 = [264, 150]
const sldPose = (near: Vec2, far: Vec2): PoseSpec => ({
  hip: SLD_HIP,
  torso: -38,
  head: -10,
  arm: { to: SLD_GRIP, z: 22 },
  leg: { a: near },
  legFar: { a: far },
  foot: 10,
  footFar: 30,
})
export const sledPush: FigureDef = {
  duration: 1200,
  poses: { a: sldPose([40, 110], [125, 125]), b: sldPose([125, 125], [40, 110]) },
  timeline: swing('a', 'b'),
  peak: 'a',
  props: [
    { kind: 'pad', from: [268, 146], to: [268, 228], w: 8 },
    { kind: 'box', x: 262, w: 76, h: 36 },
  ],
}

// Seilspringen / Pogo-Sprünge: kleine Sprünge auf den Fußballen.
export const jumpRope: FigureDef = {
  duration: 600,
  poses: {
    ground: { hip: [200, HIP + 2], torso: -88, arm: { a: [80, 30] }, leg: { a: [86, 94] }, foot: 8 },
    air: { hip: [200, HIP - 12], torso: -89, arm: { a: [84, 34] }, leg: { a: [90, 92] }, foot: 42 },
  },
  timeline: swing('ground', 'air'),
  peak: 'air',
}

// Wall Slides / Dislocates (Frontansicht): Arme von „Torpfosten“ nach oben.
export const wallSlide: FigureDef = {
  view: 'front',
  zoom: 0.9,
  poses: {
    w: { hip: ST_HIP, torso: -90, arm: { a: [90, 90], out: [92, 180] }, leg: SH_LEGS },
    y: { hip: ST_HIP, torso: -90, arm: { a: [90, 90], out: [152, 168] }, leg: SH_LEGS },
  },
  timeline: loop('w', 'y', 'ab'),
  peak: 'y',
}

// Reverse Nordic: kniend, Körper kippt als Linie nach hinten.
export const reverseNordic: FigureDef = {
  duration: 3600,
  poses: {
    top: nordicPose(90, [30, 10]),
    mid: nordicPose(76, [24, 6]),
    low: nordicPose(62, [18, 2]),
  },
  timeline: via('top', 'mid', 'low', 'ba'),
  peak: 'low',
  props: [{ kind: 'mat', x: 90, w: 240 }],
}
