import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, X } from 'lucide-react'
import { enter } from './motion'

const KEY = 'rhythm_prompt_dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Kleiner Hinweis auf der Startseite, solange kein Trainingsrhythmus festgelegt ist. */
export function RhythmPrompt({ index }: { index: number }) {
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(isDismissed)
  if (hidden) return null

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  return (
    <section className="flex items-center gap-1 rounded-2xl bg-cream pr-1.5 ring-1 ring-sand-dark/40" style={enter(index)}>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
        onClick={() => navigate('/profile?s=rhythm')}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <CalendarDays size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Lege deinen Rhythmus fest</span>
          <span className="block truncate text-xs text-cocoa-light">Wochentage, Reihenfolge oder flexibel</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted active:bg-sand"
        onClick={dismiss}
        aria-label="Hinweis ausblenden"
      >
        <X size={16} />
      </button>
    </section>
  )
}
