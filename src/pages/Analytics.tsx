import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { useAllSets } from '../hooks/useWorkouts'
import { usePrefs } from '../lib/prefs'
import { FitnessStats } from '../components/stats/FitnessStats'
import { FoodStats } from '../components/stats/FoodStats'
import { ProgressHeader } from '../components/progress/ProgressHeader'

/** Statistik der aktiven Welt (Fitness oder Ernährung). */
function NewAnalytics() {
  const { world, setWorld, showNutrition } = usePrefs()
  const [params] = useSearchParams()
  // Aus der Fortschritt-Übersicht: ?view=food|strength wählt den Bereich
  const view = params.get('view')
  useEffect(() => {
    if (view === 'food' && showNutrition) setWorld('food')
    else if (view === 'strength') setWorld('fitness')
  }, [view, showNutrition, setWorld])
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const sets = allSets ?? []

  const effective = view === 'food' && showNutrition ? 'food' : view === 'strength' ? 'fitness' : world
  if (effective === 'food') {
    return (
      <div className="space-y-5">
        <FoodStats />
      </div>
    )
  }

  // Fitness: Kopf (Titel, Zeitraum, Umschalter) rendert FitnessStats selbst.
  return (
    <div className="space-y-6">
      {sets.length > 0 ? (
        <FitnessStats sets={sets} exercises={exercises ?? []} />
      ) : (
        <>
          <ProgressHeader title="Kraft" subtitle="Noch keine Trainings" />
          <p className="text-cocoa-light">Noch keine Daten — erfasse dein erstes Training.</p>
        </>
      )}
    </div>
  )
}

export default function Analytics() {
  return <NewAnalytics />
}
