import { Droplet, GlassWater, Minus, Plus } from 'lucide-react'
import { useWater, useSetWater } from '../hooks/useWater'
import { useNutritionSettings } from '../hooks/useNutrition'

const DEFAULT_GOAL_ML = 2500
const STEP = 250

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function WaterCard({ date }: { date?: string } = {}) {
  const today = date ?? todayLocal()
  const { data: water } = useWater(today)
  const { data: settings } = useNutritionSettings()
  const setWater = useSetWater()
  const goalMl = settings?.water_target_ml || DEFAULT_GOAL_ML
  const ml = water?.ml ?? 0
  const pct = Math.min(100, Math.round((ml / goalMl) * 100))
  const glasses = Math.round(ml / STEP)

  const change = (delta: number) => setWater.mutate({ date: today, ml: Math.max(0, ml + delta) })

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Droplet size={18} className="text-cocoa-light" />
          Wasser
        </h2>
        <span className="tabular text-sm text-cocoa-light">
          {(ml / 1000).toFixed(2).replace('.', ',')} / {(goalMl / 1000).toString().replace('.', ',')} l
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
        <div
          className={`h-full transition-[width] duration-300 ${pct >= 100 ? 'bg-success' : 'bg-brand'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-0.5 text-cocoa-light">
          {Array.from({ length: Math.min(glasses, 10) }, (_, i) => (
            <GlassWater key={i} size={20} strokeWidth={1.75} />
          ))}
        </div>
        <button
          className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition-colors duration-200"
          onClick={() => change(-STEP)}
          aria-label="Weniger"
        >
          <Minus size={18} />
        </button>
        <button
          className="tabular flex h-10 items-center gap-1 rounded-full bg-brand px-4 font-semibold text-white"
          onClick={() => change(STEP)}
        >
          <Plus size={16} strokeWidth={2.5} />
          250 ml
        </button>
      </div>
    </div>
  )
}
