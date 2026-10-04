import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { buddyLook, type Person } from './format'

/** Schlanke Karte für ein gemeinsames Wochenziel (Trainings oder Eiweiß-Tage). */
export function TeamGoalCard({
  title,
  icon,
  done,
  target,
  unit,
  people,
  meId,
  tone = 'brand',
  style,
}: {
  title: string
  icon: ReactNode
  done: number
  target: number
  /** Einheit im Untertitel, z. B. „Trainings" */
  unit: string
  people: Person[]
  meId: string
  tone?: 'brand' | 'success'
  style?: CSSProperties
}) {
  const mySkin = useBuddySkin()
  const reached = target > 0 && done >= target
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0
  const bar = reached || tone === 'success' ? 'bg-success' : 'bg-brand'
  return (
    <div className="card space-y-2.5 py-3.5" style={style}>
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            reached ? 'bg-success text-white' : tone === 'success' ? 'bg-success/10 text-success' : 'bg-brand/10 text-brand'
          }`}
        >
          {reached ? <Check size={17} strokeWidth={3} className="anim-check" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="tabular truncate text-xs text-cocoa-light">
            {reached ? 'Teamziel geschafft!' : `Noch ${target - done} ${unit} bis zum Teamziel`}
          </div>
        </div>
        <span className="flex shrink-0 -space-x-2" aria-hidden>
          {people.slice(0, 4).map((u) => (
            <Avatar
              key={u.user_id}
              buddy={buddyLook(u, u.user_id === meId, mySkin)}
              name={u.display_name}
              size={24}
              className="bg-sand ring-2 ring-cream"
            />
          ))}
        </span>
        <span className="tabular shrink-0 text-base font-bold">
          {done}
          <span className="text-xs font-semibold text-cocoa-muted">/{target}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
