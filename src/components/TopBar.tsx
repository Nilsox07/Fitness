import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { historyIndex, previousNav, type NavEntry } from '../lib/navHistory'

/** Bereich (Tab) bzw. übergeordnete Seite zur aktuellen Route – für Titel und Zurück-Pfeil. */
type NavInfo = { title: string; back?: { to: string; label: string } }

export function navInfo(pathname: string, search = ''): NavInfo {
  if (pathname === '/plans' && /[?&](edit|rhythm)=/.test(search))
    return { title: 'Plan', back: { to: '/plans', label: 'Pläne' } }
  if (pathname === '/today') return { title: 'Heute' }
  if (pathname.startsWith('/cardio/')) return { title: 'Aktivität', back: { to: '/cardio', label: 'Ausdauer' } }
  if (pathname === '/progress') return { title: 'Fortschritt' }
  const progressPages = [
    '/cardio',
    '/sleep',
    '/vitals',
    '/analytics',
    '/badges',
    '/body',
    '/history',
    '/cycle',
    '/insights',
  ]
  if (progressPages.includes(pathname)) return { title: 'Fortschritt', back: { to: '/progress', label: 'Fortschritt' } }
  if (pathname === '/nutrition') return { title: 'Ernährung' }
  if (pathname === '/recipes') return { title: 'Rezepte', back: { to: '/nutrition', label: 'Ernährung' } }
  if (pathname === '/shopping') return { title: 'Wochenplan', back: { to: '/nutrition', label: 'Ernährung' } }
  if (pathname === '/') return { title: 'Training' }
  if (pathname === '/plans') return { title: 'Pläne', back: { to: '/', label: 'Training' } }
  if (pathname === '/exercises') return { title: 'Übungen', back: { to: '/', label: 'Training' } }
  if (pathname.startsWith('/exercises/')) return { title: 'Übung', back: { to: '/exercises', label: 'Übungen' } }
  if (pathname === '/quick') return { title: 'Home-Workout', back: { to: '/', label: 'Training' } }
  if (pathname === '/social') return { title: 'Community' }
  if (pathname === '/feed') return { title: 'Aktivitäten', back: { to: '/social', label: 'Community' } }
  if (pathname === '/profile') return { title: 'Profil', back: { to: '', label: 'Zurück' } }
  return { title: '' }
}

/**
 * Schmale Zurück-Zeile – nur auf Unterseiten (Rezepte, Pläne, Verlauf, Profil …).
 * Hauptseiten haben keine eigene Leiste: Buddy & Profil sitzen dort in der
 * Titelzeile (TabHeader), damit der Inhalt höher beginnt.
 */
export function TopBar() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const nav = navInfo(pathname, search)
  // Profil-Unterseiten (?s=…) gehen zurück zur Profil-Übersicht
  const parent = pathname === '/profile' && search.includes('s=') ? { to: '/profile', label: 'Profil' } : nav.back
  if (!parent) return null
  // Zurück dorthin, wo man herkam (Verlauf) – sonst zur Elternseite
  const prev = previousNav(historyIndex(), { pathname, search })
  const prevLabel = prev ? backLabel(prev) : null

  return (
    <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center py-1.5">
        <button
          type="button"
          onClick={() => (prev ? navigate(-1) : parent.to ? navigate(parent.to, { replace: true }) : navigate(-1))}
          className="-ml-1 flex min-w-0 items-center gap-0.5 py-1.5 pr-3 text-base font-semibold text-brand"
        >
          <ChevronLeft size={22} strokeWidth={2.5} className="shrink-0" />
          <span className="truncate">{prevLabel ?? parent.label}</span>
        </button>
      </div>
    </header>
  )
}

/** Beschriftung für „Zurück zu …“ aus der vorherigen Seite. */
function backLabel(prev: NavEntry): string {
  if (prev.pathname === '/profile') return 'Profil'
  const t = navInfo(prev.pathname, prev.search).title
  return t || 'Zurück'
}
