import type { Sex } from '../../types'
import { microDay, type Micros } from '../../lib/micros'

/** Vitamine einer Mahlzeit (Analyse): die vier stärksten als kleine Balken, Anteil am Tagesbedarf. */
export function MealMicros({
  items,
  sex = null,
}: {
  items: { kcal: number; micros?: Micros | null }[]
  sex?: Sex | null
}) {
  const day = microDay(items, sex)
  if (!day) return null
  const top = [...day.rows]
    .filter((r) => r.share >= 0.08)
    .sort((a, b) => b.share - a.share)
    .slice(0, 4)
  if (!top.length) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
        Vitamine & Mineralstoffe · vom Tagesbedarf
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {top.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-cocoa">{r.label}</span>
              <span className="tabular text-cocoa-muted">{Math.round(r.share * 100)} %</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
              <div
                className={`h-full rounded-full ${r.share >= 1 ? 'bg-success' : 'bg-brand'}`}
                style={{ width: `${Math.max(4, Math.min(1, r.share) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
