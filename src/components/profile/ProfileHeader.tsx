import { useMemo } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { FoodEntry, SetWithDate } from '../../types'
import { frequencyStats } from '../../lib/analytics'
import { rankForSessions } from '../../lib/gamification'
import { mascotStageIndex } from '../../lib/cosmetics'
import { Buddy } from '../buddy/Buddy'
import { buddyLevelInfo } from '../../lib/buddyLevel'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { useMyProfile } from '../../hooks/useSocial'
import { enter } from '../home/motion'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Profil-Kopf: Buddy, Name, Buddy-Level mit XP-Balken und ein paar Kennzahlen. Tippen → Buddy-Seite. */
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
  const toNext = Math.max(0, level.xpForLevel - level.xpInLevel)

  const stats: { v: number; l: string }[] = [
    { v: g.sessions, l: 'Trainings' },
    { v: g.weekStreak, l: g.weekStreak === 1 ? 'Woche Serie' : 'Wochen Serie' },
    { v: level.xp, l: 'XP gesamt' },
  ]

  return (
    <button
      type="button"
      onClick={onOpen}
      style={enter(0)}
      className="relative block w-full overflow-hidden rounded-3xl bg-cocoa p-4 text-left text-bg shadow-lg shadow-black/10 transition active:scale-[0.99] dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      aria-label={`Buddy öffnen – Level ${level.level}`}
    >
      {/* dezenter Brand-Schimmer */}
      <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative -my-1 -ml-1 shrink-0">
          <div className="pointer-events-none absolute inset-2 rounded-full bg-brand/25 blur-2xl" aria-hidden />
          <Buddy
            size={88}
            stage={mascotStageIndex(g.sessions)}
            skin={skin}
            mood={g.weekStreak >= 2 ? 'proud' : 'happy'}
            className="relative"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold tracking-tight">{name}</div>
          {email && <div className="truncate text-xs text-bg/60 dark:text-cocoa-light">{email}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="tabular flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-on-brand">
              <Sparkles size={11} strokeWidth={2.5} />
              Level {level.level}
            </span>
            <span className="truncate rounded-full bg-bg/10 px-2.5 py-0.5 text-xs font-medium text-bg/85 dark:bg-white/5 dark:text-cocoa">
              {g.rank}
            </span>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-bg/50 dark:text-cocoa-muted" />
      </div>

      {/* XP-Balken */}
      <div className="relative mt-4">
        <div className="flex items-baseline justify-between text-[11px] font-medium text-bg/60 dark:text-cocoa-light">
          <span className="tabular">
            {level.xpInLevel.toLocaleString('de-DE')} / {level.xpForLevel.toLocaleString('de-DE')} XP
          </span>
          <span className="tabular">noch {toNext.toLocaleString('de-DE')} bis Lv {level.level + 1}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg/15 dark:bg-sand-dark/60">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(2, Math.min(100, level.progress))}%` }}
          />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl bg-bg/10 px-1 py-2 dark:bg-white/5">
            <div className="tabular text-lg font-bold leading-tight">{s.v.toLocaleString('de-DE')}</div>
            <div className="truncate text-[11px] text-bg/60 dark:text-cocoa-light">{s.l}</div>
          </div>
        ))}
      </div>
    </button>
  )
}
