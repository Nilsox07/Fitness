import { useMemo } from 'react'
import { ChevronRight, Dumbbell, Plus } from 'lucide-react'
import { onlyWorking, summarizeSessions } from '../../lib/analytics'
import type { Exercise, SetWithDate } from '../../types'
import type { LibraryExercise } from '../../lib/exerciseLibrary'
import { ExerciseAnimation } from '../library/ExerciseAnimation'
import { MuscleAvatar, Sparkline } from './MuscleBits'
import { enter, muscleTint } from './muscle'

const kg = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/** „zuletzt 3×8 · 80 kg" aus der letzten Session (nur ausgeführte Arbeitssätze). */
export function lastPerformance(sets: SetWithDate[]): string | null {
  const working = onlyWorking(sets) // ohne leere Vorlagen-Sätze (0 Wdh)
  if (working.length === 0) return null
  const lastDate = working.reduce((d, s) => (s.date > d ? s.date : d), '')
  const day = working.filter((s) => s.date === lastDate)
  const top = Math.max(...day.map((s) => s.weight))
  const atTop = day.filter((s) => s.weight === top)
  const reps = atTop.map((s) => s.reps)
  const sameReps = reps.every((r) => r === reps[0])
  const scheme = sameReps ? `${atTop.length}×${reps[0]}` : `${atTop.length} Sätze`
  return top > 0 ? `zuletzt ${scheme} · ${kg(top)} kg` : `zuletzt ${scheme}`
}

const SPARK_SESSIONS = 8

/**
 * Übungsliste (Neu-Modus): Avatar (bzw. Bibliotheks-Vorschaubild, wenn
 * verknüpft), letzte Leistung, Mini-Verlauf des besten Satzes.
 */
export function ExerciseListNew({
  exercises,
  setsByExercise,
  onOpen,
  thumbs,
}: {
  exercises: Exercise[]
  setsByExercise: Map<string, SetWithDate[]>
  onOpen: (ex: Exercise) => void
  /** Übungs-ID → verknüpfter Bibliotheks-Eintrag (Vorschaubild statt Avatar). */
  thumbs?: Map<string, LibraryExercise>
}) {
  const rows = useMemo(
    () =>
      exercises.map((ex) => {
        const sets = setsByExercise.get(ex.id) ?? []
        const sessions = summarizeSessions(onlyWorking(sets)).slice(-SPARK_SESSIONS)
        // Bester Satz je Session (geschätztes 1RM; bei reinen Wdh.-Übungen ohne Gewicht 0 → Volumen)
        const trend = sessions.map((s) => (s.bestEstimated1RM > 0 ? s.bestEstimated1RM : s.volume))
        return { ex, perf: lastPerformance(sets), trend }
      }),
    [exercises, setsByExercise],
  )

  return (
    <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream" style={enter(2)}>
      {rows.map(({ ex, perf, trend }) => {
        const t = muscleTint(ex.muscle_group)
        const up = trend.length >= 2 && trend[trend.length - 1] >= trend[0]
        return (
          <li key={ex.id}>
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-sand-light"
              onClick={() => onOpen(ex)}
            >
              {thumbs?.get(ex.id) ? (
                <ExerciseAnimation
                  images={thumbs.get(ex.id)!.images}
                  alt=""
                  still
                  className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-sand-dark/40"
                />
              ) : (
                <MuscleAvatar muscle={ex.muscle_group} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-cocoa">{ex.name}</span>
                <span className="block truncate text-xs text-cocoa-light">
                  {perf ? (
                    <span className="tabular">{perf}</span>
                  ) : (
                    <>
                      <span className={`font-medium ${t.text}`}>{ex.muscle_group}</span>
                      <span className="text-cocoa-muted"> · noch nicht trainiert</span>
                    </>
                  )}
                </span>
              </span>
              {trend.length >= 2 && (
                <Sparkline
                  values={trend}
                  strokeClass={up ? 'stroke-success' : 'stroke-cocoa-muted'}
                  fillClass={up ? 'fill-success' : 'fill-cocoa-muted'}
                />
              )}
              <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Leerer Zustand der Übungsliste. */
export function ExerciseEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-8 text-center" style={enter(2)}>
      <div className="relative grid h-16 w-16 place-items-center rounded-full bg-sand text-brand">
        <span className="absolute inset-0 rounded-full bg-brand/10 blur-md" aria-hidden />
        <Dumbbell size={28} className="relative" />
      </div>
      <div>
        <h2 className="font-semibold">Noch keine Übungen</h2>
        <p className="mt-1 text-sm text-cocoa-light">Leg deine erste Übung an — danach siehst du hier deinen Verlauf.</p>
      </div>
      <button className="btn-primary gap-1.5" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.5} /> Übung anlegen
      </button>
    </div>
  )
}
