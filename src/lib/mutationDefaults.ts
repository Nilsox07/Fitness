import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { SetWithDate, Workout, WorkoutSet } from '../types'

// ---------------------------------------------------------------------------
// Wiederaufnehmbare Schreibvorgänge für den Trainings-Pfad.
//
// Diese Mutationen werden per mutationKey als Defaults am QueryClient
// registriert. Dadurch kann React Query sie nach einem App-Neustart aus dem
// (auf der Platte persistierten) Cache wieder aufnehmen — die mutationFn
// existiert dann auch ohne gemountete Komponente. So gehen Sätze, die offline
// erfasst wurden, selbst dann nicht verloren, wenn die App vorher geschlossen
// oder neu geladen wird.
//
// Offline-fähig:
// - IDs werden im Client erzeugt (crypto.randomUUID) und stehen in den
//   Variablen. Damit kennt die UI neue Trainings/Sätze sofort, abhängige
//   Schreibvorgänge (Satz → Training) referenzieren echte IDs, und eine nach
//   Reload fortgesetzte Mutation schreibt exakt dieselbe Zeile.
// - Optimistische Updates (onMutate) tragen die Zeile sofort in die Listen im
//   Cache ein — die UI hängt nicht an der Server-Antwort.
// - Alle Trainings-Schreibvorgänge laufen in EINEM Scope nacheinander. So kommt
//   das Training vor seinen Sätzen an, ein Satz vor seiner Änderung/Löschung,
//   und Änderungen am selben Satz überholen sich nicht.
// ---------------------------------------------------------------------------

export interface SetInput {
  /** Client-seitig erzeugte ID (wird von den Hooks ergänzt, falls sie fehlt). */
  id?: string
  workout_id: string
  exercise_id: string
  set_number: number
  reps: number
  weight: number
  reps_right?: number | null
  weight_right?: number | null
  set_type: WorkoutSet['set_type']
  to_failure: boolean
}

export interface WorkoutInput {
  /** Client-seitig erzeugte ID (wird von den Hooks ergänzt, falls sie fehlt). */
  id?: string
  date: string
  name?: string | null
}

export type SetPatch = { id: string } & Partial<
  Pick<
    WorkoutSet,
    'reps' | 'weight' | 'reps_right' | 'weight_right' | 'set_type' | 'to_failure' | 'set_number'
  >
>

export const MK = {
  workoutCreate: ['workout', 'create'] as const,
  setAdd: ['sets', 'add'] as const,
  setAddMany: ['sets', 'addMany'] as const,
  setUpdate: ['sets', 'update'] as const,
  setDelete: ['sets', 'delete'] as const,
}

/** Gemeinsamer Scope: alle Trainings-Schreibvorgänge laufen strikt nacheinander. */
export const TRAINING_SCOPE = { id: 'training' }

/** Neue UUID (v4) — auch ohne crypto.randomUUID (ältere Browser / kein HTTPS). */
export function newId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Ergänzt fehlende IDs — VOR dem mutate, damit sie in den (persistierten) Variablen stehen. */
export function withId<T extends { id?: string }>(v: T): T & { id: string } {
  return (v.id ? v : { ...v, id: newId() }) as T & { id: string }
}

/** Aktuelle User-ID aus der (lokal gespeicherten) Supabase-Session — offline-fähig. */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Nicht angemeldet')
  return id
}

/** Datenbank-Fehler (SQLSTATE/PostgREST-Code) — erneutes Senden hilft nicht. */
function isPermanent(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^([0-9A-Z]{5}|PGRST\w+)$/.test(code)
}

/** Doppelte ID: die Zeile ist schon angekommen (z. B. Antwort ging verloren, dann Retry). */
function isDuplicate(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505'
}

