import { useEffect, useMemo, useState } from 'react'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useAllWater, useWater } from '../hooks/useWater'
import { sumEntries } from '../lib/nutrition'
import { levelInfo, type Quest } from '../lib/xp'
import {
  byDay,
  computeNutritionXp,
  nutritionAchievements,
  nutritionDailyQuests,
  nutritionStreak,
  nutritionWeeklyQuests,
} from '../lib/nutritionXp'
import { Confetti } from './Confetti'
import { playLevelUp } from '../lib/sound'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function foodMascot(level: number): string {
  if (level >= 20) return '🏆'
  if (level >= 12) return '🥇'
  if (level >= 8) return '🥗'
  if (level >= 4) return '🍎'
  return '🌱'
}

function QuestRow({ q }: { q: Quest }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
          q.done ? 'bg-brand text-white' : 'text-transparent ring-1 ring-sand-dark'
        }`}
      >
        ✓
      </span>
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className={q.done ? 'text-cocoa-light line-through' : 'text-cocoa'}>{q.label}</span>
          <span className="text-cocoa-muted">+{q.xp} XP</span>
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
          <div className={`h-full bg-brand ${q.done ? '' : 'opacity-60'}`} style={{ width: `${q.progress}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Ernährungs-Gamification: Level/XP, Streak, Quests, Badges (analog zu Fitness). */
export function NutritionGamePanel() {
  const today = todayLocal()
  const { data: allEntries } = useAllFoodEntries()
  const { data: todayEntries } = useFoodEntries(today)
  const { data: allWater } = useAllWater()
  const { data: water } = useWater(today)
  const { data: settings } = useNutritionSettings()

  const g = useMemo(() => {
    const entries = allEntries ?? []
    const proteinTarget = settings?.protein_target ?? 0
    const kcalTarget = settings?.kcal_target ?? 0
    const waterTarget = settings?.water_target_ml || 2500
    const days = byDay(entries)
    const dates = new Set(days.keys())
    const streak = nutritionStreak(dates, today)
    const proteinDays = proteinTarget > 0
      ? [...days.values()].filter((d) => d.protein >= proteinTarget).length
      : 0
    const waterGoalDays = (allWater ?? []).filter((w) => w.ml >= waterTarget).length
    const totalsToday = sumEntries(todayEntries ?? [])

    return {
      xp: levelInfo(computeNutritionXp(entries, proteinTarget, today)),
      streak,
      daysLogged: days.size,
      proteinDays,
      daily: nutritionDailyQuests({
        loggedToday: (todayEntries?.length ?? 0) > 0,
        protein: totalsToday.protein,
        proteinTarget,
        kcal: totalsToday.kcal,
        kcalTarget,
        waterMl: water?.ml ?? 0,
        waterTarget,
      }),
      weekly: nutritionWeeklyQuests(entries, proteinTarget),
      badges: nutritionAchievements({ daysLogged: days.size, streak, proteinDays, waterGoalDays }),
    }
  }, [allEntries, todayEntries, allWater, water, settings, today])

  // Level-up-Feier (eigener Zähler, getrennt vom Fitness-Level)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    try {
      const seen = Number(localStorage.getItem('seen_nutrition_level') || '1')
      if (g.xp.level > seen) {
        setCelebrate(true)
        playLevelUp()
        localStorage.setItem('seen_nutrition_level', String(g.xp.level))
      } else if (g.xp.level < seen) {
        localStorage.setItem('seen_nutrition_level', String(g.xp.level))
      }
    } catch {
      /* ignore */
    }
  }, [g.xp.level])

  return (
    <section className="card space-y-3">
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      {celebrate && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-brand p-2.5 text-center font-bold text-white">
          🥗 Ernährungs-Level {g.xp.level} erreicht!
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-4xl">{foodMascot(g.xp.level)}</div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">Ernährungs-Level {g.xp.level}</span>
            {g.streak > 0 && <span className="text-xs text-cocoa-light">🔥 {g.streak} Tage</span>}
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
            <div className="h-full bg-brand" style={{ width: `${g.xp.progress}%` }} />
          </div>
          <div className="mt-0.5 text-[11px] text-cocoa-muted">
            {g.xp.xpInLevel} / {g.xp.xpForLevel} XP · {g.daysLogged} Tage geloggt
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-sand/40 p-3">
        <div className="text-sm font-semibold">🎯 Tages-Quests</div>
        {g.daily.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
        <div className="pt-1 text-sm font-semibold">📅 Wochen-Quests</div>
        {g.weekly.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
      </div>

      <div className="text-sm font-semibold">Ernährungs-Badges</div>
      <div className="grid grid-cols-4 gap-2">
        {g.badges.map((a) => (
          <div
            key={a.id}
            title={a.label}
            className={`flex flex-col items-center rounded-xl p-2 text-center ${
              a.done ? 'bg-sand-light ring-1 ring-sand-dark' : 'opacity-35'
            }`}
          >
            <span className="text-xl">{a.icon}</span>
            <span className="mt-0.5 text-[10px] leading-tight text-cocoa-light">{a.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
