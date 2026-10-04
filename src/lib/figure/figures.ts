/**
 * Figuren-Definitionen (Posen + Zeitachse + Geräte) der Übungen.
 *
 * Konventionen: Seitenansicht, Figur blickt nach +x. Liegend auf dem Rücken
 * heißt Kopf links (Rumpf 180°); `mirror` dreht das Bild bei Bedarf.
 * Zielpunkte (TargetLimb) halten Hände/Füße fest, die Gelenke folgen per IK.
 */
import { ANKLE_H, FLOOR, LEN, STAND_HIP_Y, cycle, hipFromAnkle, rad, solvePose, swing } from './rig'
import type { FigureDef, LimbSpec, PoseSpec, Vec2 } from './types'

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
const standing = (arm: LimbSpec, extra: Partial<PoseSpec> = {}): PoseSpec => ({ hip: ST_HIP, torso: -90, arm, leg: STAND, ...extra })

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
  props: [{ kind: 'bench', x: 110, w: 180, top: 207 }, { kind: 'dumbbell', one: true }],
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
    hinge: { hip: RDL_HIP, torso: RDL_T, head: -16, arm: { to: add(shoulder(RDL_HIP, RDL_T), 3, 79), z: 24 }, leg: planted(DL_ANKLE) },
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
const gobletArm = (hip: Vec2, torso: number): LimbSpec => ({ to: onTorso(hip, torso, 48, 17), z: 8, pole: 90, splay: 20 })
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
const handsOnHips = (hip: Vec2, torso: number): LimbSpec => ({ to: onTorso(hip, torso, 6, 2), z: 22, pole: 180, splay: 60 })
const LU_FRONT = 252
const LU_BACK = ankleOnToes(150, 42)
const luTop: Vec2 = [198, 160]
const luBot: Vec2 = [194, 205]
export const lunge: FigureDef = {
  poses: {
    top: { hip: luTop, torso: -90, arm: handsOnHips(luTop, -90), leg: planted(LU_FRONT), legFar: { to: LU_BACK, pole: 0 }, footFar: 42 },
    bottom: { hip: luBot, torso: -88, arm: handsOnHips(luBot, -88), leg: planted(LU_FRONT), legFar: { to: LU_BACK, pole: 100 }, footFar: 42 },
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
    top: { hip: bssTop, torso: -86, arm: { a: [92, 90] }, leg: planted(244), legFar: { to: BSS_BACK, pole: 30 }, footFar: 196 },
    bottom: { hip: bssBot, torso: -80, head: -8, arm: { a: [94, 92] }, leg: planted(244), legFar: { to: BSS_BACK, pole: 110 }, footFar: 200 },
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
  props: [{ kind: 'bench', x: 56, w: 96, top: 196 }, { kind: 'barbell', plate: 30 }],
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
  props: [{ kind: 'bench', x: 140, w: 160 }, { kind: 'barbell', plate: 22 }],
}

export const overheadTriceps: FigureDef = {
  poses: {
    down: seated({ a: [-104, 112] }, { head: 4 }),
    up: seated({ a: [-98, -92] }),
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'down',
  props: [{ kind: 'seat', x: 150, w: 70, top: 203 }, { kind: 'dumbbell', one: true }],
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
    a: { hip: HK_HIP, torso: -86, arm: { a: [124, 44] }, armFar: { a: [52, -36] }, leg: { a: [-6, 84] }, legFar: { a: [92, 94] }, foot: -4, footFar: 20 },
    b: { hip: HK_HIP, torso: -86, arm: { a: [52, -36] }, armFar: { a: [124, 44] }, leg: { a: [92, 94] }, legFar: { a: [-6, 84] }, foot: 20, footFar: -4 },
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
    down: { hip: GK_HIP, torso: GK_T, head: -8, arm: { to: GK_HAND, z: 18 }, leg: { a: [92, 180] }, legFar: { a: [90, 180] }, foot: 180, footFar: 180 },
    up: { hip: GK_HIP, torso: GK_T, head: -8, arm: { to: GK_HAND, z: 18 }, leg: { a: [192, 268] }, legFar: { a: [90, 180] }, foot: 180, footFar: 180 },
  },
  timeline: loop('down', 'up', 'ab'),
  peak: 'up',
  props: [{ kind: 'mat', x: 70, w: 240 }],
}
