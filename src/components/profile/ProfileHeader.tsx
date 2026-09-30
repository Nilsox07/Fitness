import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { FoodEntry, SetWithDate } from '../../types'
import { frequencyStats } from '../../lib/analytics'
import { rankForSessions } from '../../lib/gamification'
import { mascotEmoji } from '../../lib/cosmetics'
import { computeXp, levelInfo } from '../../lib/xp'
import { computeNutritionXp } from '../../lib/nutritionXp'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { useMyProfile } from '../../hooks/useSocial'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Profil-Kopf: Maskottchen, Name, Level/Rang und ein paar Kennzahlen. Tippen → Sammlung. */
export function ProfileHeader({
  sets,
  foodEntries,
  skin,
  email,
  showNutrition,
  onOpen,
}: {
  sets: SetWithDate[]
  foodEntries: FoodEntry[]
  skin: string
  email: string | undefined
  showNutrition: boolean
  onOpen: () => void
}) {
  const { data: profile } = useMyProfile()
  const { data: settings } = useNutritionSettings()

  const g = useMemo(() => {
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    return {
      sessions: freq.totalSessions,
      weekStreak: freq.weekStreak,
      level: levelInfo(computeXp(sets)).level,
      rank: rankForSessions(freq.totalSessions).title,
    }
  }, [sets])

  const foodLevel = useMemo(
    () =>
      levelInfo(computeNutritionXp(foodEntries, settings?.protein_target ?? 0, todayLocal())).level,
    [foodEntries, settings?.protein_target],
  )

  const name = profile?.display_name || email?.split('@')[0] || 'Athlet'

  const stats: { v: number; l: string }[] = [
    { v: g.sessions, l: 'Trainings' },
    { v: g.weekStreak, l: g.weekStreak === 1 ? 'Woche Streak' : 'Wochen Streak' },
    showNutrition ? { v: foodLevel, l: 'Ernährungs-Lv' } : { v: g.level, l: 'Level' },
  ]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card block w-full text-left transition-colors duration-150 active:bg-sand/60"
      aria-label="Sammlung öffnen"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sand text-3xl">
          {mascotEmoji(g.sessions, skin)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-cocoa">{name}</div>
          {email && <div className="truncate text-xs text-cocoa-light">{email}</div>}
          <div className="mt-0.5 truncate text-sm text-cocoa-light">
            <span className="tabular font-semibold text-cocoa">Level {g.level}</span> · {g.rank}
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-sand p-2 text-center">
        {stats.map((s) => (
          <div key={s.l}>
            <div className="tabular text-base font-bold text-cocoa">{s.v}</div>
            <div className="text-[11px] text-cocoa-light">{s.l}</div>
          </div>
        ))}
      </div>
    </button>
  )
}
