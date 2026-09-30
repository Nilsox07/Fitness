import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { usePlans } from '../hooks/usePlans'
import { usePrefs } from '../lib/prefs'
import {
  useAddSet,
  useAddSets,
  useAllSets,
  useCreateWorkout,
  useDeleteSet,
  useWorkoutSets,
  useWorkouts,
} from '../hooks/useWorkouts'
import { EditableSetRow } from '../components/EditableSetRow'
import { DailyOverview } from '../components/DailyOverview'
import { Confetti } from '../components/Confetti'
import { RestTimer, type RestTimerHandle } from '../components/RestTimer'
import { parseLadder, snapToLadder } from '../lib/weights'
import {
  estimate1RM,
  frequencyStats,
  onlyWorking,
  progressionSuggestion,
  summarizeSessions,
  totalVolume,
} from '../lib/analytics'
import { mascotStage, rankForSessions } from '../lib/gamification'
import { shareStatCard } from '../lib/statcard'
import { alternativeExercise, hypeLine, warmupAdvice } from '../lib/ai'
import { useAiStatus } from '../hooks/useAi'
import { challengeOfDay, randomExcuse } from '../lib/challenges'
import { usePostActivity } from '../hooks/useFeed'
import { useMyProfile } from '../hooks/useSocial'
import {
  type Exercise,
  type PlanWithExercises,
  type SetType,
  type SetWithDate,
  type WorkoutSet,
} from '../types'
import { CompactSetRow, SetTableHeader, isSetDone, type PrevSet } from '../components/workout/CompactSetRow'
import { RestControl, useRestTimer } from '../components/workout/RestControl'
import { Sheet } from '../components/workout/Sheet'
import {
  afterSetDone,
  appendOrder,
  getPairs,
  pairOf,
  setPairs,
  sortByOrder,
  type Pair,
} from '../lib/workoutSession'

// Trainings-Tag: der Tag wechselt nicht um Mitternacht, sondern erst um DAY_CUTOFF_H
// Uhr morgens. So bleibt eine Session, die vor 0 Uhr startet und danach weiterläuft,
// als ein Training zusammen (statt beim Datumswechsel zu zerreißen).
const DAY_CUTOFF_H = 4

