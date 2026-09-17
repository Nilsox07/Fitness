import { useNavigate } from 'react-router-dom'
import { usePrefs, type World } from '../lib/prefs'

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
  const navigate = useNavigate()

  function switchTo(w: World) {
    if (w !== world) {
      setWorld(w)
      navigate(HOME[w])
    }
  }

  const tabBase =
    'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition'

  return (
    <header className="sticky top-0 z-20 border-b border-sand-dark bg-cream/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 py-2.5">
        <div className="flex flex-1 gap-1 rounded-full bg-sand-light p-1 ring-1 ring-sand-dark">
          <button
            type="button"
            onClick={() => switchTo('fitness')}
            aria-pressed={world === 'fitness'}
            className={`${tabBase} ${
              world === 'fitness' ? 'bg-ruby text-white shadow' : 'text-cocoa-light'
            }`}
          >
            <IconDumbbell />
            Fitness
          </button>
          <button
            type="button"
            onClick={() => switchTo('food')}
            aria-pressed={world === 'food'}
            className={`${tabBase} ${
              world === 'food' ? 'bg-ruby text-white shadow' : 'text-cocoa-light'
            }`}
          >
            <IconApple />
            Ernährung
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="Profil"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand-light text-cocoa ring-1 ring-sand-dark"
        >
          <IconUser />
        </button>
      </div>
    </header>
  )
}
