import { Check, Flame, Layers, Repeat, RotateCcw, Save, Timer, TriangleAlert } from 'lucide-react'
import { MyBuddy } from '../buddy/MyBuddy'
import { useBodyWeights } from '../../hooks/useBodyWeight'
import { useNutritionSettings } from '../../hooks/useNutrition'
import type { LibraryExercise } from '../../lib/exerciseLibrary'
import { estimateKcal, mmss, type QuickWorkout } from '../../lib/quickWorkout'
import { enter } from '../exercises/muscle'
import type { QuickResult } from './QuickPlayer'
import { useSaveQuickWorkout } from './useSaveQuickWorkout'

const FALLBACK_KG = 75

/** Körpergewicht: letzter Eintrag, sonst Ernährungs-Einstellungen, sonst 75 kg. */
function useBodyKg(): number {
  const { data: weights } = useBodyWeights()
  const { data: settings } = useNutritionSettings()
  const latest = weights?.length ? weights[weights.length - 1].weight_kg : null
  const kg = latest ?? settings?.weight_kg ?? FALLBACK_KG
  return Number.isFinite(kg) && kg > 0 ? kg : FALLBACK_KG
}

/** Abschluss: Buddy jubelt, Zusammenfassung, Speichern als heutiges Training. */
export function QuickFinish({
  workout,
  result,
  list,
  onAgain,
  onDone,
}: {
  workout: QuickWorkout
  result: QuickResult
  list: LibraryExercise[]
  onAgain: () => void
  onDone: () => void
}) {
  const kg = useBodyKg()
  const kcal = estimateKcal(result.activeSeconds, kg)
  const exercises = new Set(result.work.map((w) => w.exerciseId)).size
  const { save, ready, saving, saved, error, appending } = useSaveQuickWorkout(list)
  const nothing = result.work.length === 0

  const stats = [
    { icon: <Timer size={15} />, v: mmss(result.activeSeconds), l: 'Dauer' },
    { icon: <Layers size={15} />, v: exercises, l: exercises === 1 ? 'Übung' : 'Übungen' },
    { icon: <Repeat size={15} />, v: `${result.rounds}/${workout.rounds}`, l: 'Runden' },
    { icon: <Flame size={15} />, v: `~${kcal}`, l: 'kcal' },
  ]

  return (
    <div className="space-y-4 pb-4">
      <section className="flex flex-col items-center pt-2 text-center" style={enter(0)}>
        <div className="relative grid h-32 w-32 place-items-center">
          <span className="absolute inset-0 rounded-full bg-brand/15 blur-2xl" aria-hidden />
          <MyBuddy size={124} mood={nothing ? 'happy' : 'cheer'} animate className="relative" />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {nothing ? 'Nächstes Mal!' : result.completed ? 'Geschafft!' : 'Gut gemacht!'}
        </h1>
        <p className="mt-1 max-w-xs text-sm text-cocoa-light">
          {nothing
            ? 'Diesmal ist noch keine Übung zusammengekommen.'
            : result.completed
              ? 'Komplettes Schnell-Workout durchgezogen – dein Buddy ist stolz auf dich.'
              : 'Jede Minute zählt. Speicher, was du geschafft hast.'}
        </p>
      </section>

      <section className="grid grid-cols-4 gap-2" style={enter(1)}>
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl bg-cream px-1 py-3 text-center">
            <div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-brand">{s.icon}</div>
            <div className="tabular mt-1.5 text-base font-bold leading-tight">{s.v}</div>
            <div className="truncate text-[11px] text-cocoa-light">{s.l}</div>
          </div>
        ))}
      </section>
      <p className="tabular -mt-2 text-center text-[11px] text-cocoa-muted" style={enter(1)}>
        kcal geschätzt (MET 8 × {Math.round(kg)} kg)
      </p>

      <div className="space-y-2" style={enter(2)}>
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
            <TriangleAlert size={16} className="shrink-0" /> {error}
          </p>
        )}
        {saved ? (
          <>
            <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-semibold text-success">
              <Check size={16} strokeWidth={3} /> Als heutiges Training gespeichert
            </p>
            <button type="button" className="btn-primary w-full py-3.5 text-base" onClick={onDone}>
              Fertig
            </button>
          </>
        ) : (
          !nothing && (
            <>
              <button
                type="button"
                className="btn-primary w-full gap-2 py-3.5 text-base shadow-md shadow-brand/25"
                onClick={() => save(result, workout.config.minutes)}
                disabled={!ready || saving}
              >
                <Save size={18} /> {saving ? 'Speichere…' : !ready ? 'Lädt…' : 'Speichern'}
              </button>
              <p className="text-center text-xs text-cocoa-muted">
                {appending ? 'Wird an dein heutiges Training angehängt.' : 'Zählt für Streak, Duell & Buddy.'}
              </p>
            </>
          )
        )}
        <button type="button" className="btn-ghost w-full gap-1.5" onClick={onAgain}>
          <RotateCcw size={16} /> Neues Schnell-Workout
        </button>
        {!saved && (
          <button type="button" className="w-full py-1 text-sm font-medium text-cocoa-light" onClick={onDone}>
            {nothing ? 'Schließen' : 'Ohne Speichern schließen'}
          </button>
        )}
      </div>
    </div>
  )
}
