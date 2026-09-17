import { useNavigate } from 'react-router-dom'
import { usePrefs, type World } from '../lib/prefs'
import { useAllSets } from '../hooks/useWorkouts'
import { useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useWater } from '../hooks/useWater'
import { sumEntries } from '../lib/nutrition'

const DAY_CUTOFF_H = 4

function trainingToday(): string {
  const d = new Date()
  d.setHours(d.getHours() - DAY_CUTOFF_H)
  return ymd(d)
}
function today(): string {
  return ymd(new Date())
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function Tile({
  label,
  value,
  sub,
  done,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  done?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-2 text-center ring-1 transition ${
        done ? 'bg-brand/10 ring-brand/30' : 'bg-sand-light ring-sand-dark'
      }`}
    >
      <div className="text-[11px] text-cocoa-light">{label}</div>
      <div className="text-base font-bold text-cocoa">{value}</div>
      {sub && <div className="text-[10px] text-cocoa-muted">{sub}</div>}
    </button>
  )
}

/** Kompakter Tagesüberblick über Fitness + Ernährung, oben auf „Heute". */
export function DailyOverview() {
  const navigate = useNavigate()
  const { setWorld } = usePrefs()
  const { data: allSets } = useAllSets()
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(today())
  const { data: water } = useWater(today())

  const tSets = (allSets ?? []).filter((s) => s.date === trainingToday())
  const trained = tSets.length > 0
  const totals = sumEntries(entries ?? [])
  const kcalTarget = settings?.kcal_target ?? 0
  const kcalLeft = kcalTarget ? kcalTarget - totals.kcal : 0
  const proteinTarget = settings?.protein_target ?? 0
  const goalWater = settings?.water_target_ml || 2500
  const waterPct = Math.min(100, Math.round(((water?.ml ?? 0) / goalWater) * 100))

  const go = (w: World, to: string) => {
    setWorld(w)
    navigate(to)
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Heute im Überblick</h2>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Tile
          label="Training"
          value={trained ? '✓' : '–'}
          sub={trained ? `${tSets.length} Sätze` : 'offen'}
          done={trained}
          onClick={() => go('fitness', '/')}
        />
        <Tile
          label="kcal übrig"
          value={kcalTarget ? `${kcalLeft}` : '–'}
          sub={kcalTarget ? `von ${kcalTarget}` : 'kein Ziel'}
          onClick={() => go('food', '/nutrition')}
        />
        <Tile
          label="Eiweiß"
          value={`${totals.protein}`}
          sub={proteinTarget ? `/ ${proteinTarget} g` : 'g'}
          done={proteinTarget > 0 && totals.protein >= proteinTarget}
          onClick={() => go('food', '/nutrition')}
        />
        <Tile
          label="Wasser"
          value={`${waterPct}%`}
          sub={`${((water?.ml ?? 0) / 1000).toFixed(1).replace('.', ',')} l`}
          done={waterPct >= 100}
          onClick={() => go('food', '/nutrition')}
        />
      </div>
    </div>
  )
}
