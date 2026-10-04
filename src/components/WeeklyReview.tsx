import { useEffect, useRef, useState } from 'react'
import { BarChart3, X } from 'lucide-react'
import { useAiStatus } from '../hooks/useAi'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useBodyWeights } from '../hooks/useBodyWeight'
import { combinedWeeklyReview } from '../lib/ai'
import { GOAL_LABEL } from '../lib/nutrition'
import { totalVolume } from '../lib/analytics'
import { usePrefs } from '../lib/prefs'
import {
  getSeenWeekId,
  getStoredReview,
  isoWeekId,
  lastWeekRange,
  markSeen,
  storeReview,
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
  const { data: exercises } = useExercises()
  const { data: foodEntries } = useAllFoodEntries()
  const { data: settings } = useNutritionSettings()
  const { data: weights, isPending: weightsLoading } = useBodyWeights()
  const { showNutrition } = usePrefs()

  const [text, setText] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const tried = useRef(false)

  useEffect(() => {
    if (tried.current) return
    if (!ai?.enabled || !allSets || (showNutrition && !foodEntries) || weightsLoading) return
    tried.current = true

    const weekId = isoWeekId()
    const stored = getStoredReview()

    // Schon für diese Woche erstellt → ggf. nur Popup zeigen.
    if (stored && stored.weekId === weekId) {
      setText(stored.text)
      if (getSeenWeekId() !== weekId) setOpen(true)
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

    ;(async () => {
      try {
        const out = await combinedWeeklyReview({
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
        storeReview({ weekId, text: out, createdAt: new Date().toISOString() })
        setText(out)
        if (getSeenWeekId() !== weekId) setOpen(true)
      } catch {
        /* still im Hintergrund – nächster Öffnen-Versuch probiert erneut */
        tried.current = false
      }
    })()
  }, [ai?.enabled, allSets, foodEntries, exercises, settings, weights, weightsLoading, showNutrition])

  function close() {
    markSeen(isoWeekId())
    setOpen(false)
  }

  if (!open || !text) return null

  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-bold">
            <BarChart3 size={20} className="text-cocoa-light" />
            Dein Wochenfazit
          </h2>
          <button
            className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light"
            onClick={close}
            aria-label="Schließen"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-cocoa">{text}</p>
        <button className="btn-primary w-full" onClick={close}>
          Los geht's
        </button>
      </div>
    </div>
  )
}
