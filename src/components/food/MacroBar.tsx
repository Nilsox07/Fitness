import { fmt } from './mealItems'

/** Gestapelter Balken: kcal-Anteile von Eiweiß / Kohlenhydraten / Fett + Legende. */
export function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    {
      key: 'p',
      label: 'Eiweiß',
      g: protein,
      kcal: protein * 4,
      cls: 'bg-brand',
    },
    {
      key: 'c',
      label: 'Kohlenhydrate',
      g: carbs,
      kcal: carbs * 4,
      cls: 'bg-gold',
    },
    { key: 'f', label: 'Fett', g: fat, kcal: fat * 9, cls: 'bg-cocoa-light' },
  ]
  const sum = parts.reduce((s, p) => s + p.kcal, 0)
  const pct = (k: number) => (sum > 0 ? Math.round((k / sum) * 100) : 0)

  return (
    <div className="space-y-3">
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-sand"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${pct(p.kcal)} %`).join(', ')}
      >
        {sum > 0 &&
          parts.map((p) => (
            <div
              key={p.key}
              className={`h-full ${p.cls} transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${(p.kcal / sum) * 100}%` }}
            />
          ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-cocoa-light">
              <span className={`h-2 w-2 shrink-0 rounded-full ${p.cls}`} />
              <span className="truncate">{p.label}</span>
            </div>
            <div className="tabular mt-0.5 text-sm font-semibold text-cocoa">
              {fmt(p.g)} g <span className="font-normal text-cocoa-muted">· {pct(p.kcal)} %</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
