// Andere Aktivitäten dieser Woche (Radfahren, Volleyball …) + „Eintragen“. Antippen eines Eintrags → löschen.

import { useState, type CSSProperties } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useDeleteManualActivity, useManualActivities } from '../../hooks/useManualActivities'
import { dayLabel, localDate, shiftDate } from '../../lib/day'
import { weekdayIndex } from '../../lib/schedule'
import { INTENSITY_LABEL, activityTitle } from '../../lib/sports'
import { sportIcon } from './sportIcons'
import { ActivitySheet } from './ActivitySheet'

export function ActivitiesCard({ style, days }: { style?: CSSProperties; days?: number }) {
  const today = localDate()
  const { data: list = [] } = useManualActivities()
  const del = useDeleteManualActivity()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const from = days ? shiftDate(today, -(days - 1)) : shiftDate(today, -weekdayIndex(today))
  const shown = list.filter((a) => a.date >= from && a.date <= today)
  const kcal = shown.reduce((s, a) => s + a.kcal, 0)

  return (
    <section className="card space-y-2.5" style={style}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">Aktivitäten</h2>
          <p className="text-xs text-cocoa-light">
            {shown.length
              ? `${days ? `Letzte ${days} Tage` : 'Diese Woche'} · ≈ ${kcal.toLocaleString('de-DE')} kcal`
              : 'Radfahren, Volleyball, Schwimmen …'}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand"
        >
          <Plus size={15} /> Eintragen
        </button>
      </div>
      {shown.length > 0 && (
        <ul className="divide-y divide-sand-dark/40">
          {shown.map((a) => {
            const Icon = sportIcon(a.sport)
            const on = sel === a.id
            return (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
                  <Icon size={17} />
                </span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setSel(on ? null : a.id)}>
                  <span className="block truncate text-sm font-semibold">{activityTitle(a)}</span>
                  <span className="block text-xs text-cocoa-muted">
                    {dayLabel(a.date, today)} · {INTENSITY_LABEL[a.intensity]} · ≈ {a.kcal} kcal
                  </span>
                </button>
                {on && (
                  <button
                    aria-label="Löschen"
                    onClick={() => {
                      del.mutate(a.id)
                      setSel(null)
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open && <ActivitySheet onClose={() => setOpen(false)} />}
    </section>
  )
}
