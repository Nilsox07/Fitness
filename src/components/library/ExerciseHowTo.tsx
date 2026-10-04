import type { LibraryExercise } from '../../lib/exerciseLibrary'
import { ExerciseAnimation } from './ExerciseAnimation'

/** Animation + nummerierte „Ausführung"-Schritte eines Bibliotheks-Eintrags. */
export function ExerciseHowTo({ item }: { item: LibraryExercise }) {
  return (
    <div className="space-y-3">
      <ExerciseAnimation images={item.images} alt={`Animation: ${item.name_de}`} className="aspect-[4/3] w-full" />
      <Steps steps={item.steps_de} />
    </div>
  )
}

export function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-cocoa">
          <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand text-[11px] font-bold text-cocoa-light">
            {i + 1}
          </span>
          <span className="min-w-0 pt-px leading-snug">{s}</span>
        </li>
      ))}
    </ol>
  )
}
