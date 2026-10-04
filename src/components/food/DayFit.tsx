import { fmt } from './mealItems'

/** Dünner Fortschrittsbalken: bereits gegessen (kräftig) + diese Mahlzeit (heller) obendrauf. */
function StackBar({ eaten, meal, target, label }: { eaten: number; meal: number; target: number; label: string }) {
  const cap = (v: number) => Math.max(0, Math.min(100, v))
  const eatenPct = cap((eaten / target) * 100)
  const mealPct = cap(((eaten + meal) / target) * 100) - eatenPct
  const over = eaten + meal > target
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-sand"
      role="img"
      aria-label={`${label}: ${Math.round(eaten)} gegessen, ${Math.round(meal)} durch diese Mahlzeit, Ziel ${Math.round(target)}`}
    >
      <div
        className={`h-full ${over ? 'bg-gold' : 'bg-brand'} transition-[width] duration-500 ease-out`}
        style={{ width: `${eatenPct}%` }}
      />
      <div
        className={`h-full ${over ? 'bg-gold/45' : 'bg-brand/40'} transition-[width] duration-500 ease-out`}
        style={{ width: `${mealPct}%` }}
      />
    </div>
  )
}

/** „Für deinen Tag": wie die Mahlzeit ins Tagesziel passt. */
export function DayFit({
  kcalTarget,
  proteinTarget,
  eatenKcal,
  eatenProtein,
  mealKcal,
  mealProtein,
}: {
  kcalTarget: number
  proteinTarget: number
  eatenKcal: number
  eatenProtein: number
  mealKcal: number
  mealProtein: number
}) {
  if (kcalTarget <= 0) {
    return (
      <p className="text-sm text-cocoa-light">
        Stell ein Tagesziel ein, um zu sehen, wie diese Mahlzeit in deinen Tag passt.
      </p>
    )
  }
  const left = kcalTarget - eatenKcal - mealKcal
  const proteinAfter = eatenProtein + mealProtein
  return (
    <div className="space-y-3">
      <p className="tabular text-sm text-cocoa">
        {left >= 0 ? (
          <>
            Noch <span className="font-semibold">{Math.round(left)} kcal</span> übrig
          </>
        ) : (
          <>
            <span className="font-semibold text-gold">{Math.round(-left)} kcal</span> über deinem Ziel
          </>
        )}
        {proteinTarget > 0 && (
          <span className="text-cocoa-light">
            {' '}
            · Eiweiß {fmt(Math.round(proteinAfter), 0)} / {proteinTarget} g
          </span>
        )}
      </p>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-cocoa-light">
            <span>Kalorien</span>
            <span className="tabular">
              {Math.round(eatenKcal + mealKcal)} / {kcalTarget}
            </span>
          </div>
          <StackBar eaten={eatenKcal} meal={mealKcal} target={kcalTarget} label="Kalorien" />
        </div>
        {proteinTarget > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-cocoa-light">
              <span>Eiweiß</span>
              <span className="tabular">
                {Math.round(proteinAfter)} / {proteinTarget} g
              </span>
            </div>
            <StackBar eaten={eatenProtein} meal={mealProtein} target={proteinTarget} label="Eiweiß" />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-cocoa-muted">
        <span className="h-1.5 w-3 rounded-full bg-brand" /> heute gegessen
        <span className="ml-2 h-1.5 w-3 rounded-full bg-brand/40" /> diese Mahlzeit
      </p>
    </div>
  )
}
