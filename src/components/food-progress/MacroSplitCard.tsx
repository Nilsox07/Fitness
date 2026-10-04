import type { CSSProperties } from 'react'
import { macroSplit } from '../../lib/foodProgress'
import { fmtInt } from '../../lib/nutritionHome'
import { SectionTitle } from './ui'

/** Ø Makro-Verteilung (Anteil an den Kalorien) als gestapelter Balken. */
export function MacroSplitCard({
  protein,
  carbs,
  fat,
  targets,
  style,
}: {
  protein: number
  carbs: number
  fat: number
  targets: { protein: number; carbs: number; fat: number }
  style?: CSSProperties
}) {
  const s = macroSplit(protein, carbs, fat)
  const rows = [
    { key: 'p', label: 'Eiweiß', g: protein, pct: s.protein, target: targets.protein, bg: 'bg-brand' },
    { key: 'c', label: 'Kohlenhydrate', g: carbs, pct: s.carbs, target: targets.carbs, bg: 'bg-gold' },
    { key: 'f', label: 'Fett', g: fat, pct: s.fat, target: targets.fat, bg: 'bg-cocoa-light' },
  ]
  return (
    <section style={style}>
      <SectionTitle right="Ø pro Tag">Makro-Verteilung</SectionTitle>
      <div className="card space-y-3">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-sand-dark/40" aria-hidden>
          {rows.map(
            (r) =>
              r.pct > 0 && (
                <div
                  key={r.key}
                  className={`h-full ${r.bg} transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${r.pct}%` }}
                />
              ),
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rows.map((r) => (
            <div key={r.key} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-cocoa-light">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.bg}`} />
                <span className="truncate">{r.label}</span>
              </div>
              <div className="tabular mt-0.5 text-lg font-bold leading-tight text-cocoa">
                {r.pct}
                <span className="ml-0.5 text-xs font-semibold text-cocoa-light">%</span>
              </div>
              <div className="tabular text-[11px] text-cocoa-muted">
                {fmtInt(r.g)}
                {r.target > 0 ? ` / ${fmtInt(r.target)}` : ''} g
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
