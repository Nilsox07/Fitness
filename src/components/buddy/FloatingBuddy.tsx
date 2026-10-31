import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { openBuddySheet } from './BuddySheet'
import { useOverlayOpen } from '../../lib/backStack'
import { isWorkoutRunning } from '../../lib/activeWorkout'
import { haptic } from '../../lib/native'

/**
 * KI-Knopf unten rechts über der Menüleiste (wie bei Google Health): öffnet den Assistenten.
 * Verschwindet bei offenen Fenstern, kurz beim Scrollen und im laufenden Training.
 */
export function FloatingBuddy() {
  const { pathname } = useLocation()
  const overlay = useOverlayOpen()
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let id: ReturnType<typeof setTimeout> | undefined
    const on = () => {
      setScrolling(true)
      clearTimeout(id)
      id = setTimeout(() => setScrolling(false), 900)
    }
    main.addEventListener('scroll', on, { passive: true })
    return () => {
      main.removeEventListener('scroll', on)
      clearTimeout(id)
    }
  }, [pathname])

  if (pathname === '/profile' || pathname.startsWith('/exercises/')) return null
  const hidden = overlay || (pathname === '/' && isWorkoutRunning())

  return (
    <button
      type="button"
      aria-label="Buddy fragen – dein KI-Assistent"
      onClick={() => {
        void haptic()
        openBuddySheet()
      }}
      className={`fixed right-4 z-[25] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-ruby-light via-brand to-ruby-dark text-on-brand shadow-[0_10px_24px_-6px_rgb(var(--c-ruby)/0.65)] ring-1 ring-white/20 transition-all duration-300 active:scale-90 ${
        hidden
          ? 'pointer-events-none translate-y-4 scale-75 opacity-0'
          : scrolling
            ? 'translate-y-2 opacity-40'
            : 'opacity-100'
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}
      aria-hidden={hidden}
    >
      <Sparkles size={24} strokeWidth={2.2} />
    </button>
  )
}
