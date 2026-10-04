import { useEffect, useState } from 'react'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CloudOff, Loader2 } from 'lucide-react'
import { MK } from '../lib/mutationDefaults'
import { usePrefs } from '../lib/prefs'

/** Nur die Trainings-Schreibvorgänge (Workout/Sätze) zählen — andere Mutationen
 *  (Likes, KI, Kudos …) sollen hier weder Fehler anzeigen noch erneut laufen. */
const TRACKED = new Set(Object.values(MK).map((k) => k.join('/')))

function isTracked(m: { options: { mutationKey?: readonly unknown[] } }): boolean {
  const key = m.options.mutationKey
  return Array.isArray(key) && TRACKED.has(key.join('/'))
}

/** Nach so vielen ms klappt ein Fehler-/Offline-Banner zur kleinen Pille zusammen. */
const COLLAPSE_MS = 6000

/**
 * Globaler Speicher-Status. Zeigt an, wenn Trainings-Schreibvorgänge laufen,
 * offline pausiert sind oder fehlgeschlagen sind — damit im Gym nie unbemerkt
 * ein Satz verloren geht. Fehler/Offline erscheinen zuerst als Banner und
 * klappen nach ein paar Sekunden zu einer kleinen Pille zusammen, damit die
 * obere Leiste bedienbar bleibt.
 */
export function SaveStatus() {
  const qc = useQueryClient()
  const { isNew } = usePrefs()
  const states = useMutationState({
    filters: { predicate: isTracked },
    select: (m) => ({ status: m.state.status, isPaused: m.state.isPaused }),
  })

  const failed = states.filter((s) => s.status === 'error').length
  const paused = states.filter((s) => s.isPaused).length
  const pending = states.filter((s) => s.status === 'pending' && !s.isPaused).length

  // Bei jeder Änderung an Fehlern/Offline kurz groß zeigen, dann einklappen.
  const [expanded, setExpanded] = useState(true)
  useEffect(() => {
    if (!failed && !paused) return
    setExpanded(true)
    const t = setTimeout(() => setExpanded(false), COLLAPSE_MS)
    return () => clearTimeout(t)
  }, [failed, paused])

  if (!failed && !paused && !pending) return null

  async function retry() {
    // Offline-pausierte fortsetzen …
    await qc.resumePausedMutations()
    // … und fehlgeschlagene Trainings-Schreibvorgänge erneut ausführen (best effort).
    const failedMutations = qc
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === 'error' && isTracked(m))
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

  if (isNew) {
    return <SaveStatusPill failed={failed} paused={paused} expanded={expanded} setExpanded={setExpanded} retry={retry} />
  }

  const base =
    'fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md items-center justify-between gap-2 px-4 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] text-xs font-medium'
  // Eingeklappt: kleine Pille UNTER der oberen Leiste (rechts), verdeckt nichts.
  const pill =
    'fixed right-4 top-[calc(env(safe-area-inset-top)+3.75rem)] z-30 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg'

  if (failed) {
    if (!expanded) {
      return (
        <button
          type="button"
          className={`${pill} bg-red-600 text-white`}
          onClick={() => setExpanded(true)}
          role="alert"
          aria-label="Nicht gespeichert – Details"
        >
          <AlertTriangle size={13} className="shrink-0" />
          Nicht gespeichert
        </button>
      )
    }
    return (
      <div className={`${base} bg-red-600 text-white`} role="alert">
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={14} className="shrink-0" />
          Nicht gespeichert – Verbindung prüfen
        </span>
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
    if (!expanded) {
      return (
        <button
          type="button"
          className={`${pill} bg-cocoa text-cream`}
          onClick={() => setExpanded(true)}
          aria-label="Offline – Details"
        >
          <CloudOff size={13} className="shrink-0" />
          Offline
        </button>
      )
    }
    return (
      <div className={`${base} bg-cocoa text-cream`}>
        <span className="flex items-center gap-1.5">
          <CloudOff size={14} className="shrink-0" />
          Offline – Sätze werden gesendet, sobald wieder Verbindung besteht
        </span>
      </div>
    )
  }

  return (
    <div className={`${base} bg-sand text-cocoa-light`}>
      <span className="flex items-center gap-1.5">
        <Loader2 size={14} className="shrink-0 animate-spin" />
        Speichert…
      </span>
    </div>
  )
}

/**
 * Neue App: schwebende Pille oben in der Mitte (wie die KI-Anzeige). Fehler/Offline
 * zeigen zuerst einen erklärenden Text und klappen dann zur kurzen Pille zusammen.
 */
function SaveStatusPill({
  failed,
  paused,
  expanded,
  setExpanded,
  retry,
}: {
  failed: number
  paused: number
  expanded: boolean
  setExpanded: (v: boolean) => void
  retry: () => Promise<void>
}) {
  const wrap =
    'pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-30 flex justify-center px-4'
  const pill =
    'anim-fade pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3 text-xs font-semibold shadow-lg shadow-black/10 backdrop-blur'

  if (failed) {
    return (
      <div className={wrap}>
        <div className={`${pill} bg-red-600 text-white`} role="alert">
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span className="truncate">{expanded ? 'Nicht gespeichert – Verbindung prüfen' : 'Nicht gespeichert'}</span>
          </button>
          <button
            type="button"
            onClick={() => void retry()}
            className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5"
          >
            Erneut
          </button>
        </div>
      </div>
    )
  }

  if (paused) {
    return (
      <div className={wrap}>
        <button
          type="button"
          className={`${pill} bg-cocoa text-bg`}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label="Offline – Details"
        >
          <CloudOff size={14} className="shrink-0" />
          <span className="truncate">
            {expanded ? 'Offline – Sätze werden gesendet, sobald du wieder online bist' : 'Offline'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={wrap}>
      <div className={`${pill} bg-cream/95 text-cocoa-light ring-1 ring-sand-dark/40`} role="status">
        <Loader2 size={14} className="shrink-0 animate-spin text-brand" />
        Speichert…
      </div>
    </div>
  )
}
