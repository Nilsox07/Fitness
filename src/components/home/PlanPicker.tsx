import { ChevronRight, Play } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { estimateMinutes } from '../../lib/home'
import { shiftDate } from '../../lib/day'
import type { PlanWithExercises } from '../../types'

export function lastDoneLabel(date: string | null | undefined, today: string): string {
  if (!date) return 'Noch nie trainiert'
  if (date === shiftDate(today, -1)) return 'Zuletzt gestern'
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86400000)
  if (days <= 0) return 'Zuletzt heute'
  if (days < 14) return `Zuletzt vor ${days} Tagen`
  return `Zuletzt vor ${Math.round(days / 7)} Wochen`
}

/** Bottom-Sheet „Plan wählen" (Startseite: anderer Plan / trotzdem trainieren). */
export function PlanPickerSheet({
  plans,
  highlightId,
  highlightLabel = 'Vorschlag',
  exerciseCount,
  lastDone,
  today,
  busy,
  onPick,
  onClose,
}: {
  plans: PlanWithExercises[]
  highlightId: string | null
  highlightLabel?: string
  exerciseCount: (p: PlanWithExercises) => number
  lastDone: Map<string, string | null>
  today: string
  busy: boolean
  onPick: (p: PlanWithExercises) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Plan wählen" onClose={onClose}>
      <div className="space-y-2">
        {plans.map((p) => {
          const n = exerciseCount(p)
          const hl = p.id === highlightId
          return (
            <button
              key={p.id}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                hl ? 'bg-brand/10 ring-1 ring-brand/30' : 'bg-sand-light ring-1 ring-sand-dark'
              }`}
              disabled={busy}
              onClick={() => {
                onClose()
                onPick(p)
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                <Play size={16} className="ml-0.5 fill-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="tabular block truncate text-xs text-cocoa-light">
                  {n} {n === 1 ? 'Übung' : 'Übungen'}
                  {n > 0 && ` · ~${estimateMinutes(n)} Min`} · {lastDoneLabel(lastDone.get(p.id), today)}
                </span>
              </span>
              {hl ? (
                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  {highlightLabel}
                </span>
              ) : (
                <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
