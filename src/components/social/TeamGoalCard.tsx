import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useBuddySkin } from '../buddy/useBuddy'
import { Avatar } from './Avatar'
import { Ring } from '../nutrition-home/Ring'
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
  return (
    <div className="card flex flex-col justify-between gap-4 p-5" style={style}>
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            reached
              ? 'bg-success text-white'
              : tone === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-brand/10 text-brand'
          }`}
        >
          {reached ? <Check size={18} strokeWidth={3} className="anim-check" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">Teamziel</div>
          <div className="truncate text-lg font-bold leading-tight">{title}</div>
        </div>
      </div>

      <div className="flex justify-center">
        <Ring
          size={150}
          stroke={12}
          progress={pct / 100}
          trackClass="stroke-sand-dark/45"
          barClass={reached || tone === 'success' ? 'stroke-success' : 'stroke-brand'}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="tabular text-4xl font-bold tracking-tight">
              {done}
              <span className="text-lg font-semibold text-cocoa-muted">/{target}</span>
            </span>
            <span className="mt-1.5 text-xs font-medium text-cocoa-light">{unit}</span>
          </div>
        </Ring>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex shrink-0 -space-x-2" aria-hidden>
          {people.slice(0, 5).map((u) => (
            <Avatar
              key={u.user_id}
              buddy={buddyLook(u, u.user_id === meId, mySkin)}
              name={u.display_name}
              size={30}
              className="bg-sand ring-2 ring-cream"
            />
          ))}
        </span>
        <span className="tabular min-w-0 flex-1 text-sm text-cocoa-light">
          {reached ? 'Geschafft – stark gemacht, Team!' : `Noch ${target - done} ${unit} – jeder zählt mit.`}
        </span>
      </div>
    </div>
  )
}
