import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, User } from 'lucide-react'
import { BuddyFace } from '../buddy/BuddyFace'
import { openBuddySheet } from '../buddy/BuddySheet'
import { useBuddy } from '../buddy/useBuddy'
import { useAiStatus } from '../../hooks/useAi'

/** Buddy (KI-Coach) und Profil – sitzen wie bei Apple rechts in der Titelzeile, keine eigene Leiste. */
export function HeaderActions() {
  const buddy = useBuddy()
  const navigate = useNavigate()
  const { data: ai } = useAiStatus()
  const aiOn = !!ai?.enabled
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={openBuddySheet}
        aria-label={aiOn ? 'Frag Buddy – dein KI-Coach' : 'Buddy öffnen'}
        title={aiOn ? 'Frag Buddy – dein KI-Coach' : buddy.line}
        className="relative rounded-full bg-brand/10 ring-1 ring-brand/25 transition active:scale-90"
      >
        <BuddyFace size={34} mood={buddy.mood} stage={buddy.stage} skin={buddy.skin} />
        {aiOn && (
          <span className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-brand text-on-brand ring-2 ring-bg">
            <Sparkles size={10} strokeWidth={2.75} />
          </span>
        )}
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
  return (
    <header className="space-y-1 pt-[env(safe-area-inset-top)]" style={style}>
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
