import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { aiActiveCount, subscribeAiActivity } from '../lib/aiActivity'
import { usePrefs } from '../lib/prefs'
import { MyBuddy } from './buddy/MyBuddy'

/** Global sichtbarer, animierter Indikator, solange KI-Anfragen laufen. */
export function AiActivityBar() {
  const [active, setActive] = useState(aiActiveCount())
  const [seconds, setSeconds] = useState(0)
  const { isNew } = usePrefs()

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

  // Neue App: schlanke Pille mit Buddy statt Funkeln
  if (isNew) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[env(safe-area-inset-top)]">
        <div
          className="anim-fade mt-2 flex items-center gap-2 rounded-full bg-cream/95 py-1 pl-1 pr-3.5 shadow-lg shadow-black/10 ring-1 ring-sand-dark/40 backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/10">
            <MyBuddy size={24} mood="focus" />
          </span>
          <span className="tabular text-xs font-semibold text-cocoa">
            Buddy denkt nach…
            {seconds >= 1 && <span className="ml-1 font-medium text-cocoa-muted">{seconds}s</span>}
          </span>
          {seconds >= 15 && <span className="text-xs text-cocoa-light">· dauert gerade länger</span>}
          <span className="ai-bar-track ml-1 h-1 w-10 shrink-0 rounded-full bg-sand-dark/40" />
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto max-w-md px-3 pt-[env(safe-area-inset-top)]">
      <div className="mt-2 flex items-center gap-2 rounded-full bg-cream/95 px-3 py-1.5 shadow-lg backdrop-blur">
        <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ruby border-t-transparent" />
        <span className="flex items-center gap-1.5 text-xs font-medium text-cocoa">
          <Sparkles size={14} className="shrink-0 text-cocoa-light" />
          <span className="tabular">
            KI arbeitet… {seconds >= 1 && `${seconds}s`}
          {seconds >= 15 && ' · dauert gerade länger'}
          </span>
        </span>
        <div className="ai-bar-track ml-auto h-1 w-16 shrink-0 rounded-full bg-sand-dark/40" />
      </div>
    </div>
  )
}
