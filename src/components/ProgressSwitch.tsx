import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { usePrefs } from '../lib/prefs'
import { BuddyTip } from './buddy/BuddyTip'
import type { TipPage } from '../lib/buddyTips'

/**
 * Unterzeile der Fortschritt-Detailseiten: Zeitraum-Auswahl, „Verlauf“ und Buddy-Tipp.
 * Die Bereiche wählt man in der Übersicht (/progress) – keine Wisch-Leiste mehr.
 */
export function ProgressSwitch({ extra }: { extra?: ReactNode } = {}) {
  const { world } = usePrefs()
  const { pathname } = useLocation()

  if (pathname === '/history') return null
  const onAnalytics = pathname === '/analytics'
  const tipPage: TipPage | null =
    pathname === '/cardio' ? 'cardio' : pathname === '/sleep' ? 'sleep' : pathname === '/vitals' ? 'vitals' : null

  return (
    <div className="space-y-2">
      {onAnalytics && (
        <div className="flex items-center justify-between gap-2">
          {extra ?? <span />}
          <Link
            to={world === 'food' ? '/history?view=food' : '/history?view=training'}
            className="flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-cocoa transition active:scale-95"
          >
            <CalendarDays size={15} className="text-brand" />
            {world === 'food' ? 'Alle Tage' : 'Verlauf'}
            <ChevronRight size={15} className="text-cocoa-muted" />
          </Link>
        </div>
      )}
      {!onAnalytics && extra}
      {tipPage && <BuddyTip page={tipPage} />}
    </div>
  )
}
