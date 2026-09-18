import { useEffect, useState } from 'react'
import { aiActiveCount, subscribeAiActivity } from '../lib/aiActivity'

/** Global sichtbarer, animierter Indikator, solange KI-Anfragen laufen. */
export function AiActivityBar() {
  const [active, setActive] = useState(aiActiveCount())
  const [seconds, setSeconds] = useState(0)

  useEffect(() => subscribeAiActivity(setActive), [])

  // Sekunden hochzählen, solange etwas läuft (zeigt: es hängt nicht).
  useEffect(() => {
    if (active === 0) {
      setSeconds(0)
      return
    }
    const start = Date.now()
    setSeconds(0)
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(id)
  }, [active])

  if (active === 0) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-md px-3 pt-[env(safe-area-inset-top)]">
      <div className="mt-2 flex items-center gap-2 rounded-full bg-cream/95 px-3 py-1.5 shadow-lg ring-1 ring-sand-dark backdrop-blur">
        <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ruby border-t-transparent" />
        <span className="text-xs font-medium text-cocoa">
          ✨ KI arbeitet… {seconds >= 1 && `${seconds}s`}
          {seconds >= 15 && ' · dauert gerade länger'}
        </span>
        <div className="ai-bar-track ml-auto h-1 w-16 shrink-0 rounded-full bg-sand-dark/40" />
      </div>
    </div>
  )
}
