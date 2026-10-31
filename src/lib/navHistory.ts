// Merkt sich, welche Seite an welcher Stelle im Browser-Verlauf liegt. So führt
// „Zurück“ dorthin, wo man wirklich herkam (z. B. Profil → Trainingsrhythmus → zurück
// ins Profil), statt stur zur Elternseite. Reine Logik – getestet in navHistory.test.ts.

export interface NavEntry {
  pathname: string
  search: string
}

const entries = new Map<number, NavEntry>()

/** Aktuelle Position im Verlauf (react-router speichert sie als history.state.idx). */
export function historyIndex(state: unknown = typeof window !== 'undefined' ? window.history.state : null): number {
  const idx = (state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : 0
}

export function recordNav(idx: number, e: NavEntry): void {
  entries.set(idx, e)
  // Alles danach ist durch eine neue Navigation ungültig geworden
  for (const k of entries.keys()) if (k > idx) entries.delete(k)
}

/** Vorherige Seite, falls sie eine andere ist als die aktuelle. */
export function previousNav(idx: number, current: NavEntry): NavEntry | null {
  const prev = entries.get(idx - 1)
  if (!prev) return null
  return prev.pathname === current.pathname && prev.search === current.search ? null : prev
}

export function _resetNav(): void {
  entries.clear()
}
