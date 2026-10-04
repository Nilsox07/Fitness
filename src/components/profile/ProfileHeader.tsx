import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { FoodEntry, SetWithDate } from '../../types'
import { frequencyStats } from '../../lib/analytics'
import { rankForSessions } from '../../lib/gamification'
import { mascotStageIndex } from '../../lib/cosmetics'
import { Buddy } from '../buddy/Buddy'
import { buddyLevelInfo } from '../../lib/buddyLevel'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { useMyProfile } from '../../hooks/useSocial'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Profil-Kopf: Buddy, Name, Buddy-Level/Rang und ein paar Kennzahlen. Tippen → Buddy-Seite. */
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
      rank: rankForSessions(freq.totalSessions).title,
    }
  }, [sets])

  // Ein Level für alles: Training (+ Ernährung, wenn aktiv).
  const level = useMemo(
    () =>
      buddyLevelInfo({
        sets,
        foodEntries,
        proteinTarget: settings?.protein_target ?? 0,
        showNutrition,
        today: todayLocal(),
      }),
    [sets, foodEntries, settings?.protein_target, showNutrition],
  )

  const name = profile?.display_name || email?.split('@')[0] || 'Athlet'

  const stats: { v: number; l: string }[] = [
    { v: g.sessions, l: 'Trainings' },
    { v: g.weekStreak, l: g.weekStreak === 1 ? 'Woche Streak' : 'Wochen Streak' },
    { v: level.xp, l: 'XP gesamt' },
  ]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card block w-full text-left transition-colors duration-150 active:bg-sand/60"
      aria-label="Buddy öffnen"
    >
      <div className="flex items-center gap-3">
        <Buddy
          size={64}
          stage={mascotStageIndex(g.sessions)}
          skin={skin}
          mood={g.weekStreak >= 2 ? 'proud' : 'happy'}
          className="-my-2 -ml-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-cocoa">{name}</div>
          {email && <div className="truncate text-xs text-cocoa-light">{email}</div>}
          <div className="mt-0.5 truncate text-sm text-cocoa-light">
            <span className="tabular font-semibold text-cocoa">Buddy-Level {level.level}</span> · {g.rank}
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-sand p-2 text-center">
        {stats.map((s) => (
          <div key={s.l}>
            <div className="tabular text-base font-bold text-cocoa">{s.v.toLocaleString('de-DE')}</div>
            <div className="text-[11px] text-cocoa-light">{s.l}</div>
          </div>
        ))}
      </div>
    </button>
  )
}
