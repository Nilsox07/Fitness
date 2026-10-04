import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Flame, Target } from 'lucide-react'
import { useAllFoodEntries, useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useAllWater, useWater } from '../hooks/useWater'
import { useAllSets } from '../hooks/useWorkouts'
import { sumEntries } from '../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { localDate } from '../lib/day'
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
import { useNutritionPrefs } from '../hooks/usePrefsSync'

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
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
          q.done ? 'anim-check bg-success text-white' : 'bg-sand-dark/40 text-transparent'
        }`}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className={q.done ? 'text-cocoa-light line-through' : 'text-cocoa'}>{q.label}</span>
          <span className="tabular text-cocoa-muted">+{q.xp} XP</span>
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
          <div className={`h-full ${q.done ? 'bg-success' : 'bg-brand/60'}`} style={{ width: `${q.progress}%` }} />
        </div>
      </div>
    </div>
  )
}

/**
 * Ernährungs-Gamification: Level/XP, Streak, Quests, Badges (analog zu Fitness).
 * `compact` (neue App, unter der Buddy-Level-Karte): nur Quests + Kennzahlen — die
 * Ernährungs-XP fließen dort ins Buddy-Level, das auch die einzige Level-up-Feier hat.
 */
export function NutritionGamePanel({ compact = false }: { compact?: boolean } = {}) {
  const { kcalBonus } = useNutritionPrefs()
  const today = localDate()
  const { data: allEntries } = useAllFoodEntries()
  const { data: todayEntries } = useFoodEntries(today)
  const { data: allWater } = useAllWater()
  const { data: water } = useWater(today)
  const { data: settings } = useNutritionSettings()
  const { data: allSets } = useAllSets()

  const g = useMemo(() => {
    const entries = allEntries ?? []
    const proteinTarget = settings?.protein_target ?? 0
    const kcalTarget = kcalTargetFor(settings, trainedOn(today, allSets), kcalBonus)
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
  }, [allEntries, todayEntries, allWater, water, settings, allSets, today, kcalBonus])

  // Level-up-Feier (eigener Zähler, getrennt vom Fitness-Level). Der gespeicherte
  // „gesehene" Level sinkt nie — sonst würde ein kurzzeitig niedrigerer Level
  // (z. B. gelöschter Eintrag) beim Wiederaufstieg erneut Konfetti auslösen.
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    // Erst feiern, wenn die Historie geladen ist (sonst Level 1 → falscher Vergleich).
    if (!allEntries || compact) return
    try {
      const seen = Number(localStorage.getItem('seen_nutrition_level') || '1')
      if (g.xp.level > seen) {
        setCelebrate(true)
        playLevelUp()
        localStorage.setItem('seen_nutrition_level', String(g.xp.level))
      }
    } catch {
      /* ignore */
    }
  }, [g.xp.level, allEntries, compact])

  return (
    <section className="card space-y-3">
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      {celebrate && (
        <div className="anim-fade rounded-xl bg-gold/15 p-2.5 text-center font-bold text-cocoa">
          Ernährungs-Level <span className="tabular">{g.xp.level}</span> erreicht!
        </div>
      )}

      {compact ? (
        <div className="tabular text-xs text-cocoa-light">
          {g.daysLogged} {g.daysLogged === 1 ? 'Tag' : 'Tage'} geloggt · {g.proteinDays}× Eiweißziel
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="text-4xl">{foodMascot(g.xp.level)}</div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-bold">
                Ernährungs-Level <span className="tabular">{g.xp.level}</span>
              </span>
              {g.streak > 0 && (
                <span className="tabular flex items-center gap-1 text-xs text-cocoa-light">
                  <Flame size={14} />
                  {g.streak} Tage
                </span>
              )}
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
              <div className="h-full bg-brand" style={{ width: `${g.xp.progress}%` }} />
            </div>
            <div className="tabular mt-0.5 text-[11px] text-cocoa-muted">
              {g.xp.xpInLevel} / {g.xp.xpForLevel} XP · {g.daysLogged} Tage geloggt
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-sand p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Target size={16} className="text-cocoa-light" />
          Tages-Quests
        </div>
        {g.daily.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
        <div className="flex items-center gap-1.5 pt-1 text-sm font-semibold">
          <CalendarDays size={16} className="text-cocoa-light" />
          Wochen-Quests
        </div>
        {g.weekly.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
      </div>

      {!compact && (
        <>
          <div className="text-sm font-semibold">Ernährungs-Badges</div>
          <div className="grid grid-cols-4 gap-2">
            {g.badges.map((a) => (
              <div
                key={a.id}
                title={a.label}
                className={`flex flex-col items-center rounded-xl p-2 text-center ${
                  a.done ? 'bg-gold/15' : 'bg-sand opacity-40'
                }`}
              >
                <span className="text-xl">{a.icon}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-cocoa-light">{a.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
