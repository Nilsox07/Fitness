import { useHasBackBar } from '../TopBar'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User } from 'lucide-react'
import { openSearch } from '../search/SearchSheet'

/** Suche und Profil – rechts in der Titelzeile (Buddy schwebt unten rechts über der Menüleiste). */
export function HeaderActions() {
  const navigate = useNavigate()
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={openSearch}
        aria-label="Suchen"
        className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
      >
        <Search size={18} />
      </button>
      <button
        type="button"
        onClick={() => navigate('/profile')}
        aria-label="Profil"
        className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
      >
        <User size={18} />
      </button>
    </div>
  )
}

/**
 * Einheitlicher Kopf aller vier Tabs:
 *   Zeile 1: Datum/Untertitel · rechts Buddy & Profil
 *   Zeile 2: großer Tab-Name · rechts die Aktion der Seite (Ziel, Zeitraum, …)
 */
export function TabHeader({
  overline,
  title,
  action,
  style,
}: {
  overline?: ReactNode
  title: string
  action?: ReactNode
  style?: CSSProperties
}) {
  // Unter der Zurück-Zeile kein zweiter Statusleisten-Abstand (sonst große Lücke zwischen „Zurück“ und Titel)
  const backBar = useHasBackBar()
  return (
    <header className={`space-y-1 ${backBar ? '' : 'pt-[env(safe-area-inset-top)]'}`} style={style}>
      <div className="flex items-center justify-between gap-3">
        <p className="tabular min-w-0 truncate text-sm text-cocoa-light">{overline}</p>
        <HeaderActions />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}
