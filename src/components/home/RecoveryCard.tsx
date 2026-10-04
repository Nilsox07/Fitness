import type { RecoveryLevel } from '../../lib/home'
import type { MuscleGroup } from '../../types'
import { enter } from './motion'

export interface MuscleState {
  muscle: MuscleGroup
  level: RecoveryLevel
  /** Tage seit dem letzten Training (null = noch nie) */
  daysAgo: number | null
}

const STYLE: Record<RecoveryLevel, { label: string; bar: string; text: string }> = {
  fresh: { label: 'erholt', bar: 'bg-success', text: 'text-success' },
  almost: { label: 'fast', bar: 'bg-gold', text: 'text-gold' },
  tired: { label: 'erschöpft', bar: 'bg-brand/50', text: 'text-cocoa-muted' },
}

/** Muskel-Erholung (Fitbod-Stil): 2-spaltig mit kleinem Balken. */
export function RecoveryCard({ items, index }: { items: MuscleState[]; index: number }) {
  if (items.length === 0) return null
  const fresh = items.filter((i) => i.level === 'fresh').length
  return (
    <section className="card space-y-3" style={enter(index)}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Erholung</h2>
        <span className="tabular text-xs text-cocoa-muted">
          {fresh} / {items.length} bereit
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {items.map(({ muscle, level, daysAgo }) => {
          const s = STYLE[level]
          // ≥ 3 Tage = voll erholt
          const pct = daysAgo == null ? 100 : Math.max(8, Math.min(100, Math.round((daysAgo / 3) * 100)))
          return (
            <div key={muscle} className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{muscle}</span>
                <span className={`shrink-0 text-[11px] font-semibold ${s.text}`}>{s.label}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-sand">
                <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
