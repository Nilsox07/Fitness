import type { LibraryExercise } from '../../lib/exerciseLibrary'
import { Target, TriangleAlert } from 'lucide-react'
import { ExerciseAnimation } from './ExerciseAnimation'

/** Animation + nummerierte „Ausführung"-Schritte eines Bibliotheks-Eintrags. */
export function ExerciseHowTo({ item }: { item: LibraryExercise }) {
  return (
    <div className="space-y-3">
      <ExerciseAnimation item={item} alt={`Animation: ${item.name_de}`} className="aspect-[4/3] w-full" />
      <Steps steps={item.steps_de} />
      <Cues cues={item.cues_de} mistakes={item.mistakes_de} />
    </div>
  )
}

/** „Darauf achten“ (Muskelgefühl) und „Häufige Fehler“ – kurz, unter der Ausführung. */
export function Cues({ cues, mistakes }: { cues?: string[]; mistakes?: string[] }) {
  if (!cues?.length && !mistakes?.length) return null
  return (
    <div className="space-y-3">
      {!!cues?.length && (
        <div className="rounded-2xl bg-brand/10 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
            <Target size={13} /> Darauf achten
          </p>
          <ul className="space-y-1.5">
            {cues.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-cocoa">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!mistakes?.length && (
        <div className="rounded-2xl bg-gold/10 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold">
            <TriangleAlert size={13} /> Häufige Fehler
          </p>
          <ul className="space-y-1.5">
            {mistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-cocoa">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
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