function todayLocal(): string {
  const d = new Date()
  d.setHours(d.getHours() - DAY_CUTOFF_H)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const roundHalf = (v: number) => Math.round(v * 2) / 2

const tipStyles: Record<string, string> = {
  increase: 'text-brand',
  hold: 'text-cocoa',
  deload: 'text-amber-600 dark:text-amber-400',
  start: 'text-cocoa-light',
}

// Deine Standard-Struktur. Der Aufwärmsatz wird nur vorangestellt, wenn er
// gebraucht wird (siehe needsWarmup) — sonst geht's direkt mit den Arbeitssätzen los.
const TEMPLATE: SetType[] = ['warmup', 'working', 'working', 'drop']
const TEMPLATE_NO_WARMUP: SetType[] = ['working', 'working', 'drop']

/**
 * Aufwärmsatz nötig? Spezifisches Warm-up gilt pro Muskelgruppe: die erste Übung
 * einer Muskelgruppe in der Session bekommt einen Aufwärmsatz, Folgeübungen
 * derselben Gruppe nicht (Muskel ist schon warm). warmedGroups = die Muskel-
 * gruppen, die heute bereits mindestens einen Satz gesehen haben.
 */
function needsWarmup(ex: Exercise, warmedGroups: Set<string>): boolean {
  return !warmedGroups.has(ex.muscle_group)
}

/** Muskelgruppen, die in den gegebenen Sätzen heute schon trainiert wurden —
 *  inkl. Sekundärmuskeln (z. B. wärmt Rudern auch die Schultern mit). */
function warmedMuscleGroups(sets: { exercise_id: string }[], exercises: Exercise[]): Set<string> {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const groups = new Set<string>()
  for (const s of sets) {
    const ex = byId.get(s.exercise_id)
    if (!ex) continue
    groups.add(ex.muscle_group)
    for (const m of ex.secondary_muscles ?? []) groups.add(m)
  }
  return groups
}

/** Vorschlag je Satz-Typ: Gewicht vorbefüllt (vom Arbeitsgewicht abgeleitet),
 *  Wdh bleiben leer (0) und werden im Gym eingetragen. */
function deriveSet(type: SetType, base: number): { reps: number; weight: number } {
  switch (type) {
    case 'warmup':
      return { reps: 0, weight: roundHalf(base * 0.5) }
    case 'drop':
      return { reps: 0, weight: roundHalf(base * 0.7) }
    default:
      return { reps: 0, weight: base }
  }
}

/** Nächster Satz-Typ nach deinem Muster (Aufwärm, Arbeit, Arbeit, Drop, …). */
function patternType(index: number): SetType {
  return TEMPLATE[index] ?? 'working'
}

/** Gewicht auf die Geräte-Leiter einrasten (falls hinterlegt). */
function snapWeight(ex: Exercise, w: number): number {
  const ladder = parseLadder(ex.weight_steps)
  return ladder.length ? snapToLadder(w, ladder) : w
}

/** Baut die Standard-Sätze für eine Übung (Wdh leer, Gewicht vorbefüllt).
 *  Mit Aufwärmsatz nur, wenn withWarmup=true (default). */
function templateInputs(
  workoutId: string,
  ex: Exercise,
  base: number,
  startNo: number,
  withWarmup = true,
) {
  const template = withWarmup ? TEMPLATE : TEMPLATE_NO_WARMUP
  return template.map((type, i) => {
    const d = deriveSet(type, base)
    const weight = snapWeight(ex, d.weight)
    return {
      workout_id: workoutId,
      exercise_id: ex.id,
      set_number: startNo + i,
      reps: d.reps,
      weight,
      reps_right: ex.unilateral ? d.reps : null,
      weight_right: ex.unilateral ? weight : null,
      set_type: type,
      to_failure: type !== 'warmup',
    }
  })
}

function baseFor(ex: Exercise, history: SetWithDate[]): number {
  const sug = progressionSuggestion(ex, history)
  return sug.suggestedWeight > 0 ? sug.suggestedWeight : 20
}

export default function Workout() {
  const navigate = useNavigate()
  const today = todayLocal()
  const { data: workouts } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const { data: plans } = usePlans()
  const createWorkout = useCreateWorkout()
  const addSet = useAddSet()
  const addSets = useAddSets()
  const deleteSet = useDeleteSet()

  const todaysWorkout = workouts?.find((w) => w.date === today)
  const { data: workoutSets } = useWorkoutSets(todaysWorkout?.id)

  const [exerciseId, setExerciseId] = useState('')
  const selectedExercise = exercises?.find((e) => e.id === exerciseId)

  // Aktiver Plan filtert die Übungsauswahl (kein langes Scrollen).
  const [planId, setPlanId] = useState('')
  const activePlan = plans?.find((p) => p.id === planId)
  const visibleExercises = useMemo<Exercise[]>(() => {
    if (!exercises) return []
    if (!activePlan) return exercises
    return activePlan.exercise_ids
      .map((id) => exercises.find((e) => e.id === id))
      .filter((e): e is Exercise => Boolean(e))
  }, [exercises, activePlan])

  // Fehler aus den Schreibvorgängen sichtbar machen (statt still zu scheitern)
  const saveError = (addSet.error ||
    addSets.error ||
    createWorkout.error) as Error | null

  // Historie der gewählten Übung (ohne heute) → für Tipp & letzte Leistung
  const history = useMemo<SetWithDate[]>(() => {
    if (!exerciseId || !allSets) return []
    return allSets.filter((s) => s.exercise_id === exerciseId && s.date !== today)
  }, [allSets, exerciseId, today])

  const suggestion = useMemo(() => {
    if (!selectedExercise) return null
    return progressionSuggestion(selectedExercise, history)
  }, [selectedExercise, history])

  const lastSession = useMemo(() => {
    const sessions = summarizeSessions(history)
    return sessions[sessions.length - 1] ?? null
  }, [history])

  const setsForExercise = (workoutSets ?? [])
    .filter((s) => s.exercise_id === exerciseId)
    .sort((a, b) => a.set_number - b.set_number)
  const nextSetNumber = setsForExercise.reduce((max, s) => Math.max(max, s.set_number), 0) + 1

  // Übungen, für die heute schon mind. ein Satz erfasst wurde → Haken in der Auswahl
  const doneExerciseIds = new Set((workoutSets ?? []).map((s) => s.exercise_id))

  // Arbeitsgewicht als Basis für Vorschläge
  const workingBase = suggestion && suggestion.suggestedWeight > 0 ? suggestion.suggestedWeight : 20

  // PR-Erkennung: neuer bester geschätzter 1RM einer Übung heute → Konfetti.
  const [prName, setPrName] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)
  // Bereits gefeierte Rekorde dauerhaft merken — sonst gäbe es nach jedem
  // App-Öffnen erneut Konfetti und einen doppelten Feed-Post.
  const celebrated = useRef<Set<string>>(
    (() => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem('pr_celebrated') || '[]'))
      } catch {
        return new Set<string>()
      }
    })(),
  )
  const rememberCelebrated = (key: string) => {
    celebrated.current.add(key)
    try {
      // nur die letzten 200 Einträge behalten
      localStorage.setItem('pr_celebrated', JSON.stringify([...celebrated.current].slice(-200)))
    } catch {
      /* ignore */
    }
  }
  const restRef = useRef<RestTimerHandle>(null)
  const autoRest = () => {
    if (restRef.current?.autoEnabled()) restRef.current.start()
  }
  const { data: ai } = useAiStatus()
  const { isNew } = usePrefs()
  const postActivity = usePostActivity()
  const { data: myProfile } = useMyProfile()
  const authorName = myProfile?.display_name ?? undefined
  const [hype, setHype] = useState<string | null>(null)
  const [hypeBusy, setHypeBusy] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [excuse, setExcuse] = useState<string | null>(null)
  const [altAi, setAltAi] = useState<{ name: string | null; reason: string } | null>(null)
  const [altBusy, setAltBusy] = useState(false)
  const warmupChecked = useRef<Set<string>>(new Set())

  async function findAltAi() {
    if (!selectedExercise || !exercises) return
    setAltBusy(true)
    setAltAi(null)
    try {
      const available = exercises
        .filter((e) => e.id !== selectedExercise.id)
        .map((e) => ({ name: e.name, muscle: e.muscle_group }))
      setAltAi(
        await alternativeExercise(
          {
            name: selectedExercise.name,
            muscle: selectedExercise.muscle_group,
            secondary: selectedExercise.secondary_muscles ?? [],
          },
          available,
        ),
      )
    } catch {
      setAltAi({ name: null, reason: 'KI-Fehler' })
    } finally {
      setAltBusy(false)
    }
  }

  // Übungs-Alternativen: eigene Übungen mit gleicher Primär-Muskelgruppe
  const alternatives = useMemo(() => {
    if (!selectedExercise || !exercises) return []
    return exercises.filter(
      (e) => e.id !== selectedExercise.id && e.muscle_group === selectedExercise.muscle_group,
    )
  }, [selectedExercise, exercises])

  async function shareToday() {
    if (!workoutSets) return
    const exCount = new Set(workoutSets.map((s) => s.exercise_id)).size
    const sessions = frequencyStats([...new Set((allSets ?? []).map((s) => s.date))]).totalSessions
    await shareStatCard({
      title: 'Training abgeschlossen 💪',
      dateLabel: new Date(today).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      volume: Math.round(totalVolume(workoutSets)),
      sets: workoutSets.length,
      exercises: exCount,
      highlight: prName ? `Rekord: ${prName}` : undefined,
      rank: rankForSessions(sessions).title,
      mascot: mascotStage(sessions).emoji,
    })
  }

  function finishWorkout() {
    if (isNew && workoutSets && workoutSets.length) {
      const key = `feed_workout_${today}`
      let posted = false
      try {
        posted = localStorage.getItem(key) === '1'
      } catch {
        /* ignore */
      }
      if (!posted) {
        const exCount = new Set(workoutSets.map((s) => s.exercise_id)).size
        postActivity.mutate({
          kind: 'workout',
          title: 'Training abgeschlossen 💪',
          detail: `${workoutSets.length} Sätze · ${exCount} Übungen · ${Math.round(totalVolume(workoutSets))} kg`,
          author_name: authorName,
        })
        try {
          localStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
      }
    }
    navigate('/history')
  }

  async function makeHype() {
    if (!workoutSets) return
    setHypeBusy(true)
    try {
      const perEx = new Map<string, number>()
      workoutSets.forEach((s) => perEx.set(s.exercise_id, (perEx.get(s.exercise_id) ?? 0) + 1))
      setHype(
        await hypeLine({
          saetze: workoutSets.length,
          uebungen: perEx.size,
          volumen: Math.round(totalVolume(workoutSets)),
          rekord: prName ?? null,
        }),
      )
    } catch {
      setHype('Stark durchgezogen! 💪')
    } finally {
      setHypeBusy(false)
    }
  }
  useEffect(() => {
    if (!isNew) return // Rekord-Konfetti & Feed-Post nur im neuen Design
    if (!workoutSets || !allSets || !exercises) return
    const best1RM = (s: { weight: number; reps: number; weight_right?: number | null; reps_right?: number | null }) =>
      Math.max(estimate1RM(s.weight, s.reps), estimate1RM(s.weight_right ?? 0, s.reps_right ?? 0))
    const prior = new Map<string, number>()
    for (const s of onlyWorking(allSets)) {
      if (s.date === today) continue
      prior.set(s.exercise_id, Math.max(prior.get(s.exercise_id) ?? 0, best1RM(s)))
    }
    const todays = new Map<string, number>()
    for (const s of onlyWorking(workoutSets)) {
      todays.set(s.exercise_id, Math.max(todays.get(s.exercise_id) ?? 0, best1RM(s)))
    }
    for (const [exId, cur] of todays) {
      const key = `${today}:${exId}`
      if ((prior.get(exId) ?? 0) > 0 && cur > (prior.get(exId) ?? 0) + 0.01 && !celebrated.current.has(key)) {
        rememberCelebrated(key)
        const exName = exercises.find((e) => e.id === exId)?.name ?? 'Übung'
        setPrName(exName)
        setConfetti(true)
        postActivity.mutate({
          kind: 'pr',
          title: `🏆 Neuer Rekord: ${exName}`,
          detail: `~${Math.round(cur)} kg geschätztes 1RM`,
          author_name: authorName,
        })
      }
    }
  }, [isNew, workoutSets, allSets, exercises, today])

  // Bekommt die gewählte Übung einen Aufwärmsatz? (nur wenn ihre Muskelgruppe heute noch kalt ist)
  const willWarmup = selectedExercise
    ? needsWarmup(
        selectedExercise,
        warmedMuscleGroups(
          (workoutSets ?? []).filter((s) => s.exercise_id !== selectedExercise.id),
          exercises ?? [],
        ),
      )
    : true

  async function addWarmupSet() {
    if (!todaysWorkout || !selectedExercise) return
    const d = deriveSet('warmup', workingBase)
    const weight = snapWeight(selectedExercise, d.weight)
    await addSet.mutateAsync({
      workout_id: todaysWorkout.id,
      exercise_id: selectedExercise.id,
      set_number: nextSetNumber,
      reps: d.reps,
      weight,
      reps_right: selectedExercise.unilateral ? d.reps : null,
      weight_right: selectedExercise.unilateral ? weight : null,
      set_type: 'warmup',
      to_failure: false,
    })
  }

  async function removeWarmupSet() {
    const w = setsForExercise.find((s) => s.set_type === 'warmup')
    if (w) await deleteSet.mutateAsync(w)
  }

  // KI entscheidet im Hintergrund über den Aufwärmsatz und passt ihn still an.
  useEffect(() => {
    if (!isNew || !ai?.enabled || !selectedExercise || setsForExercise.length === 0) return
    const key = `${today}:${selectedExercise.id}`
    if (warmupChecked.current.has(key)) return
    warmupChecked.current.add(key)
    const ex = selectedExercise
    ;(async () => {
      try {
        const otherSets = (workoutSets ?? []).filter((s) => s.exercise_id !== ex.id)
        const adv = await warmupAdvice({
          exercise: ex.name,
          primary: ex.muscle_group,
          secondary: ex.secondary_muscles ?? [],
          muscleAlreadyWarm: !willWarmup,
          firstOfSession: otherSets.length === 0,
          base: workingBase,
        })
        const hasWarmup = setsForExercise.some((s) => s.set_type === 'warmup')
        if (adv.warmup && !hasWarmup) await addWarmupSet()
        else if (!adv.warmup && hasWarmup) await removeWarmupSet()
      } catch {
        /* still im Hintergrund – Standardregel bleibt */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, ai?.enabled, selectedExercise?.id, setsForExercise.length, today])

  // Übung auswählen → bei leerem Stand automatisch die Standard-Sätze anlegen
  function selectExercise(id: string) {
    setExerciseId(id)
    if (!id || !todaysWorkout || !exercises) return
    const ex = exercises.find((e) => e.id === id)
    if (!ex) return
    const existing = (workoutSets ?? []).filter((s) => s.exercise_id === id)
    if (existing.length > 0) return
    const hist = (allSets ?? []).filter((s) => s.exercise_id === id && s.date !== today)
    const warmed = warmedMuscleGroups(workoutSets ?? [], exercises)
    addSets.mutate(
      templateInputs(todaysWorkout.id, ex, baseFor(ex, hist), 1, needsWarmup(ex, warmed)),
    )
  }

  // Ganzen Plan laden: Standard-Sätze für alle noch nicht erfassten Übungen anlegen.
  function loadPlan(plan: PlanWithExercises) {
    if (!todaysWorkout || !exercises) return
    // Bereits heute trainierte Muskelgruppen; wächst mit, während wir den Plan durchgehen,
    // damit die zweite Übung derselben Gruppe keinen Aufwärmsatz mehr bekommt.
    const warmed = warmedMuscleGroups(workoutSets ?? [], exercises)
    const inputs = plan.exercise_ids.flatMap((exId) => {
      const ex = exercises.find((e) => e.id === exId)
      if (!ex) return []
      const already = (workoutSets ?? []).some((s) => s.exercise_id === exId)
      if (already) return []
      const hist = (allSets ?? []).filter((s) => s.exercise_id === exId && s.date !== today)
      const rows = templateInputs(todaysWorkout.id, ex, baseFor(ex, hist), 1, needsWarmup(ex, warmed))
      warmed.add(ex.muscle_group)
      return rows
    })
    if (inputs.length) addSets.mutate(inputs)
  }

  async function addTemplate() {
    if (!todaysWorkout || !selectedExercise) return
    const warmed = warmedMuscleGroups(
      (workoutSets ?? []).filter((s) => s.exercise_id !== selectedExercise.id),
      exercises ?? [],
    )
    await addSets.mutateAsync(
      templateInputs(
        todaysWorkout.id,
        selectedExercise,
        workingBase,
        nextSetNumber,
        needsWarmup(selectedExercise, warmed),
      ),
    )
  }

  async function addOne() {
    if (!todaysWorkout || !selectedExercise) return
    const type = patternType(setsForExercise.length)
    const d = deriveSet(type, workingBase)
    const uni = selectedExercise.unilateral
    const weight = snapWeight(selectedExercise, d.weight)
    await addSet.mutateAsync({
      workout_id: todaysWorkout.id,
      exercise_id: exerciseId,
      set_number: nextSetNumber,
      reps: d.reps,
      weight,
      reps_right: uni ? d.reps : null,
      weight_right: uni ? weight : null,
      set_type: type,
      to_failure: type !== 'warmup',
    })
    autoRest()
  }

  // ======================================================================
  // Neues Trainings-Layout (nur Neu-Modus): Übungsleiste statt Dropdown,
  // kompakte Satzzeilen mit „Vorher" + ✓, supersatz-tauglicher Pausentimer,
  // feste Aktionsleiste. Der Klassisch-Modus unten bleibt unverändert.
  // ======================================================================
  const rest = useRestTimer()
  const [sessionVer, setSessionVer] = useState(0)
  const bump = () => setSessionVer((v) => v + 1)
  const [sheet, setSheet] = useState<null | 'picker' | 'pair' | 'menu' | 'alts' | 'finish'>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pendingPlanId, setPendingPlanId] = useState('')
  const [dropOpenSets, setDropOpenSets] = useState(true)
  const [tipOpen, setTipOpen] = useState(false)
  const woId = todaysWorkout?.id ?? ''

  const pairs = useMemo<Pair[]>(
    () => (woId ? getPairs(woId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [woId, sessionVer],
  )
  const exById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const setsOf = (exId: string) =>
    (workoutSets ?? [])
      .filter((s) => s.exercise_id === exId)
      .sort((a, b) => a.set_number - b.set_number)
  const isUni = (exId: string) => exById.get(exId)?.unilateral ?? false

  // Heutige Übungen in fester Reihenfolge; Supersatz-Partner direkt nebeneinander.
  const todayExIds = useMemo(() => {
    if (!woId) return []
    const ids = sortByOrder(woId, [...new Set((workoutSets ?? []).map((s) => s.exercise_id))])
    for (const [a, b] of pairs) {
      if (!ids.includes(a) || !ids.includes(b)) continue
      ids.splice(ids.indexOf(b), 1)
      ids.splice(ids.indexOf(a) + 1, 0, b)
    }
    return ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woId, workoutSets, pairs, sessionVer])

  // Sätze des letzten Trainings je Übung → Spalte „Vorher".
  const prevByEx = useMemo(() => {
    const latest = new Map<string, string>()
    for (const s of allSets ?? []) {
      if (s.date >= today || s.reps <= 0) continue
      const d = latest.get(s.exercise_id)
      if (!d || s.date > d) latest.set(s.exercise_id, s.date)
    }
    const m = new Map<string, SetWithDate[]>()
    for (const s of allSets ?? []) {
      if (s.reps <= 0 || s.date !== latest.get(s.exercise_id)) continue
      const arr = m.get(s.exercise_id) ?? []
      arr.push(s)
      m.set(s.exercise_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.set_number - b.set_number)
    return m
  }, [allSets, today])

  /** Passender Vorher-Satz: gleicher Satz-Typ, gleiche Position (Aufwärm ↔ Aufwärm usw.). */
  function prevFor(exId: string, s: WorkoutSet, list: WorkoutSet[]): PrevSet | null {
    const prev = prevByEx.get(exId)
    if (!prev?.length) return null
    const k = list.filter((x) => x.set_type === s.set_type && x.set_number < s.set_number).length
    return prev.filter((p) => p.set_type === s.set_type)[k] ?? null
  }

  function badgeFor(s: WorkoutSet, list: WorkoutSet[]): string {
    if (s.set_type === 'warmup') return 'W'
    if (s.set_type === 'drop') return 'D'
    return String(list.filter((x) => x.set_type === 'working' && x.set_number <= s.set_number).length)
  }

  function onSetDone(exId: string, s: WorkoutSet) {
    const list = setsOf(exId)
    const decision = afterSetDone({
      exId,
      setIndex: list.findIndex((x) => x.id === s.id),
      pairs,
      doneFlags: (id) => setsOf(id).map((x) => isSetDone(x, isUni(id))),
    })
    if (decision.rest && rest.mode === 'auto') rest.start()
    if (decision.next) setExerciseId(decision.next)
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
  }

  function addExerciseToday(id: string) {
    if (woId) appendOrder(woId, [id])
    selectExercise(id)
    setSheet(null)
    setPickerQuery('')
    bump()
  }

  function pairWith(partnerId: string) {
    if (!woId || !exerciseId) return
    const current = exerciseId
    const next = getPairs(woId).filter((p) => !p.includes(current) && !p.includes(partnerId))
    next.push([current, partnerId])
    setPairs(woId, next)
    appendOrder(woId, [current, partnerId])
    selectExercise(partnerId) // legt beim Partner ggf. die Standard-Sätze an
    setExerciseId(current)
    setSheet(null)
    setPickerQuery('')
    bump()
  }

  function unpair(exId: string) {
    if (!woId) return
    setPairs(woId, getPairs(woId).filter((p) => !p.includes(exId)))
    bump()
  }

  function loadPlanOrdered(plan: PlanWithExercises) {
    if (woId) appendOrder(woId, plan.exercise_ids)
    loadPlan(plan)
    if (!exerciseId && plan.exercise_ids[0]) setExerciseId(plan.exercise_ids[0])
    setSheet(null)
    bump()
  }

  // „▶ Plan" auf dem Start-Screen: Training anlegen, dann Plan laden.
  useEffect(() => {
    if (!pendingPlanId || !todaysWorkout) return
    const p = plans?.find((x) => x.id === pendingPlanId)
    setPendingPlanId('')
    if (p) loadPlanOrdered(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlanId, todaysWorkout])

  // Beim Öffnen automatisch die erste noch offene Übung wählen.
  useEffect(() => {
    if (!isNew || exerciseId || todayExIds.length === 0) return
    const firstOpen = todayExIds.find((id) => setsOf(id).some((s) => !isSetDone(s, isUni(id))))
    setExerciseId(firstOpen ?? todayExIds[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, exerciseId, todayExIds])

  const openSets = (workoutSets ?? []).filter((s) => !isSetDone(s, isUni(s.exercise_id)))
  const doneCount = (workoutSets?.length ?? 0) - openSets.length

  function finishNew() {
    if (dropOpenSets) for (const s of openSets) deleteSet.mutate(s)
    setSheet(null)
    finishWorkout()
  }

  if (isNew) {
    const dateLabel = new Date(today).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    // ---- Heute noch kein Training: Start-Screen ----
    if (!todaysWorkout) {
      return (
        <div className="space-y-4">
          <header>
            <h1 className="text-xl font-bold">Heute</h1>
            <p className="text-sm text-cocoa-light">{dateLabel}</p>
          </header>
          <DailyOverview />
          <div className="card space-y-3">
            <h2 className="font-semibold">Training starten</h2>
            {plans && plans.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    className="btn-ghost justify-start gap-2 py-3 text-left"
                    disabled={createWorkout.isPending}
                    onClick={() => {
                      setPendingPlanId(p.id)
                      createWorkout.mutate({ date: today })
                    }}
                  >
                    <span className="text-brand">▶</span>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              className={plans?.length ? 'btn-ghost w-full' : 'btn-primary w-full'}
              onClick={() => createWorkout.mutate({ date: today })}
              disabled={createWorkout.isPending}
            >
              {plans?.length ? 'Freies Training' : 'Training starten'}
            </button>
            {saveError && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {saveError.message}</p>}
          </div>
          <p className="px-2 text-center text-xs text-cocoa-muted">
            <span className="font-semibold">Challenge des Tages:</span> {challengeOfDay()}
          </p>
          <button
            className="w-full text-center text-xs text-cocoa-muted underline"
            onClick={() => setExcuse(randomExcuse())}
          >
            Keine Lust? Ausrede generieren 😅
          </button>
          {excuse && <p className="text-center text-sm italic text-cocoa-light">„{excuse}"</p>}
        </div>
      )
    }

    // ---- Laufendes Training ----
    const hasSets = (workoutSets?.length ?? 0) > 0
    const active = selectedExercise
    const activeSets = active ? setsOf(active.id) : []
    const pair = active ? pairOf(pairs, active.id) : null
    const curIdx = todayExIds.indexOf(exerciseId)
    const nextExId = curIdx >= 0 ? todayExIds[curIdx + 1] : undefined
    const q = pickerQuery.trim().toLowerCase()
    const pickerList = (exercises ?? [])
      .filter((e) => (sheet === 'pair' ? e.id !== exerciseId && !pairOf(pairs, e.id) : true))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const startMs = hasSets
      ? Math.min(...workoutSets!.map((s) => Date.parse(s.created_at)))
      : Date.now()
    const minutes = Math.round((Date.now() - startMs) / 60000)

    return (
      <div className="space-y-3 pb-20">
        <Confetti show={confetti} onDone={() => setConfetti(false)} />
        {/* Rekord als schwebender Hinweis oben — verschiebt den Inhalt nicht */}
        {prName && confetti && (
          <div className="pointer-events-none fixed inset-x-0 top-[76px] z-30 mx-auto max-w-md px-4">
            <div className="animate-[pop_0.35s_ease-out] rounded-full bg-gradient-to-r from-amber-500 to-ruby px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
              🏆 Neuer Rekord: {prName}
            </div>
          </div>
        )}

        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Heute</h1>
            <p className="truncate text-xs text-cocoa-light">
              {hasSets
                ? `${doneCount}/${workoutSets!.length} Sätze · ${Math.round(
                    totalVolume(workoutSets!),
                  ).toLocaleString('de-DE')} kg`
                : dateLabel}
            </p>
          </div>
          {hasSets && (
            <button className="btn-primary shrink-0 px-4 py-2 text-sm" onClick={() => setSheet('finish')}>
              Beenden
            </button>
          )}
        </header>

        {saveError && (
          <div className="rounded-xl bg-red-500/10 p-2.5 text-xs text-red-500 ring-1 ring-red-400/60">
            ⚠️ {saveError.message} — wird automatisch erneut gesendet, sobald wieder Verbindung besteht.
          </div>
        )}

        {/* Übungsleiste */}
        {hasSets && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {todayExIds.map((id) => {
              const ex = exById.get(id)
              const list = setsOf(id)
              const d = list.filter((s) => isSetDone(s, isUni(id))).length
              const complete = list.length > 0 && d === list.length
              const isActive = id === exerciseId
              const p = pairOf(pairs, id)
              return (
                <Fragment key={id}>
                  {p && p[1] === id && <span className="-mx-1 self-center text-xs text-brand">⛓</span>}
                  <button
                    onClick={() => setExerciseId(id)}
                    className={`flex shrink-0 flex-col items-start rounded-xl px-3 py-1.5 text-left ring-1 transition ${
                      isActive
                        ? 'bg-brand text-white ring-brand'
                        : complete
                          ? 'bg-brand/10 text-cocoa ring-brand/30'
                          : 'bg-sand-light text-cocoa ring-sand-dark'
                    }`}
                  >
                    <span className="max-w-[9rem] truncate text-sm font-semibold">
                      {complete && !isActive ? '✓ ' : ''}
                      {ex?.name ?? 'Übung'}
                    </span>
                    <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-cocoa-muted'}`}>
                      {d}/{list.length} Sätze
                    </span>
                  </button>
                </Fragment>
              )
            })}
            <button
              onClick={() => setSheet('picker')}
              className="grid shrink-0 place-items-center rounded-xl border border-dashed border-sand-dark px-4 text-lg text-cocoa-light"
              aria-label="Übung hinzufügen"
            >
              ＋
            </button>
          </div>
        )}

        {/* Leeres Training: Einstieg */}
        {!hasSets && !active && (
          <>
            <DailyOverview />
            <div className="card space-y-3">
              <h2 className="font-semibold">Womit startest du?</h2>
              {plans && plans.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      className="btn-ghost justify-start gap-2 py-3 text-left"
                      onClick={() => loadPlanOrdered(p)}
                      disabled={addSets.isPending}
                    >
                      <span className="text-brand">▶</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn-primary w-full" onClick={() => setSheet('picker')}>
                Übung wählen
              </button>
            </div>
          </>
        )}

        {/* Aktive Übung */}
        {active && (
          <div className="card space-y-2">
            {pair && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-sand-light p-1 ring-1 ring-sand-dark">
                {pair.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => setExerciseId(id)}
                    className={`truncate rounded-lg px-2 py-1 text-xs font-semibold ${
                      id === exerciseId ? 'bg-brand text-white' : 'text-cocoa-light'
                    }`}
                  >
                    A{i + 1} · {exById.get(id)?.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{active.name}</h2>
                <p className="truncate text-xs text-cocoa-light">
                  {[active.muscle_group, ...(active.secondary_muscles ?? [])].join(' · ')}
                  {pair ? ' · Supersatz' : ''}
                </p>
              </div>
              <button
                className="-mr-1 shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-cocoa-muted"
                onClick={() => setSheet('menu')}
                aria-label="Übungs-Optionen"
              >
                ⋯
              </button>
            </div>
            {suggestion && (
              <button
                type="button"
                onClick={() => setTipOpen((o) => !o)}
                className="w-full rounded-lg bg-sand/60 px-2.5 py-1.5 text-left text-xs"
              >
                <span className={`${tipStyles[suggestion.action]} ${tipOpen ? 'block' : 'line-clamp-2'}`}>
                  💡 {suggestion.reason}
                </span>
              </button>
            )}
            {activeSets.length > 0 ? (
              <div className="space-y-1">
                <SetTableHeader />
                {activeSets.map((s) => (
                  <CompactSetRow
                    key={s.id}
                    set={s}
                    exercise={active}
                    badge={badgeFor(s, activeSets)}
                    prev={prevFor(active.id, s, activeSets)}
                    onDone={() => onSetDone(active.id, s)}
                  />
                ))}
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={addTemplate} disabled={addSets.isPending}>
                Standard-Sätze anlegen
              </button>
            )}
          </div>
        )}

        {/* Feste Aktionsleiste über der Tab-Leiste */}
        {active && (
          <div
            className="fixed inset-x-0 z-10 mx-auto max-w-md px-3"
            style={{ bottom: 'calc(62px + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-2 rounded-2xl bg-cream/95 p-2 shadow-lg ring-1 ring-sand-dark backdrop-blur">
              <RestControl timer={rest} />
              {rest.left == null && (
                <>
                  <button className="btn-ghost flex-1 px-2 py-2 text-sm" onClick={addOne} disabled={addSet.isPending}>
                    + Satz
                  </button>
                  {nextExId ? (
                    <button className="btn-primary flex-1 px-2 py-2 text-sm" onClick={() => setExerciseId(nextExId)}>
                      Nächste →
                    </button>
                  ) : (
                    <button className="btn-primary flex-1 px-2 py-2 text-sm" onClick={() => setSheet('finish')}>
                      Fertig ✓
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- Sheets ---- */}
        {sheet === 'menu' && active && (
          <Sheet title={active.name} onClose={() => setSheet(null)}>
            {active.notes && (
              <p className="rounded-xl bg-sand p-2.5 text-sm text-cocoa ring-1 ring-sand-dark">{active.notes}</p>
            )}
            <div className="grid gap-2">
              {pair ? (
                <button
                  className="btn-ghost w-full justify-start"
                  onClick={() => {
                    unpair(active.id)
                    setSheet(null)
                  }}
                >
                  ⛓ Supersatz lösen
                </button>
              ) : (
                <button className="btn-ghost w-full justify-start" onClick={() => setSheet('pair')}>
                  ⛓ Als Supersatz kombinieren …
                </button>
              )}
              <button className="btn-ghost w-full justify-start" onClick={() => setSheet('alts')}>
                🔄 Gerät besetzt? Alternative
              </button>
              <button
                className="btn-ghost w-full justify-start"
                onClick={() => {
                  addOne()
                  setSheet(null)
                }}
              >
                ＋ Satz hinzufügen
              </button>
              {activeSets.length > 0 && (
                <button
                  className="btn-ghost w-full justify-start text-red-500"
                  onClick={() => {
                    if (!confirm(`„${active.name}" aus dem heutigen Training entfernen?`)) return
                    activeSets.forEach((s) => deleteSet.mutate(s))
                    unpair(active.id)
                    setExerciseId('')
                    setSheet(null)
                  }}
                >
                  🗑 Aus heutigem Training entfernen
                </button>
              )}
            </div>
          </Sheet>
        )}

        {(sheet === 'picker' || sheet === 'pair') && (
          <Sheet
            title={sheet === 'pair' ? 'Supersatz-Partner wählen' : 'Übung hinzufügen'}
            onClose={() => {
              setSheet(null)
              setPickerQuery('')
            }}
          >
            <input
              className="input"
              placeholder="Suchen (Name oder Muskel) …"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
            />
            {sheet === 'picker' && plans && plans.length > 0 && !q && (
              <div>
                <div className="label">Ganzen Plan laden</div>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      className="rounded-full bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand ring-1 ring-brand/30"
                      onClick={() => loadPlanOrdered(p)}
                    >
                      ▶ {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ul className="divide-y divide-sand-dark/60">
              {pickerList.map((e) => {
                const inToday = todayExIds.includes(e.id)
                return (
                  <li key={e.id}>
                    <button
                      className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
                      onClick={() => {
                        if (sheet === 'pair') pairWith(e.id)
                        else if (inToday) {
                          setExerciseId(e.id)
                          setSheet(null)
                          setPickerQuery('')
                        } else addExerciseToday(e.id)
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="block text-xs text-cocoa-light">{e.muscle_group}</span>
                      </span>
                      {inToday && <span className="shrink-0 text-xs text-brand">✓ heute</span>}
                    </button>
                  </li>
                )
              })}
              {pickerList.length === 0 && (
                <li className="py-3 text-sm text-cocoa-light">
                  Keine Übung gefunden. Neue Übungen legst du im Tab „Übungen" an.
                </li>
              )}
            </ul>
          </Sheet>
        )}

        {sheet === 'alts' && active && (
          <Sheet
            title="Alternative Übung"
            onClose={() => {
              setSheet(null)
              setAltAi(null)
            }}
          >
            {alternatives.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {alternatives.map((a) => (
                  <button
                    key={a.id}
                    className="rounded-full bg-sand-light px-3 py-1.5 text-sm ring-1 ring-sand-dark"
                    onClick={() => addExerciseToday(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-cocoa-light">Keine eigene Übung mit gleicher Muskelgruppe.</p>
            )}
            {ai?.enabled && (
              <button className="btn-ghost w-full" onClick={findAltAi} disabled={altBusy}>
                {altBusy ? 'Suche …' : '🤖 Beste Alternative finden'}
              </button>
            )}
            {altAi &&
              (altAi.name ? (
                <button
                  className="w-full rounded-xl bg-brand/10 p-3 text-left text-sm ring-1 ring-brand/30"
                  onClick={() => {
                    const ex = exercises?.find((e) => e.name === altAi.name)
                    if (ex) addExerciseToday(ex.id)
                    setAltAi(null)
                  }}
                >
                  <span className="font-semibold text-brand">→ {altAi.name}</span>
                  <span className="mt-0.5 block text-cocoa-light">{altAi.reason}</span>
                </button>
              ) : (
                <p className="text-sm text-cocoa-light">{altAi.reason || 'Keine passende Alternative gefunden.'}</p>
              ))}
          </Sheet>
        )}

        {sheet === 'finish' && (
          <Sheet title="Training beenden" onClose={() => setSheet(null)}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-sand-light p-2 ring-1 ring-sand-dark">
                <div className="text-lg font-bold">{doneCount}</div>
                <div className="text-[11px] text-cocoa-light">Sätze</div>
              </div>
              <div className="rounded-xl bg-sand-light p-2 ring-1 ring-sand-dark">
                <div className="text-lg font-bold">
                  {Math.round(totalVolume(workoutSets ?? [])).toLocaleString('de-DE')}
                </div>
                <div className="text-[11px] text-cocoa-light">kg Volumen</div>
              </div>
              <div className="rounded-xl bg-sand-light p-2 ring-1 ring-sand-dark">
                <div className="text-lg font-bold">{minutes > 0 && minutes < 300 ? minutes : '–'}</div>
                <div className="text-[11px] text-cocoa-light">Minuten</div>
              </div>
            </div>
            {prName && (
              <p className="rounded-xl bg-amber-500/10 p-2.5 text-center text-sm font-semibold text-amber-600 dark:text-amber-400">
                🏆 Neuer Rekord: {prName}
              </p>
            )}
            {openSets.length > 0 && (
              <button
                className="flex w-full items-center gap-2 text-left text-sm"
                onClick={() => setDropOpenSets((v) => !v)}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded text-xs ${
                    dropOpenSets ? 'bg-brand text-white' : 'ring-1 ring-sand-dark'
                  }`}
                >
                  {dropOpenSets ? '✓' : ''}
                </span>
                {openSets.length} nicht abgehakte Sätze entfernen
              </button>
            )}
            {hype && (
              <p className="rounded-lg bg-ruby/10 p-2 text-center text-sm font-semibold text-ruby dark:text-rose-300">
                {hype}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {ai?.enabled && (
                <button className="btn-ghost text-sm" onClick={makeHype} disabled={hypeBusy}>
                  {hypeBusy ? '…' : '🔥 Spruch'}
                </button>
              )}
              <button className={`btn-ghost text-sm ${ai?.enabled ? '' : 'col-span-2'}`} onClick={shareToday}>
                📤 Teilen
              </button>
            </div>
            <button className="btn-primary w-full" onClick={finishNew}>
              Speichern & zum Verlauf
            </button>
            <button className="w-full text-center text-sm text-cocoa-light" onClick={() => setSheet(null)}>
              Weiter trainieren
            </button>
          </Sheet>
        )}
      </div>
    )
  }

  if (!todaysWorkout) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Training</h1>
        {isNew && <DailyOverview />}
        <div className="card space-y-3 text-center">
          <p className="text-cocoa">Heute noch kein Training erfasst.</p>
          <button
            className="btn-primary w-full"
            onClick={() => createWorkout.mutate({ date: today })}
            disabled={createWorkout.isPending}
          >
            Training starten
          </button>
          {saveError && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {saveError.message}</p>}
          {isNew && (
            <button
              className="w-full text-center text-xs text-cocoa-muted underline"
              onClick={() => setExcuse(randomExcuse())}
            >
              Keine Lust? Ausrede generieren 😅
            </button>
          )}
          {isNew && excuse && <p className="text-sm italic text-cocoa-light">„{excuse}"</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isNew && <Confetti show={confetti} onDone={() => setConfetti(false)} />}
      <RestTimer ref={restRef} />
      {isNew && prName && confetti && (
        <div className="rounded-xl bg-gradient-to-r from-amber-500 to-ruby p-3 text-center font-bold text-white shadow-lg">
          🎉 Neuer Rekord bei {prName}!
        </div>
      )}
      <header className="space-y-3">
        <div>
          <h1 className="text-xl font-bold">Heute</h1>
          <p className="text-sm text-cocoa-light">
            {new Date(today).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        {workoutSets && workoutSets.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="card py-2 text-center">
              <div className="text-lg font-bold text-cocoa">{workoutSets.length}</div>
              <div className="text-[11px] text-cocoa-light">Sätze</div>
            </div>
            <div className="card py-2 text-center">
              <div className="text-lg font-bold text-cocoa">
                {new Set(workoutSets.map((s) => s.exercise_id)).size}
              </div>
              <div className="text-[11px] text-cocoa-light">Übungen</div>
            </div>
            <div className="card py-2 text-center">
              <div className="text-lg font-bold text-cocoa">{Math.round(totalVolume(workoutSets))}</div>
              <div className="text-[11px] text-cocoa-light">kg Volumen</div>
            </div>
          </div>
        )}
      </header>

      {isNew && <DailyOverview />}

      {isNew && (
        <div className="rounded-xl bg-brand/10 p-2.5 text-sm text-cocoa ring-1 ring-brand/25">
          <span className="font-semibold">Challenge des Tages: </span>
          {challengeOfDay()}
        </div>
      )}

      {saveError && (
        <div className="card border border-red-400 text-sm text-red-500 dark:text-red-400">
          ⚠️ Konnte nicht speichern: {saveError.message}
          <div className="mt-1 text-xs text-cocoa-light">
            Deine Eingaben sind zwischengespeichert und werden automatisch erneut gesendet, sobald
            wieder Verbindung besteht.
          </div>
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="card space-y-2">
          <label className="label">Plan</label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
                planId === ''
                  ? 'bg-ruby text-white ring-ruby'
                  : 'bg-sand-light text-cocoa ring-sand-dark'
              }`}
              onClick={() => setPlanId('')}
            >
              Alle
            </button>
            {plans.map((p) => (
              <button
                key={p.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
                  planId === p.id
                    ? 'bg-ruby text-white ring-ruby'
                    : 'bg-sand-light text-cocoa ring-sand-dark'
                }`}
                onClick={() => setPlanId(planId === p.id ? '' : p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {activePlan && activePlan.exercise_ids.length > 0 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={() => loadPlan(activePlan)}
              disabled={addSets.isPending}
            >
              ⬇️ Ganzen Plan laden ({activePlan.exercise_ids.length} Übungen)
            </button>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <label className="label">Übung</label>
          <select
            className="input"
            value={exerciseId}
            onChange={(e) => selectExercise(e.target.value)}
          >
            <option value="">— wählen —</option>
            {visibleExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {doneExerciseIds.has(ex.id) ? '✓ ' : ''}
                {ex.name}
              </option>
            ))}
          </select>
          {exercises?.length === 0 && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              Lege zuerst unter „Übungen" eine Übung an.
            </p>
          )}
          {activePlan && visibleExercises.length === 0 && (
            <p className="mt-1 text-sm text-cocoa-muted">
              Dieser Plan hat noch keine Übungen. Füge sie im Tab „Pläne" hinzu.
            </p>
          )}
        </div>

        {selectedExercise && (
          <>
            {selectedExercise.notes && (
              <div className="rounded-xl bg-sand p-2.5 text-sm text-cocoa ring-1 ring-sand-dark">
                {selectedExercise.notes}
              </div>
            )}

            {isNew && (alternatives.length > 0 || ai?.enabled) && (
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  {alternatives.length > 0 && (
                    <button
                      className="text-xs font-medium text-brand"
                      onClick={() => setShowAlts((s) => !s)}
                    >
                      🔄 Gerät besetzt? Alternative ({alternatives.length})
                    </button>
                  )}
                  {ai?.enabled && (
                    <button
                      className="text-xs font-medium text-brand disabled:opacity-40"
                      onClick={findAltAi}
                      disabled={altBusy}
                    >
                      {altBusy ? '… suche' : '🤖 Beste Alternative'}
                    </button>
                  )}
                </div>
                {showAlts && alternatives.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {alternatives.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          selectExercise(a.id)
                          setShowAlts(false)
                        }}
                        className="rounded-full bg-sand-light px-2.5 py-1 text-xs ring-1 ring-sand-dark"
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
                {altAi && (
                  <div className="rounded-lg bg-sand p-2 text-xs ring-1 ring-sand-dark">
                    {altAi.name ? (
                      <>
                        <button
                          className="font-semibold text-brand"
                          onClick={() => {
                            const ex = exercises?.find((e) => e.name === altAi.name)
                            if (ex) selectExercise(ex.id)
                            setAltAi(null)
                          }}
                        >
                          → {altAi.name} wählen
                        </button>
                        <div className="mt-0.5 text-cocoa-light">{altAi.reason}</div>
                      </>
                    ) : (
                      <span className="text-cocoa-light">{altAi.reason || 'Keine passende Alternative gefunden.'}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {suggestion && (
              <div className="rounded-xl bg-sand/50 p-3 text-sm ring-1 ring-sand-dark">
                <span className="font-semibold">💡 Tipp: </span>
                <span className={tipStyles[suggestion.action]}>{suggestion.reason}</span>
                {lastSession && (
                  <div className="mt-1 text-xs text-cocoa-muted">
                    Letztes Training (
                    {new Date(lastSession.date).toLocaleDateString('de-DE')}):{' '}
                    {lastSession.sets.map((s) => `${s.reps}×${s.weight}kg`).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Editierbare Satz-Zeilen */}
            {setsForExercise.length > 0 && (
              <div className="space-y-2">
                {setsForExercise.map((s) => (
                  <EditableSetRow key={s.id} set={s} exercise={selectedExercise} />
                ))}
              </div>
            )}


            {/* Aktionen */}
            {setsForExercise.length === 0 ? (
              <div className="space-y-2">
                <button
                  className="btn-primary w-full"
                  onClick={addTemplate}
                  disabled={addSets.isPending}
                >
                  Standard-Sätze anlegen
                </button>
                <p className="text-center text-xs text-cocoa-muted">
                  {willWarmup
                    ? '1 Aufwärmen · 2 Arbeitssätze · 1 Dropsatz'
                    : '2 Arbeitssätze · 1 Dropsatz (Muskel schon warm → kein Aufwärmsatz)'}{' '}
                  — danach nur noch Gewicht/Wdh anpassen
                </p>
                <button className="btn-ghost w-full" onClick={addOne} disabled={addSet.isPending}>
                  + Einzelnen Satz
                </button>
              </div>
            ) : (
              <button className="btn-ghost w-full" onClick={addOne} disabled={addSet.isPending}>
                + Satz hinzufügen
              </button>
            )}
          </>
        )}
      </div>

      {/* Übersicht aller heute erfassten Sätze */}
      {workoutSets && workoutSets.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Heute erfasst</h2>
          <ul className="space-y-1 text-sm text-cocoa">
            {Object.entries(
              workoutSets.reduce<Record<string, number>>((acc, s) => {
                acc[s.exercise_id] = (acc[s.exercise_id] ?? 0) + 1
                return acc
              }, {}),
            ).map(([exId, count]) => (
              <li key={exId} className="flex justify-between">
                <span>{exercises?.find((e) => e.id === exId)?.name ?? 'Übung'}</span>
                <span className="text-cocoa-muted">{count} Sätze</span>
              </li>
            ))}
          </ul>

          {hype && (
            <p className="mt-3 rounded-lg bg-ruby/10 p-2 text-center text-sm font-semibold text-ruby dark:text-rose-300">
              {hype}
            </p>
          )}
          {isNew && ai?.enabled && (
            <button
              className="btn-ghost mt-2 w-full text-sm"
              onClick={makeHype}
              disabled={hypeBusy}
            >
              {hypeBusy ? '…' : '🔥 Motivations-Spruch'}
            </button>
          )}
        </div>
      )}

      {/* Training abschließen */}
      {workoutSets && workoutSets.length > 0 && (
        <div className="space-y-2">
          <button className="btn-primary w-full" onClick={finishWorkout}>
            Training speichern
          </button>
          {isNew && (
            <button className="btn-ghost w-full" onClick={shareToday}>
              📤 Als Bild teilen
            </button>
          )}
          <p className="text-center text-xs text-cocoa-muted">
            Deine Sätze sind automatisch gesichert — hier kommst du zum Verlauf.
          </p>
        </div>
      )}

      {/* Kleine Erklärung (einklappbar) */}
      <details className="rounded-xl bg-sand/40 p-3 text-xs leading-relaxed text-cocoa-muted">
        <summary className="cursor-pointer font-semibold text-cocoa-light">
          So erfasst du am besten
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Trag nur <span className="text-cocoa">saubere Wdh</span> ein (volle Bewegung, eigene
            Kraft) — die letzte halbe/erzwungene Wdh lässt du weg.
          </li>
          <li>
            <span className="text-orange-400">🔥 Versagen</span> ist Standard. Tipp es nur{' '}
            <span className="text-cocoa">aus</span> („nicht ans Limit"), wenn du den Satz mal
            nicht bis zum Limit gemacht hast.
          </li>
          <li>
            Der Tipp oben sagt dir dann, ob du das Gewicht <span className="text-cocoa">halten,
            steigern</span> oder reduzieren solltest.
          </li>
          <li>
            Der <span className="text-cocoa">Aufwärmsatz</span> kommt nur bei der ersten Übung
            einer Muskelgruppe — ist der Muskel schon warm, wird er weggelassen.
          </li>
        </ul>
      </details>
    </div>
  )
}
