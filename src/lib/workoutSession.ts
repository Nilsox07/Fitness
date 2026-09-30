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

/**
 * Was passiert, nachdem Satz Nr. `setIndex` einer Übung erledigt wurde?
 * - Ohne Supersatz: Pause starten, auf der Übung bleiben.
 * - Im Supersatz und der gleiche Satz der Partner-Übung ist noch offen:
 *   KEINE Pause, direkt zur Partner-Übung wechseln.
 * - Im Supersatz und die Runde ist komplett: Pause starten und zurück zur
 *   ersten Übung des Paares (nächste Runde).
 */
export function afterSetDone(opts: {
  exId: string
  setIndex: number
  pairs: Pair[]
  doneFlags: (exId: string) => boolean[]
}): { next: string | null; rest: boolean } {
  const pair = pairOf(opts.pairs, opts.exId)
  if (!pair) return { next: null, rest: true }
  const partner = pair[0] === opts.exId ? pair[1] : pair[0]
  const partnerDone = opts.doneFlags(partner)[opts.setIndex]
  if (partnerDone === false) return { next: partner, rest: false }
  // Runde komplett (oder Partner hat weniger Sätze)
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
