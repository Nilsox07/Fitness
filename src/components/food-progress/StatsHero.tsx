import type { CSSProperties } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useCountUp } from '../food/useCountUp'
import { fmtInt } from '../../lib/nutritionHome'
import { Ring } from '../nutrition-home/Ring'

/** Dunkle Hero-Karte: Ø kcal/Tag groß, Ziel, Treffer-Quote als Ring. */
export function StatsHero({
  windowDays,
  n,
  avgKcal,
  avgTarget,
  inTarget,
  avgProtein,
  proteinTarget,
  style,
}: {
  windowDays: number
  /** abgeschlossene Tage mit Einträgen im Zeitraum */
  n: number
  avgKcal: number | null
  avgTarget: number
  /** davon im Ziel (±10 %) */
  inTarget: number
  avgProtein: number | null
  proteinTarget: number
  style?: CSSProperties
}) {
  const kcalAnim = useCountUp(avgKcal ?? 0, 800)
  const rate = n > 0 ? inTarget / n : 0
  const rateAnim = useCountUp(rate * 100, 800)
  const hasTarget = avgTarget > 0
  const kcalOk = avgKcal !== null && hasTarget && Math.abs(avgKcal - avgTarget) <= avgTarget * 0.1
  const proteinOk = avgProtein !== null && proteinTarget > 0 && avgProtein >= proteinTarget

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
          <Sparkles size={13} className="text-brand" />Ø kcal / Tag · {windowDays} Tage
        </p>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="tabular flex items-baseline gap-1">
              <span className={`text-5xl font-bold tracking-tight ${kcalOk ? 'text-success' : ''}`}>
                {avgKcal === null ? '–' : fmtInt(kcalAnim)}
              </span>
              <span className="text-sm font-semibold text-bg/60 dark:text-cocoa-light">kcal</span>
            </div>
            <p className="tabular mt-0.5 text-sm text-bg/70 dark:text-cocoa-light">
              {hasTarget ? `${n > 0 ? 'Ø Ziel' : 'Ziel'} ${fmtInt(avgTarget)} kcal` : 'Noch kein Kalorienziel gesetzt'}
            </p>
          </div>

          {hasTarget && n > 0 && (
            <Ring
              size={84}
              stroke={8}
              progress={rateAnim / 100}
              transition={false}
              trackClass="stroke-bg/15 dark:stroke-sand-dark/60"
              barClass="stroke-success"
            >
              <div className="flex flex-col items-center leading-none">
                <span className="tabular text-lg font-bold">{Math.round(rateAnim)} %</span>
                <span className="mt-0.5 text-[10px] text-bg/60 dark:text-cocoa-light">im Ziel</span>
              </div>
            </Ring>
          )}
        </div>

        <div className="tabular mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          {n === 0 ? (
            <span className="text-bg/70 dark:text-cocoa-light">
              Noch kein abgeschlossener Tag in den letzten {windowDays} Tagen.
            </span>
          ) : (
            <>
              {hasTarget && (
                <span className="rounded-full bg-bg/10 px-2.5 py-1 font-medium text-bg/85 dark:bg-white/5 dark:text-cocoa">
                  Im Ziel an {inTarget} von {n} {n === 1 ? 'Tag' : 'Tagen'}
                </span>
              )}
              {avgProtein !== null && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                    proteinOk
                      ? 'bg-success/20 text-success'
                      : 'bg-bg/10 text-bg/85 dark:bg-white/5 dark:text-cocoa'
                  }`}
                >
                  Ø {fmtInt(avgProtein)} g Eiweiß
                  {proteinOk && <Check size={12} strokeWidth={2.75} />}
                </span>
              )}
            </>
          )}
        </div>
        {n > 0 && (
          <p className="mt-2 text-[11px] text-bg/50 dark:text-cocoa-muted">
            Ø über {n} abgeschlossene {n === 1 ? 'Tag' : 'Tage'} mit Einträgen (ohne heute)
          </p>
        )}
      </div>
    </section>
  )
}
