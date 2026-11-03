import type { CSSProperties } from 'react'
import { Check, Flame } from 'lucide-react'
import type { ProteinDot } from '../../lib/foodProgress'
import { fmtInt } from '../../lib/nutritionHome'
import { SectionTitle } from './ui'

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const weekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return WD[new Date(y, m - 1, d).getDay()]
}

/** Eiweiß-Konstanz: ein Punkt je Tag (grün = Ziel erreicht), dazu die aktuelle Serie. */
export function ProteinDotsCard({
  dots,
  target,
  streak,
  today,
  style,
}: {
  dots: ProteinDot[]
  target: number
  streak: number
  today: string
  style?: CSSProperties
}) {
  const hits = dots.filter((d) => d.state === 'hit').length
  // Ab zwei Wochen als Kalender-Raster (7 Spalten), sonst eine Zeile
  const grid = dots.length > 14
  return (
    <section style={style}>
      <SectionTitle right={`Ziel ${fmtInt(target)} g`}>Eiweiß-Konstanz</SectionTitle>
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="tabular text-sm text-cocoa-light">
            <span className="text-lg font-bold text-cocoa">{hits}</span> von {dots.length} Tagen erreicht
          </div>
          {streak > 0 && (
            <span className="tabular flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
              <Flame size={12} />
              {streak} {streak === 1 ? 'Tag' : 'Tage'} in Folge
            </span>
          )}
        </div>
        <div
          className={grid ? 'grid grid-cols-7 justify-items-center gap-y-1.5' : 'flex items-end justify-between'}
          role="list"
        >
          {dots.map((d, i) => {
            const isToday = d.date === today
            const label = grid ? i < 7 : i % 7 === 0 || isToday
            return (
              <div
                key={d.date}
                role="listitem"
                aria-label={`${d.date}: ${d.state === 'hit' ? 'erreicht' : d.state === 'miss' ? 'nicht erreicht' : 'nichts erfasst'}`}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`grid h-[18px] w-[18px] place-items-center rounded-full transition-colors ${
                    d.state === 'hit'
                      ? 'bg-success text-white'
                      : d.state === 'miss'
                        ? 'bg-sand-dark/70'
                        : 'border border-dashed border-sand-dark'
                  } ${isToday ? 'ring-2 ring-brand/40 ring-offset-1 ring-offset-cream' : ''}`}
                  style={{ animation: 'fade-in .3s ease-out backwards', animationDelay: `${i * 25}ms` }}
                >
                  {d.state === 'hit' && <Check size={11} strokeWidth={3} />}
                </span>
                {label && (
                  <span className={`text-[9px] ${isToday && !grid ? 'font-semibold text-brand' : 'text-cocoa-muted'}`}>
                    {isToday && !grid ? 'Heute' : weekday(d.date)}
                  </span>
                )}
                {!label && !grid && <span className="text-[9px] text-transparent">·</span>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
