import { useMutationState, useQueryClient } from '@tanstack/react-query'

/**
 * Globaler Speicher-Status. Zeigt an, wenn Schreibvorgänge laufen, offline
 * pausiert sind oder fehlgeschlagen sind — damit im Gym nie unbemerkt ein Satz
 * verloren geht. Liegt fix am oberen Rand über allen Seiten.
 */
export function SaveStatus() {
  const qc = useQueryClient()
  const states = useMutationState({
    select: (m) => ({ status: m.state.status, isPaused: m.state.isPaused }),
  })

  const failed = states.filter((s) => s.status === 'error').length
  const paused = states.filter((s) => s.isPaused).length
  const pending = states.filter((s) => s.status === 'pending' && !s.isPaused).length

  if (!failed && !paused && !pending) return null

  async function retry() {
    // Offline-pausierte fortsetzen …
    await qc.resumePausedMutations()
    // … und fehlgeschlagene erneut ausführen (best effort).
    const failedMutations = qc
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === 'error')
    await Promise.allSettled(
      failedMutations.map((m) => {
        try {
          return m.execute(m.state.variables)
        } catch {
          return Promise.resolve()
        }
      }),
    )
  }

  const base =
    'fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-1.5 text-xs font-medium'

  if (failed) {
    return (
      <div className={`${base} bg-red-600 text-white`} role="alert">
        <span>⚠️ Nicht gespeichert – Verbindung prüfen</span>
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-white/20 px-2 py-0.5 font-semibold"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  if (paused) {
    return (
      <div className={`${base} bg-amber-500 text-white`}>
        <span>📴 Offline – Sätze werden gesendet, sobald wieder Verbindung besteht</span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-brand/90 text-white`}>
      <span>💾 Speichert…</span>
    </div>
  )
}
