import { useRef, type CSSProperties } from 'react'
import { GlassWater, Minus, Plus } from 'lucide-react'
import { useWater, useSetWater } from '../../hooks/useWater'
import { useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { fluidTotal } from '../../lib/fluid'
import { filledGlasses, fmtLiters } from '../../lib/nutritionHome'

const DEFAULT_GOAL_ML = 2500
const STEP = 250
const GLASSES = 8

/**
 * Kompakte Trink-Karte: 8 Gläser füllen sich bis zum Tagesziel, ± in 250-ml-Schritten.
 * Getränke aus dem Ernährungstagebuch (Shake, Kaffee, Cola …) zählen automatisch mit.
 */
export function WaterRow({ date, style }: { date: string; style?: CSSProperties }) {
  const { data: water } = useWater(date)
  const { data: settings } = useNutritionSettings()
  const setWater = useSetWater()
  const goalMl = settings?.water_target_ml || DEFAULT_GOAL_ML
  const { data: entries } = useFoodEntries(date)
  const ml = water?.ml ?? 0
  const fromDrinks = fluidTotal(entries ?? [])
  const total = ml + fromDrinks
  const filled = filledGlasses(total, goalMl, GLASSES)
  const done = total >= goalMl

  // Zuletzt angeforderter Wert: schnelle Taps bauen darauf auf, auch wenn der
  // (optimistische) Cache-Wert noch nicht neu gerendert wurde.
  const latest = useRef<{ date: string; ml: number } | null>(null)
  const change = (delta: number) => {
    const base = latest.current?.date === date ? latest.current.ml : ml
    const next = Math.max(0, base + delta)
    const req = { date, ml: next }
    latest.current = req
    setWater.mutate(req, {
      onSettled: () => {
        if (latest.current === req) latest.current = null
      },
    })
  }

  return (
    <section className="card space-y-3" style={style}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Trinken</h2>
          {fromDrinks > 0 && (
            <p className="tabular text-xs text-cocoa-muted">
              {fmtLiters(ml)} l Wasser + {fmtLiters(fromDrinks)} l aus Getränken
            </p>
          )}
        </div>
        <span className="tabular text-sm text-cocoa-light">
          <span className={`font-semibold ${done ? 'text-success' : 'text-cocoa'}`}>{fmtLiters(total)}</span> /{' '}
          {fmtLiters(goalMl)} l
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90 disabled:opacity-40"
          onClick={() => change(-STEP)}
          disabled={ml <= 0}
          aria-label="250 ml weniger"
        >
          <Minus size={16} />
        </button>
        <div className="flex flex-1 items-center justify-between" aria-hidden>
          {Array.from({ length: GLASSES }, (_, i) => (
            <GlassWater
              key={i}
              size={22}
              strokeWidth={1.75}
              className={`transition-colors duration-300 ${i < filled ? 'text-brand' : 'text-sand-dark'}`}
              fill={i < filled ? 'currentColor' : 'none'}
              fillOpacity={0.18}
            />
          ))}
        </div>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition active:scale-90"
          onClick={() => change(STEP)}
          aria-label="250 ml mehr"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  )
}
