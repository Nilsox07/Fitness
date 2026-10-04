import { useMemo, useState } from 'react'
import { ArrowLeftRight, Clock, Flame, Layers, Play, Repeat, Search, Shuffle } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { ExerciseAnimation } from '../library/ExerciseAnimation'
import { searchLibrary, type LibraryExercise } from '../../lib/exerciseLibrary'
import {
  ROUND_REST_SECONDS,
  focusLabel,
  mmss,
  swapCandidates,
  type QuickWorkout,
} from '../../lib/quickWorkout'
import { SectionTitle } from '../food-progress/ui'
import { enter } from '../exercises/muscle'

/** Vorschau: Stationen mit Bild, Gesamtzeit, Runden, Neu mischen, Tauschen, Start. */
export function QuickPreview({
  workout,
  list,
  byId,
  onShuffle,
  onSwap,
  onStart,
  onBack,
}: {
  workout: QuickWorkout
  list: LibraryExercise[]
  byId: Map<string, LibraryExercise>
  onShuffle: () => void
  onSwap: (index: number, exerciseId: string) => void
  onStart: () => void
  onBack: () => void
}) {
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const warm = workout.warmupId ? byId.get(workout.warmupId) : null
  const { config } = workout
  const empty = workout.stations.length === 0

  return (
    <div className="space-y-4">
      {/* Kopf-Karte */}
      <section
        className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
        style={enter(1)}
      >
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
        <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
          <Flame size={13} className="text-brand" /> {focusLabel(config.focus)}
        </p>
        <h2 className="tabular relative mt-1 text-3xl font-bold tracking-tight">~{Math.max(1, Math.round(workout.totalSeconds / 60))} Min</h2>
        <p className="tabular relative text-sm text-bg/70 dark:text-cocoa-light">Gesamtzeit {mmss(workout.totalSeconds)}</p>
        <div className="tabular relative mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: <Layers size={14} />, v: workout.stations.length, l: 'Übungen' },
            { icon: <Repeat size={14} />, v: workout.rounds, l: workout.rounds === 1 ? 'Runde' : 'Runden' },
            { icon: <Clock size={14} />, v: `${workout.work}/${workout.rest}`, l: 'Sek. Arbeit/Pause' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-bg/10 px-1 py-2 dark:bg-white/5">
              <div className="flex items-center justify-center gap-1 text-lg font-bold">
                <span className="text-brand">{s.icon}</span>
                {s.v}
              </div>
              <div className="truncate text-[10px] text-bg/60 dark:text-cocoa-light">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {empty ? (
        <p className="rounded-2xl bg-cream p-4 text-center text-sm text-cocoa-light">
          Für diese Auswahl gibt es keine passenden Übungen. Probier einen anderen Fokus oder mehr Ausrüstung.
        </p>
      ) : (
        <section style={enter(2)}>
          <SectionTitle
            right={
              workout.rounds > 1 ? `${workout.rounds} × · ${ROUND_REST_SECONDS} s Pause zwischen Runden` : undefined
            }
          >
            Stationen
          </SectionTitle>
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {warm && (
              <li className="flex items-center gap-3 px-2.5 py-2">
                <ExerciseAnimation images={warm.images} alt="" still className="h-12 w-12 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-cocoa">{warm.name_de}</span>
                  <span className="block text-xs text-cocoa-light">Aufwärmen · 30 s</span>
                </span>
              </li>
            )}
            {workout.stations.map((id, i) => {
              const ex = byId.get(id)
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-3 px-2.5 py-2">
                  <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand text-[10px] font-bold text-cocoa-light">
                    {i + 1}
                  </span>
                  <ExerciseAnimation images={ex?.images ?? []} alt="" still className="h-12 w-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cocoa">{ex?.name_de ?? id}</span>
                    <span className="block truncate text-xs text-cocoa-light">
                      {ex ? `${ex.muscle} · ${ex.equipment}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwapIndex(i)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition active:scale-95"
                    aria-label={`${ex?.name_de ?? 'Übung'} tauschen`}
                    title="Tauschen"
                  >
                    <ArrowLeftRight size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1" style={enter(3)}>
        <button type="button" className="btn-ghost gap-1.5 px-3.5" onClick={onShuffle}>
          <Shuffle size={16} /> Neu mischen
        </button>
        <button
          type="button"
          className="btn-primary gap-2 py-3.5 text-base shadow-md shadow-brand/25"
          onClick={onStart}
          disabled={empty}
        >
          <Play size={18} fill="currentColor" /> Start
        </button>
      </div>
      <button type="button" className="w-full py-1 text-sm font-medium text-cocoa-light" onClick={onBack}>
        Einstellungen ändern
      </button>

      {swapIndex != null && (
        <SwapSheet
          list={list}
          workout={workout}
          currentName={byId.get(workout.stations[swapIndex])?.name_de ?? 'Übung'}
          onPick={(id) => {
            onSwap(swapIndex, id)
            setSwapIndex(null)
          }}
          onClose={() => setSwapIndex(null)}
        />
      )}
    </div>
  )
}

/** Übung tauschen: Bibliothek, gefiltert auf Zuhause + Fokus + Ausrüstung. */
function SwapSheet({
  list,
  workout,
  currentName,
  onPick,
  onClose,
}: {
  list: LibraryExercise[]
  workout: QuickWorkout
  currentName: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(30)
  const exclude = useMemo(
    () => [...workout.stations, ...(workout.warmupId ? [workout.warmupId] : [])],
    [workout.stations, workout.warmupId],
  )
  const candidates = useMemo(() => swapCandidates(list, workout.config, exclude), [list, workout.config, exclude])
  const results = useMemo(
    () => (query.trim() ? searchLibrary(candidates, { query }) : candidates),
    [candidates, query],
  )
  const shown = results.slice(0, limit)

  return (
    <Sheet title="Übung tauschen" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-cocoa-light">
          Ersatz für <span className="font-semibold text-cocoa">{currentName}</span> · {focusLabel(workout.config.focus)},
          für zu Hause
        </p>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted" />
          <input
            className="input pl-9"
            type="search"
            placeholder="Suchen …"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(30)
            }}
            aria-label="Übungen durchsuchen"
          />
        </div>
        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-cocoa-light">Keine passende Übung gefunden.</p>
        ) : (
          <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand-light">
            {shown.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.id)}
                  className="flex w-full items-center gap-3 px-2.5 py-2 text-left"
                >
                  <ExerciseAnimation images={item.images} alt="" still className="h-14 w-14 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-cocoa">{item.name_de}</span>
                    <span className="block truncate text-xs text-cocoa-light">
                      {item.muscle} · {item.equipment} · {item.level}
                    </span>
                  </span>
                  <ArrowLeftRight size={16} className="shrink-0 text-cocoa-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {results.length > shown.length && (
          <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + 30)}>
            Mehr anzeigen ({results.length - shown.length})
          </button>
        )}
      </div>
    </Sheet>
  )
}
