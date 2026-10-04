import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, Flame, Target } from 'lucide-react'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useWater } from '../../hooks/useWater'
import { useAllSets } from '../../hooks/useWorkouts'
import { kcalTargetFor, trainedOn } from '../../lib/dayTarget'
import { localDate } from '../../lib/day'
import { sumEntries } from '../../lib/nutrition'
import {
  byDay,
  nutritionDailyQuests,
  nutritionStreak,
  nutritionWeeklyQuests,
} from '../../lib/nutritionXp'
import { NutritionGamePanel } from '../NutritionGamePanel'
import { Ring } from '../nutrition-home/Ring'
import { MyBuddy } from '../buddy/MyBuddy'
import { BuddyLevelUp } from '../buddy/BuddyLevelUp'
import { useBuddyLevel } from '../buddy/useBuddy'
import { nf } from '../stats/shared'
import { useNutritionPrefs } from '../../hooks/usePrefsSync'

/**
 * Kompakte Gamification-Karte: Buddy im XP-Ring, Buddy-Level (Training + Ernährung),
 * Serie, Quests; aufklappbar.
 */
export function NutritionGameCard({ style }: { style?: CSSProperties }) {
  const { kcalBonus } = useNutritionPrefs()
  const today = localDate()
  const { data: allEntries } = useAllFoodEntries()
  const { data: todayEntries } = useFoodEntries(today)
  const { data: water } = useWater(today)
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()

  const g = useMemo(() => {
    const entries = allEntries ?? []
    const proteinTarget = settings?.protein_target ?? 0
    const kcalTarget = kcalTargetFor(settings, trainedOn(today, allSets), kcalBonus)
    const totals = sumEntries(todayEntries ?? [])
    const quests = [
      ...nutritionDailyQuests({
        loggedToday: (todayEntries?.length ?? 0) > 0,
        protein: totals.protein,
        proteinTarget,
        kcal: totals.kcal,
        kcalTarget,
        waterMl: water?.ml ?? 0,
        waterTarget: settings?.water_target_ml || 2500,
      }),
      ...nutritionWeeklyQuests(entries, proteinTarget),
    ]
    return {
      streak: nutritionStreak(new Set(byDay(entries).keys()), today),
      open: quests.filter((q) => !q.done).length,
    }
  }, [allEntries, todayEntries, water, settings, allSets, today, kcalBonus])
  const level = useBuddyLevel()
  const [open, setOpen] = useState(false)

  return (
    <section className="space-y-5" style={style}>
      <BuddyLevelUp />
      <button
        className="card flex w-full items-center gap-3 text-left transition active:scale-[0.99]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Ring size={52} stroke={4} progress={level.progress / 100} trackClass="stroke-sand-dark/50">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-sand">
            <MyBuddy size={40} mood="happy" animate={false} />
          </span>
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
            Buddy-Level
          </span>
          <span className="tabular flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-cocoa">Level {level.level}</span>
            <span className="text-xs text-cocoa-light">
              {nf(level.xpInLevel)} / {nf(level.xpForLevel)} XP
            </span>
          </span>
          <span className="tabular mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-cocoa-light">
            <span className="flex items-center gap-0.5 rounded-full bg-sand px-2 py-0.5">
              <Flame size={11} className={g.streak > 0 ? 'text-brand' : ''} />
              {g.streak} {g.streak === 1 ? 'Tag' : 'Tage'}
            </span>
            <span
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 ${
                g.open === 0 ? 'bg-success/15 text-success' : 'bg-sand'
              }`}
            >
              <Target size={11} />
              {g.open === 0 ? 'Alle Quests erledigt' : `${g.open} Quests offen`}
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Bleibt gemountet, damit Effekte (z. B. Freeze-Vergabe) weiterlaufen. */}
      <div className={open ? 'anim-fade space-y-5' : 'hidden'}>
        <NutritionGamePanel compact />
      </div>
    </section>
  )
}
