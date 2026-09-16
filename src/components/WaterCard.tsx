import { useWater, useSetWater } from '../hooks/useWater'

const GOAL_ML = 2500
const STEP = 250

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function WaterCard() {
  const today = todayLocal()
  const { data: water } = useWater(today)
  const setWater = useSetWater()
  const ml = water?.ml ?? 0
  const pct = Math.min(100, Math.round((ml / GOAL_ML) * 100))
  const glasses = Math.round(ml / STEP)

  const change = (delta: number) => setWater.mutate({ date: today, ml: Math.max(0, ml + delta) })

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">💧 Wasser</h2>
        <span className="text-sm text-cocoa-light">
          {(ml / 1000).toFixed(2).replace('.', ',')} / {GOAL_ML / 1000} l
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-2xl">{'🥛'.repeat(Math.min(glasses, 10))}</div>
        <button
          className="h-10 w-10 rounded-full bg-sand-light text-lg ring-1 ring-sand-dark"
          onClick={() => change(-STEP)}
          aria-label="Weniger"
        >
          −
        </button>
        <button
          className="h-10 rounded-full bg-brand px-4 font-semibold text-white"
          onClick={() => change(STEP)}
        >
          +250 ml
        </button>
      </div>
    </div>
  )
}
