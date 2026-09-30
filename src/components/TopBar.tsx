import { useNavigate } from 'react-router-dom'
import { usePrefs, type World } from '../lib/prefs'
import { useAiStatus } from '../hooks/useAi'
import { Sparkles } from 'lucide-react'

function IconDumbbell({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 8v8M17.5 8v8M4 9.5v5M20 9.5v5M6.5 12h11" />
    </svg>
  )
}
function IconApple({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8c-1.5-2.5-5-2.2-6 0-1.2 2.6.4 8 3 10 1 .8 2 .8 3 0 2.6-2 4.2-7.4 3-10-1-2.2-4.5-2.5-6 0Z" />
      <path d="M12 8V5M12 5c0-1 .8-2 2-2" />
    </svg>
  )
}
function IconUser({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

/** Zielseite beim Welt-Wechsel (jeweils „Heute" der Welt). */
const HOME: Record<World, string> = { fitness: '/', food: '/nutrition' }

export function TopBar() {
  const { world, setWorld } = usePrefs()
  const { data: ai } = useAiStatus()
  const navigate = useNavigate()

  function switchTo(w: World) {
    if (w !== world) {
      setWorld(w)
      navigate(HOME[w])
    }
  }

  const tabBase =
    'flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200'

  return (
    <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 py-2.5">
        {/* Ruhiger Segment-Schalter: aktive Welt = helle Fläche, keine Signalfarbe */}
        <div className="flex flex-1 gap-1 rounded-full bg-sand p-1">
          <button
            type="button"
            onClick={() => switchTo('fitness')}
            aria-pressed={world === 'fitness'}
            className={`${tabBase} ${
              world === 'fitness' ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            <IconDumbbell className={`h-4 w-4 ${world === 'fitness' ? 'text-brand' : ''}`} />
            Fitness
          </button>
          <button
            type="button"
            onClick={() => switchTo('food')}
            aria-pressed={world === 'food'}
            className={`${tabBase} ${
              world === 'food' ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            <IconApple className={`h-4 w-4 ${world === 'food' ? 'text-brand' : ''}`} />
            Ernährung
          </button>
        </div>
        {ai?.enabled && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-assistant'))}
            aria-label="KI-Assistent"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-brand"
          >
            <Sparkles size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="Profil"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa"
        >
          <IconUser />
        </button>
      </div>
    </header>
  )
}
