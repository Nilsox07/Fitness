import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Weight,
  X,
} from 'lucide-react'
import { usePrefs } from '../lib/prefs'
import { useExercises } from '../hooks/useExercises'
import {
  newId,
  useAddSet,
  useAllSets,
  useCreateWorkout,
  useDeleteWorkout,
  useWorkouts,
} from '../hooks/useWorkouts'
import { FoodDays } from '../components/FoodDays'
import { dayLabel, trainingDay } from '../lib/day'
import { EditableSetRow } from '../components/EditableSetRow'
import { frequencyStats, isPerformed, sessionDates, setVolume, totalVolume } from '../lib/analytics'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { MonthHeatmap } from '../components/progress/MonthHeatmap'
import {
  formatVolume,
  mondayOf,
  weekGroupLabel,
  workoutMetas,
  type WorkoutMeta,
} from '../components/progress/progressUtils'
import { enter } from '../components/home/motion'
import type { Exercise, SetWithDate, Workout } from '../types'

export default function History() {
  const { isNew, world } = usePrefs()
  const { data: workouts, isLoading } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const deleteWorkout = useDeleteWorkout()
  const addSet = useAddSet()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const createWorkout = useCreateWorkout()
  const [backfill, setBackfill] = useState(false)
  // Standard = heutiger Trainings-Tag (Wechsel um 4 Uhr, wie im Training)
  const [backfillDate, setBackfillDate] = useState(() => trainingDay())

  /** Vergessenes Training nachtragen (oder bestehendes an dem Tag öffnen). */
  function startBackfill() {
    const existing = workouts?.find((w) => w.date === backfillDate)
    setBackfill(false)
    if (existing) {
      setOpenId(existing.id)
      setEditId(existing.id)
      return
    }
    // ID im Client erzeugen → sofort öffnen (auch offline, ohne auf den Server zu warten)
    const id = newId()
    createWorkout.mutate({ id, date: backfillDate })
    setOpenId(id)
    setEditId(id)
  }

  const exName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Übung'

  function addSetToGroup(workoutId: string, ex: Exercise, exSets: SetWithDate[]) {
    const sorted = [...exSets].sort((a, b) => a.set_number - b.set_number)
    const last = sorted[sorted.length - 1]
    const next = exSets.reduce((m, s) => Math.max(m, s.set_number), 0) + 1
    addSet.mutate({
      workout_id: workoutId,
      exercise_id: ex.id,
      set_number: next,
      reps: last?.reps ?? ex.target_rep_min,
      weight: last?.weight ?? 20,
      reps_right: ex.unilateral ? (last?.reps_right ?? last?.reps ?? ex.target_rep_min) : null,
      weight_right: ex.unilateral ? (last?.weight_right ?? last?.weight ?? 20) : null,
      set_type: last?.set_type ?? 'working',
      to_failure: last?.to_failure ?? true,
    })
  }

  function addExerciseToWorkout(workoutId: string, exId: string) {
    const ex = exercises?.find((e) => e.id === exId)
    if (!ex) return
    addSet.mutate({
      workout_id: workoutId,
      exercise_id: exId,
      set_number: 1,
      reps: ex.target_rep_min,
      weight: 20,
      reps_right: ex.unilateral ? ex.target_rep_min : null,
      weight_right: ex.unilateral ? 20 : null,
      set_type: 'working',
      to_failure: true,
    })
  }

  /** Aufgeklappter Inhalt eines Trainings: Sätze je Übung, Bearbeiten, Übung hinzufügen. */
  function renderSets(w: Workout, sets: SetWithDate[], editing: boolean) {
    const groups = Object.entries(
      sets.reduce<Record<string, SetWithDate[]>>((acc, s) => {
        ;(acc[s.exercise_id] ??= []).push(s)
        return acc
      }, {}),
    )
    return (
      <>
        {groups.map(([exId, exSets]) => {
          const ex = exercises?.find((e) => e.id === exId)
          const sorted = [...exSets].sort((a, b) => a.set_number - b.set_number)
          return (
            <div key={exId} className="space-y-2">
              <div className="font-medium">{exName(exId)}</div>
              {editing && ex ? (
                <>
                  {sorted.map((s) => (
                    <EditableSetRow key={s.id} set={s} exercise={ex} />
                  ))}
                  <button
                    className="btn-ghost flex w-full items-center justify-center gap-1.5 text-sm"
                    onClick={() => addSetToGroup(w.id, ex, exSets)}
                  >
                    <Plus size={16} /> Satz
                  </button>
                </>
              ) : (
                <div className="tabular text-sm text-cocoa-light">
                  {sorted.map((s, i) => {
                    const prefix =
                      s.set_type === 'warmup'
                        ? 'Aufw. '
                        : s.set_type === 'drop'
                          ? 'Drop '
                          : ''
                    const text =
                      s.reps_right != null
                        ? `${prefix}L ${s.reps}×${s.weight} / R ${s.reps_right}×${s.weight_right}kg`
                        : `${prefix}${s.reps}×${s.weight}kg`
                    return (
                      <span key={s.id}>
                        {i > 0 && ' · '}
                        {text}
                        {s.to_failure && (
                          <Flame
                            size={12}
                            className="ml-0.5 inline-block align-[-1px] text-cocoa-muted"
                            aria-label="bis Versagen"
                          />
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {editing && (
          <div>
            <label className="label">Übung hinzufügen</label>
            <select
              className="input"
              value=""
              onChange={(e) => {
                if (e.target.value) addExerciseToWorkout(w.id, e.target.value)
              }}
            >
              <option value="">— wählen —</option>
              {exercises?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {sets.length === 0 && !editing && <p className="text-sm text-cocoa-muted">Keine Sätze.</p>}
      </>
    )
  }

  if (isNew && world === 'food') {
    return (
      <div className="space-y-4">
        <FoodDays />
      </div>
    )
  }

  if (isNew) {
    return (
      <NewHistory
        workouts={workouts}
        allSets={allSets ?? []}
        exName={exName}
        isLoading={isLoading}
        openId={openId}
        editId={editId}
        setOpenId={setOpenId}
        setEditId={setEditId}
        onDelete={(id) => deleteWorkout.mutate(id)}
        renderSets={renderSets}
        backfill={backfill}
        setBackfill={setBackfill}
        backfillDate={backfillDate}
        setBackfillDate={setBackfillDate}
        startBackfill={startBackfill}
      />
    )
  }

  // Klassischer Modus — unverändert
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Verlauf</h1>
      </header>
      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <ul className="space-y-2">
        {workouts?.map((w) => {
          const sets = (allSets ?? []).filter((s) => s.workout_id === w.id)
          // Für Zähler/Volumen nur ausgeführte Sätze (leere Vorlagen-Sätze mit 0 Wdh nicht)
          const doneSets = sets.filter(isPerformed)
          const isOpen = openId === w.id
          const editing = editId === w.id
          return (
            <li key={w.id} className="card">
              <div className="flex items-center justify-between">
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    setOpenId(isOpen ? null : w.id)
                    if (isOpen) setEditId(null)
                  }}
                >
                  <div className="font-semibold">
                    {new Date(w.date + 'T00:00:00').toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="tabular text-sm text-cocoa-light">
                    {doneSets.length} Sätze · Volumen {Math.round(totalVolume(doneSets))} kg
                  </div>
                </button>
                <button
                  className="ml-2 grid h-8 w-8 place-items-center rounded-full text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Training löschen"
                  onClick={() => {
                    if (confirm('Dieses Training löschen?')) deleteWorkout.mutate(w.id)
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-sand-dark pt-3">
                  <div className="flex justify-end">
                    <button
                      className="btn-ghost flex items-center gap-1.5 text-sm"
                      onClick={() => setEditId(editing ? null : w.id)}
                    >
                      {editing ? <Check size={16} /> : <Pencil size={16} />}
                      {editing ? 'Fertig' : 'Bearbeiten'}
                    </button>
                  </div>
                  {renderSets(w, sets, editing)}
                </div>
              )}
            </li>
          )
        })}
        {workouts?.length === 0 && (
          <li className="text-cocoa-light">Noch keine Trainings erfasst.</li>
        )}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Neuer Modus: Kalender-Heatmap + Trainings nach Wochen gruppiert
// ---------------------------------------------------------------------------

function NewHistory({
  workouts,
  allSets,
  exName,
  isLoading,
  openId,
  editId,
  setOpenId,
  setEditId,
  onDelete,
  renderSets,
  backfill,
  setBackfill,
  backfillDate,
  setBackfillDate,
  startBackfill,
}: {
  workouts: Workout[] | undefined
  allSets: SetWithDate[]
  exName: (id: string) => string
  isLoading: boolean
  openId: string | null
  editId: string | null
  setOpenId: (id: string | null) => void
  setEditId: (id: string | null) => void
  onDelete: (id: string) => void
  renderSets: (w: Workout, sets: SetWithDate[], editing: boolean) => ReactElement
  backfill: boolean
  setBackfill: (v: boolean) => void
  backfillDate: string
  setBackfillDate: (d: string) => void
  startBackfill: () => void
}) {
  const today = trainingDay()

  const setsByWorkout = useMemo(() => {
    const m = new Map<string, SetWithDate[]>()
    for (const s of allSets) {
      const list = m.get(s.workout_id)
      if (list) list.push(s)
      else m.set(s.workout_id, [s])
    }
    return m
  }, [allSets])
  const metas = useMemo(() => workoutMetas(allSets), [allSets])

  const volumeByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of allSets) {
      if (!isPerformed(s)) continue
      m.set(s.date, (m.get(s.date) ?? 0) + setVolume(s))
    }
    return m
  }, [allSets])

  const freq = useMemo(() => frequencyStats(sessionDates(allSets)), [allSets])

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Workout[] }[] = []
    for (const w of workouts ?? []) {
      const key = mondayOf(w.date)
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(w)
      else out.push({ key, label: weekGroupLabel(w.date, today), items: [w] })
    }
    return out
  }, [workouts, today])

  function pickDay(date: string) {
    const w = workouts?.find((x) => x.date === date)
    if (!w) return
    setOpenId(w.id)
    requestAnimationFrame(() =>
      document.getElementById(`workout-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const n = freq.totalSessions
  const perWeek = freq.sessionsPerWeek.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  let idx = 2

  return (
    <div className="space-y-5">
      <ProgressHeader
        title="Verlauf"
        subtitle={n > 0 ? `${n} ${n === 1 ? 'Training' : 'Trainings'} · Ø ${perWeek}/Woche` : 'Noch keine Trainings'}
        action={
          <button
            className={`grid h-10 w-10 place-items-center rounded-full shadow-sm transition active:scale-95 ${
              backfill ? 'bg-sand text-cocoa' : 'bg-brand text-on-brand shadow-brand/30'
            }`}
            onClick={() => setBackfill(!backfill)}
            aria-label={backfill ? 'Nachtragen abbrechen' : 'Training nachtragen'}
            aria-expanded={backfill}
            title="Training nachtragen"
          >
            {backfill ? <X size={18} /> : <Plus size={20} strokeWidth={2.5} />}
          </button>
        }
      />

      {backfill && (
        <div className="card anim-fade space-y-2">
          <label className="label flex items-center gap-1.5">
            <CalendarPlus size={14} className="text-brand" />
            Training nachtragen am
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input flex-1"
              value={backfillDate}
              max={trainingDay()}
              onChange={(e) => setBackfillDate(e.target.value)}
            />
            <button className="btn-primary" onClick={startBackfill} disabled={!backfillDate}>
              Los
            </button>
          </div>
        </div>
      )}

      {volumeByDate.size > 0 && (
        <MonthHeatmap today={today} volumeByDate={volumeByDate} onPick={pickDay} index={1} />
      )}

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      {groups.map((g) => {
        const groupVolume = g.items.reduce((s, w) => s + (metas.get(w.id)?.volume ?? 0), 0)
        return (
          <section key={g.key} style={enter(Math.min(idx++, 8))}>
            <SectionLabel
              right={
                <span className="tabular text-[11px] text-cocoa-muted">
                  {g.items.length} {g.items.length === 1 ? 'Training' : 'Trainings'}
                  {groupVolume > 0 && ` · ${formatVolume(groupVolume)}`}
                </span>
              }
            >
              {g.label}
            </SectionLabel>
            <ul className="space-y-2">
              {g.items.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  today={today}
                  meta={metas.get(w.id)}
                  names={(metas.get(w.id)?.exerciseIds ?? []).map(exName)}
                  open={openId === w.id}
                  editing={editId === w.id}
                  onToggle={() => {
                    const isOpen = openId === w.id
                    setOpenId(isOpen ? null : w.id)
                    if (isOpen) setEditId(null)
                  }}
                  onEdit={() => setEditId(editId === w.id ? null : w.id)}
                  onDelete={() => {
                    if (confirm('Dieses Training löschen?')) onDelete(w.id)
                  }}
                >
                  {renderSets(w, setsByWorkout.get(w.id) ?? [], editId === w.id)}
                </WorkoutCard>
              ))}
            </ul>
          </section>
        )
      })}

      {workouts?.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-sand text-brand">
            <CalendarPlus size={22} />
          </div>
          <p className="text-sm text-cocoa-light">Noch keine Trainings erfasst.</p>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, children, className = '' }: { icon: ReactElement; children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {icon}
      {children}
    </span>
  )
}

function WorkoutCard({
  workout: w,
  today,
  meta,
  names,
  open,
  editing,
  onToggle,
  onEdit,
  onDelete,
  children,
}: {
  workout: Workout
  today: string
  meta: WorkoutMeta | undefined
  names: string[]
  open: boolean
  editing: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const sets = meta?.sets ?? 0
  const label = dayLabel(w.date, today)
  const long = new Date(w.date + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })

  return (
    <li id={`workout-${w.id}`} className={`card scroll-mt-20 transition-shadow ${open ? 'ring-1 ring-brand/30' : ''}`}>
      <button className="flex w-full items-start gap-3 text-left" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{label}</span>
            {(label === 'Heute' || label === 'Gestern') && (
              <span className="shrink-0 text-xs text-cocoa-muted">{long}</span>
            )}
            {w.name && <span className="truncate text-xs text-cocoa-muted">· {w.name}</span>}
          </span>
          <span className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-cocoa-light">
            {sets === 0 ? (
              <span className="text-cocoa-muted">Keine Sätze</span>
            ) : (
              <>
                {meta?.minutes != null && (
                  <Stat icon={<Clock size={12} className="text-cocoa-muted" />}>{meta.minutes} Min</Stat>
                )}
                <Stat icon={<Layers size={12} className="text-cocoa-muted" />}>
                  {sets} {sets === 1 ? 'Satz' : 'Sätze'}
                </Stat>
                {(meta?.volume ?? 0) > 0 && (
                  <Stat icon={<Weight size={12} className="text-cocoa-muted" />}>{formatVolume(meta!.volume)}</Stat>
                )}
                {(meta?.prs ?? 0) > 0 && (
                  <Stat icon={<Trophy size={12} strokeWidth={2.5} />} className="font-semibold text-gold">
                    {meta!.prs} {meta!.prs === 1 ? 'Rekord' : 'Rekorde'}
                  </Stat>
                )}
              </>
            )}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`mt-0.5 shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {names.length > 0 && !open && (
        <button className="mt-2.5 flex w-full flex-wrap gap-1.5 text-left" onClick={onToggle} tabIndex={-1}>
          {names.slice(0, 3).map((n, i) => (
            <span key={i} className="max-w-[60%] truncate rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-cocoa">
              {n}
            </span>
          ))}
          {names.length > 3 && (
            <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-cocoa-muted">+{names.length - 3}</span>
          )}
        </button>
      )}

      {open && (
        <div className="anim-fade mt-3 space-y-3 border-t border-sand-dark/40 pt-3">
          <div className="flex items-center justify-between gap-2">
            <button
              className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
              onClick={onDelete}
              aria-label="Training löschen"
            >
              <Trash2 size={15} />
              Löschen
            </button>
            <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={onEdit}>
              {editing ? <Check size={16} /> : <Pencil size={16} />}
              {editing ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>
          {children}
        </div>
      )}
    </li>
  )
}