export function registerMutationDefaults(qc: QueryClient) {
  /**
   * Nach dem Schreiben neu laden — aber erst, wenn kein weiterer Trainings-
   * Schreibvorgang mehr aussteht. Sonst würde der Refetch noch nicht gesendete
   * (optimistische) Sätze kurz aus der Liste werfen.
   */
  const refreshWhenIdle = () => {
    const pending = qc.isMutating({
      predicate: (m) => m.options.scope?.id === TRAINING_SCOPE.id,
    })
    // Die gerade abschließende Mutation zählt noch als „pending".
    if (pending > 1) return
    qc.invalidateQueries({ queryKey: ['workouts'] })
    qc.invalidateQueries({ queryKey: ['sets'] })
  }

  /** Alle gecachten Satz-Listen (['sets','workout',id], ['sets','all']). */
  const setLists = () =>
    qc
      .getQueriesData<WorkoutSet[]>({ queryKey: ['sets'] })
      .filter((e): e is [QueryKey, WorkoutSet[]] => Array.isArray(e[1]))

  const workoutDate = (workoutId: string) =>
    qc.getQueryData<Workout[]>(['workouts'])?.find((w) => w.id === workoutId)?.date

  /** Neue Sätze optimistisch in die passenden Listen eintragen. */
  async function insertSets(inputs: SetInput[]) {
    await qc.cancelQueries({ queryKey: ['sets'] })
    const user_id = await currentUserId().catch(() => '')
    const now = new Date().toISOString()
    const rows: WorkoutSet[] = inputs
      .filter((i) => i.id)
      .map((i) => ({
        id: i.id!,
        user_id,
        workout_id: i.workout_id,
        exercise_id: i.exercise_id,
        set_number: i.set_number,
        reps: i.reps,
        weight: i.weight,
        reps_right: i.reps_right ?? null,
        weight_right: i.weight_right ?? null,
        set_type: i.set_type,
        to_failure: i.to_failure,
        created_at: now,
      }))
    const byWorkout = new Map<string, WorkoutSet[]>()
    for (const r of rows) byWorkout.set(r.workout_id, [...(byWorkout.get(r.workout_id) ?? []), r])

    for (const [wid, list] of byWorkout) {
      qc.setQueryData<WorkoutSet[]>(['sets', 'workout', wid], (old) => {
        const cur = old ?? []
        const fresh = list.filter((r) => !cur.some((s) => s.id === r.id))
        return [...cur, ...fresh]
      })
    }
    qc.setQueryData<SetWithDate[]>(['sets', 'all'], (old) => {
      if (!old) return old
      const fresh = rows
        .filter((r) => !old.some((s) => s.id === r.id))
        .flatMap((r) => {
          const date = workoutDate(r.workout_id)
          return date ? [{ ...r, date }] : []
        })
      return fresh.length ? [...old, ...fresh] : old
    })
  }

  /** Bei endgültigem Fehler: optimistische Zeilen entfernen und neu laden. */
  function dropSets(ids: string[]) {
    for (const [key, list] of setLists()) {
      qc.setQueryData(
        key,
        list.filter((s) => !ids.includes(s.id)),
      )
    }
    qc.invalidateQueries({ queryKey: ['sets'] })
  }

  const common = {
    scope: TRAINING_SCOPE,
    // Datenbank-Fehler nicht endlos wiederholen (blockiert sonst die Warteschlange).
    retry: (count: number, error: unknown) => count < 5 && !isPermanent(error),
  }

  qc.setMutationDefaults(MK.workoutCreate, {
    ...common,
    mutationFn: async (input: WorkoutInput) => {
      const user_id = await currentUserId()
      const row = { ...(input.id ? { id: input.id } : {}), user_id, date: input.date, name: input.name ?? null }
      const { data, error } = await supabase.from('workouts').insert(row).select().single()
      if (error) {
        if (input.id && isDuplicate(error)) {
          return { ...row, id: input.id, notes: null, created_at: new Date().toISOString() } as Workout
        }
        throw error
      }
      return data as Workout
    },
    // Optimistisch: Training sofort in der Liste (auch offline) — inkl. leerer
    // Satz-Liste, damit die Trainings-Ansicht nicht auf den Server wartet.
    onMutate: async (input: WorkoutInput) => {
      if (!input.id) return
      await qc.cancelQueries({ queryKey: ['workouts'] })
      const user_id = await currentUserId().catch(() => '')
      const optimistic: Workout = {
        id: input.id,
        user_id,
        date: input.date,
        name: input.name ?? null,
        notes: null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Workout[]>(['workouts'], (old) =>
        old?.some((w) => w.id === optimistic.id) ? old : [optimistic, ...(old ?? [])],
      )
      if (qc.getQueryData(['sets', 'workout', input.id]) === undefined) {
        qc.setQueryData<WorkoutSet[]>(['sets', 'workout', input.id], [])
      }
    },
    onError: (_e: unknown, input: WorkoutInput) => {
      if (input?.id) {
        qc.setQueryData<Workout[]>(['workouts'], (old) => old?.filter((w) => w.id !== input.id))
      }
      qc.invalidateQueries({ queryKey: ['workouts'] })
    },
    onSuccess: refreshWhenIdle,
  })

  qc.setMutationDefaults(MK.setAdd, {
    ...common,
    mutationFn: async (input: SetInput) => {
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from('workout_sets')
        .insert({ ...input, user_id })
        .select()
        .single()
      if (error) {
        if (input.id && isDuplicate(error)) return { ...input, user_id } as WorkoutSet
        throw error
      }
      return data as WorkoutSet
    },
    onMutate: (input: SetInput) => insertSets([input]),
    onError: (_e: unknown, input: SetInput) => dropSets(input?.id ? [input.id] : []),
    onSuccess: refreshWhenIdle,
  })

  qc.setMutationDefaults(MK.setAddMany, {
    ...common,
    mutationFn: async (inputs: SetInput[]) => {
      const user_id = await currentUserId()
      const rows = inputs.map((i) => ({ ...i, user_id }))
      const { data, error } = await supabase.from('workout_sets').insert(rows).select()
      if (error) {
        // Schon angekommen (Retry nach verlorener Antwort)? Dann einzeln nachziehen.
        if (rows.every((r) => r.id) && isDuplicate(error)) {
          for (const r of rows) {
            const { error: e } = await supabase.from('workout_sets').insert(r)
            if (e && !isDuplicate(e)) throw e
          }
          return rows as WorkoutSet[]
        }
        throw error
      }
      return data as WorkoutSet[]
    },
    onMutate: (inputs: SetInput[]) => insertSets(inputs),
    onError: (_e: unknown, inputs: SetInput[]) =>
      dropSets((inputs ?? []).flatMap((i) => (i.id ? [i.id] : []))),
    onSuccess: refreshWhenIdle,
  })

  qc.setMutationDefaults(MK.setUpdate, {
    ...common,
    mutationFn: async ({ id, ...patch }: SetPatch) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as WorkoutSet
    },
    // Optimistisch: Änderung sofort in allen Satz-Listen zeigen (✓, Wdh, Gewicht),
    // nicht erst nach der Server-Antwort. Bei Fehler wird neu geladen.
    onMutate: async ({ id, ...patch }: SetPatch) => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      for (const [key, list] of setLists()) {
        qc.setQueryData(
          key,
          list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        )
      }
    },
    onError: () => qc.invalidateQueries({ queryKey: ['sets'] }),
    onSuccess: refreshWhenIdle,
  })

  qc.setMutationDefaults(MK.setDelete, {
    ...common,
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
      return set
    },
    // Optimistisch: Satz sofort aus allen Listen entfernen (auch offline).
    onMutate: async (set: WorkoutSet) => {
      await qc.cancelQueries({ queryKey: ['sets'] })
      for (const [key, list] of setLists()) {
        if (list.some((s) => s.id === set.id)) {
          qc.setQueryData(
            key,
            list.filter((s) => s.id !== set.id),
          )
        }
      }
    },
    onError: () => qc.invalidateQueries({ queryKey: ['sets'] }),
    onSuccess: refreshWhenIdle,
  })
}
