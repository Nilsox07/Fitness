import { useEffect, useMemo, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import { PremiumSheet, SheetHero } from './ui/PremiumSheet'
import { useAiStatus } from '../hooks/useAi'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useBodyWeights } from '../hooks/useBodyWeight'
import { weeklyReviewData } from '../lib/ai'
import { WeeklyReviewView } from './review/WeeklyReviewView'
import { GOAL_LABEL } from '../lib/nutrition'
import { sessionDates, totalVolume } from '../lib/analytics'
import { useWeeklyGoal } from '../hooks/usePrefsSync'
import { MyBuddy } from './buddy/MyBuddy'
import { usePrefs } from '../lib/prefs'
import {
  getSeenWeekId,
  getStoredReview,
  isoWeekId,
  lastWeekRange,
  markSeen,
  storeReview,
  type StoredReview,
  weekBodyweight,
  weekPrCount,
} from '../lib/weeklyReview'

/**
 * Erzeugt ab Montag automatisch EIN Gesamt-Wochenfazit (Training + Ernährung)
 * und zeigt es als Popup. Läuft im Hintergrund, einmal pro Kalenderwoche.
 */
export function WeeklyReview() {
  const { data: ai } = useAiStatus()
  const { data: allSets } = useAllSets()
  const weeklyGoal = useWeeklyGoal()
  const { data: exercises } = useExercises()
  const { data: foodEntries } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: weights, isPending: weightsLoading } = useBodyWeights()
  const { showNutrition } = usePrefs()

  const [review, setReview] = useState<StoredReview | null>(null)
  const [open, setOpen] = useState(false)
  const tried = useRef(false)

  // Erst nach der Start-Animation zeigen, damit man das Einfliegen von unten sieht.
  const show = () => window.setTimeout(() => setOpen(true), 1400)

  useEffect(() => {
    if (tried.current) return
    if (!ai?.enabled || !allSets || (showNutrition && !foodEntries) || weightsLoading) return
    tried.current = true

    const weekId = isoWeekId()
    const stored = getStoredReview()

    // Schon für diese Woche im neuen Format erstellt → ggf. nur Popup zeigen.
    // (Altes Fließtext-Fazit dieser Woche wird einmal im neuen Format neu erzeugt.)
    if (stored && stored.weekId === weekId && stored.data) {
      setReview(stored)
      if (getSeenWeekId() !== weekId) show()
      return
    }

    const { start, end, label } = lastWeekRange()
    const weekSets = allSets.filter((s) => s.date >= start && s.date <= end)
    // Ernährung ausgeblendet → keine Essensdaten an die KI schicken.
    const weekFood = showNutrition
      ? (foodEntries ?? []).filter((e) => e.date >= start && e.date <= end)
      : []
    // Nur erzeugen, wenn es überhaupt Daten der Vorwoche gibt.
    if (weekSets.length === 0 && weekFood.length === 0) return

    const byId = new Map((exercises ?? []).map((e) => [e.id, e]))
    const muscleCount = new Map<string, number>()
    for (const s of weekSets) {
      const mg = byId.get(s.exercise_id)?.muscle_group
      if (mg) muscleCount.set(mg, (muscleCount.get(mg) ?? 0) + 1)
    }
    const topMuscles = [...muscleCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m]) => m)

    const foodByDay = new Map<string, { kcal: number; protein: number }>()
    for (const e of weekFood) {
      const d = foodByDay.get(e.date) ?? { kcal: 0, protein: 0 }
      d.kcal += e.kcal
      d.protein += e.protein
      foodByDay.set(e.date, d)
    }
    const daysLogged = foodByDay.size
    const avgKcal = daysLogged
      ? Math.round([...foodByDay.values()].reduce((s, d) => s + d.kcal, 0) / daysLogged)
      : 0
    const avgProtein = daysLogged
      ? Math.round([...foodByDay.values()].reduce((s, d) => s + d.protein, 0) / daysLogged)
      : 0

    // Gewichtsverlauf NUR innerhalb der ausgewerteten Woche (erste vs. letzte Messung).
    const bodyweight = weekBodyweight(weights ?? [], start, end)

    const sessions = new Set(weekSets.map((s) => s.date)).size
    const stats = {
      sessions,
      sessionGoal: weeklyGoal,
      volumeKg: Math.round(totalVolume(weekSets)),
      prs: weekPrCount(allSets, start, end),
      daysLogged: showNutrition ? daysLogged : null,
      avgKcal: showNutrition && daysLogged ? avgKcal : null,
      kcalTarget: showNutrition && settings?.kcal_target ? settings.kcal_target : null,
      avgProtein: showNutrition && daysLogged ? avgProtein : null,
      proteinTarget: showNutrition && settings?.protein_target ? settings.protein_target : null,
      weightDelta: bodyweight ? Math.round((bodyweight.current - bodyweight.start) * 10) / 10 : null,
    }

    ;(async () => {
      try {
        const data = await weeklyReviewData({
          weekLabel: label,
          goalLabel: settings ? GOAL_LABEL[settings.goal] : 'kein Ziel gesetzt',
          training: {
            sessions: new Set(weekSets.map((s) => s.date)).size,
            volumeKg: Math.round(totalVolume(weekSets)),
            prs: weekPrCount(allSets, start, end),
            topMuscles,
          },
          // Ernährung ausgeblendet → null (reines Trainingsfazit, keine Essensdaten).
          nutrition: showNutrition
            ? {
                daysLogged,
                avgKcal,
                avgProtein,
                target: settings ? { kcal: settings.kcal_target, protein: settings.protein_target } : null,
              }
            : null,
          bodyweight,
        })
        const r: StoredReview = { weekId, text: '', createdAt: new Date().toISOString(), data, stats }
        storeReview(r)
        setReview(r)
        if (getSeenWeekId() !== weekId) show()
      } catch {
        /* still im Hintergrund – nächster Öffnen-Versuch probiert erneut */
        tried.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai?.enabled, allSets, foodEntries, exercises, settings, weights, weightsLoading, showNutrition])

  // Buddy ist stolz, wenn die Vorwoche das (persönliche) Wochenziel erreicht hat.
  const goalReached = useMemo(() => {
    const { start, end } = lastWeekRange()
    return sessionDates((allSets ?? []).filter((s) => s.date >= start && s.date <= end)).length >= weeklyGoal
  }, [allSets, weeklyGoal])

  function close() {
    markSeen(isoWeekId())
    setOpen(false)
  }

  if (!open || !review) return null

  return (
    <PremiumSheet
      title="Dein Wochenfazit"
      onClose={close}
      z="z-40"
      hero={
        <SheetHero
          art={<MyBuddy size={88} mood={goalReached ? 'proud' : 'happy'} />}
          title="Dein Wochenfazit"
          subtitle={`von deinem Buddy · ${lastWeekRange().label}`}
        />
      }
      footer={
        <button className="btn-primary w-full rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25" onClick={close}>
          Los geht's
        </button>
      }
    >
      {goalReached && (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <Trophy size={13} />
            Wochenziel geschafft
          </span>
        </div>
      )}
      <WeeklyReviewView review={review} />
    </PremiumSheet>
  )
}
