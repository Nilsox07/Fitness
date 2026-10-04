// Lokaler Zustand der laufenden Trainings-Session (pro Workout): Reihenfolge der
// Übungen in der Übungsleiste und Supersatz-Paare. Bewusst nur lokal — das ist
// reine Bedien-Info und muss nicht in die Datenbank.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

// ---- Reihenfolge der Übungen ---------------------------------------------

export function getOrder(workoutId: string): string[] {
  return read<string[]>(`wo_order_${workoutId}`, [])
}

export function appendOrder(workoutId: string, ids: string[]) {
  const cur = getOrder(workoutId)
  const next = [...cur, ...ids.filter((id) => !cur.includes(id))]
  write(`wo_order_${workoutId}`, next)
}

/** Sortiert die heutigen Übungs-IDs nach gespeicherter Reihenfolge (Rest hinten). */
export function sortByOrder(workoutId: string, ids: string[]): string[] {
  const order = getOrder(workoutId)
  const known = order.filter((id) => ids.includes(id))
  const rest = ids.filter((id) => !order.includes(id))
  return [...known, ...rest]
}

// ---- Aktiver Plan als Vorlage (Reihenfolge, nicht vorab angelegt) ----------

export interface PlanQueue {
  planId: string
  ids: string[]
}

export function getPlanQueue(workoutId: string): PlanQueue | null {
  return read<PlanQueue | null>(`wo_plan_${workoutId}`, null)
}

export function setPlanQueue(workoutId: string, q: PlanQueue | null) {
  write(`wo_plan_${workoutId}`, q)
}

// ---- Supersätze ------------------------------------------------------------

export type Pair = [string, string]

export function getPairs(workoutId: string): Pair[] {
  return read<Pair[]>(`wo_supersets_${workoutId}`, [])
}

export function setPairs(workoutId: string, pairs: Pair[]) {
  write(`wo_supersets_${workoutId}`, pairs)
}

export function pairOf(pairs: Pair[], exId: string): Pair | null {
  return pairs.find((p) => p[0] === exId || p[1] === exId) ?? null
}

export function partnerOf(pairs: Pair[], exId: string): string | null {
  const p = pairOf(pairs, exId)
  if (!p) return null
  return p[0] === exId ? p[1] : p[0]
}

export interface RoundSet {
  set_type: string
  done: boolean
}

/**
 * Wie vielte Satz seines Typs ist ein Satz? (0 = erster Aufwärm-/Arbeits-/Dropsatz)
 * `list` = alle Sätze der Übung in Reihenfolge.
 */
export function typeOccurrence<T extends { set_type: string }>(list: T[], index: number): number {
  const type = list[index]?.set_type
  return list.slice(0, Math.max(0, index)).filter((x) => x.set_type === type).length
}

/** Der Satz gleichen Typs an gleicher Position (k-ter Arbeitssatz ↔ k-ter Arbeitssatz). */
export function matchingSet<T extends { set_type: string }>(
  list: T[],
  setType: string,
  occurrence: number,
): T | undefined {
  return list.filter((x) => x.set_type === setType)[occurrence]
}

/**
 * Was passiert, nachdem ein Satz einer Übung erledigt wurde?
 * Runden werden nach Satz-Typ + Position innerhalb des Typs zugeordnet (wie die
 * Spalte „Vorher"): der 1. Arbeitssatz von A1 gehört zum 1. Arbeitssatz von A2 —
 * auch wenn nur eine der Übungen einen Aufwärmsatz hat.
 * - Ohne Supersatz: Pause starten, auf der Übung bleiben.
 * - Im Supersatz und der passende Satz der Partner-Übung ist noch offen:
 *   KEINE Pause, direkt zur Partner-Übung wechseln.
 * - Im Supersatz und die Runde ist komplett (oder der Partner hat keinen
 *   passenden Satz): Pause starten und zurück zur ersten Übung des Paares.
 */
export function afterSetDone(opts: {
  exId: string
  setType: string
  /** Position des Satzes innerhalb seines Typs (siehe typeOccurrence) */
  occurrence: number
  pairs: Pair[]
  setsOf: (exId: string) => RoundSet[]
}): { next: string | null; rest: boolean } {
  const pair = pairOf(opts.pairs, opts.exId)
  if (!pair) return { next: null, rest: true }
  const partner = pair[0] === opts.exId ? pair[1] : pair[0]
  const partnerSet = matchingSet(opts.setsOf(partner), opts.setType, opts.occurrence)
  if (partnerSet && !partnerSet.done) return { next: partner, rest: false }
  // Runde komplett (oder Partner hat weniger Sätze dieses Typs)
  return { next: pair[0] === opts.exId ? null : pair[0], rest: true }
}

// ---- Pausentimer-Modus -----------------------------------------------------

/**
 * 'auto'  = startet nach einem Satz — bei Supersätzen aber erst, wenn die
 *           Runde (beide Übungen) erledigt ist.
 * 'off'   = nur manuell.
 */
export type RestMode = 'auto' | 'off'

export function getRestMode(): RestMode {
  try {
    const m = localStorage.getItem('rest_mode')
    if (m === 'auto' || m === 'off') return m
    // Alte Einstellung übernehmen
    return localStorage.getItem('rest_auto') === '0' ? 'off' : 'auto'
  } catch {
    return 'auto'
  }
}

export function setRestMode(m: RestMode) {
  try {
    localStorage.setItem('rest_mode', m)
  } catch {
    /* ignore */
  }
}

export function getRestSeconds(): number {
  try {
    const v = Number(localStorage.getItem('rest_seconds'))
    return Number.isFinite(v) && v > 0 ? v : 120
  } catch {
    return 120
  }
}

export function setRestSeconds(sec: number) {
  try {
    localStorage.setItem('rest_seconds', String(sec))
  } catch {
    /* ignore */
  }
}

// ---- Pausenlänge nach Satztyp ----------------------------------------------

type SetKind = 'warmup' | 'working' | 'drop'

/**
 * Wie lange nach einem Satz pausieren?
 * - Vor einem Dropsatz: gar nicht (das ist der Sinn des Drops).
 * - Nach dem Aufwärmen: kurz (45 s bis zum nächsten Aufwärmsatz, max. 90 s vor dem ersten Arbeitssatz).
 * - Sonst: die eingestellte Pause (Übung oder global).
 */
export function restSecondsAfter(done: SetKind, next: SetKind | null, base: number): number {
  if (next === 'drop') return 0
  if (done === 'warmup') return next === 'warmup' ? Math.min(base, 45) : Math.min(base, 90)
  return base
}

/** Eigene Pause pro Übung (z. B. 3:00 bei Kniebeugen, 1:30 bei Curls); null = Standard. */
export function getExerciseRest(exId: string): number | null {
  try {
    const v = Number(localStorage.getItem(`rest_ex_${exId}`))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function setExerciseRest(exId: string, sec: number | null) {
  try {
    if (sec == null) localStorage.removeItem(`rest_ex_${exId}`)
    else localStorage.setItem(`rest_ex_${exId}`, String(sec))
  } catch {
    /* ignore */
  }
}
