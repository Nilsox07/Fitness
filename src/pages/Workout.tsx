import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useExercises } from '../hooks/useExercises'
import { usePlans } from '../hooks/usePlans'
import { usePrefs } from '../lib/prefs'
import {
  useAddSet,
  useAddSets,
  useAllSets,
  useCreateWorkout,
  useDeleteSet,
  useUpdateSet,
  useWorkoutSets,
  useWorkouts,
  newId,
} from '../hooks/useWorkouts'
import { EditableSetRow } from '../components/EditableSetRow'
import { DailyOverview } from '../components/DailyOverview'
import { Confetti } from '../components/Confetti'
import { RestTimer, type RestTimerHandle } from '../components/RestTimer'
import { parseLadder, snapToLadder } from '../lib/weights'
import {
  frequencyStats,
  isPerformed,
  onlyWorking,
  sessionDates,
  setBest1RM,
  progressionSuggestion,
  summarizeSessions,
  totalVolume,
} from '../lib/analytics'
import { trainingDay } from '../lib/day'
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
import { SessionClock } from '../components/workout/SessionClock'
import { PremiumSheet, SheetHero } from '../components/ui/PremiumSheet'
import { BIG_INPUT } from '../components/ui/GroupList'
import { HomeStart } from '../components/home/HomeStart'
import { enter } from '../components/home/motion'
import { MuscleChip } from '../components/exercises/MuscleBits'
import { MyBuddy } from '../components/buddy/MyBuddy'
import { showBuddyMoment } from '../components/buddy/BuddyMoment'
import { LibrarySheet } from '../components/library/LibrarySheet'
import { ExerciseHowTo } from '../components/library/ExerciseHowTo'
import { useLibraryMatch } from '../components/library/useLibrary'
import { LibraryResults } from '../components/library/LibraryResults'
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Lightbulb,
  Link2,
  ListChecks,
  MoreHorizontal,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Unlink,
} from 'lucide-react'
import {
  afterSetDone,
  getExerciseRest,
  getRestRules,
  restSecondsAfter,
  appendOrder,
  getPairs,
  getPlanQueue,
  typeOccurrence,
  setPlanQueue,
  pairOf,
  setPairs,
  sortByOrder,
  type Pair,
} from '../lib/workoutSession'

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

/** Gespeicherte „KI hat den Aufwärmsatz geprüft"-Übungen je Training (übersteht Reload). */
function readWarmupChecked(workoutId: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(`wo_warmup_checked_${workoutId}`) || '[]'))
  } catch {
    return new Set<string>()
  }
}
function writeWarmupChecked(workoutId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`wo_warmup_checked_${workoutId}`, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

/** Icon-Kachel für die Zeilen im Übungs-Menü (wie die Einstellungslisten). */
function MenuIcon({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
        danger ? 'bg-red-500/10 text-red-500 dark:text-red-400' : 'bg-brand/10 text-brand'
      }`}
    >
      {children}
    </span>
  )
}

/** Kleine Abschnittsüberschrift in den Sheets. */
function SheetLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{children}</h3>
  )
}

export default function Workout() {
  const navigate = useNavigate()
  // Trainings-Tag (Wechsel um 4 Uhr). Beim Zurückkehren in die App neu berechnen,
  // damit eine über Nacht offene App nicht beim gestrigen Training hängen bleibt.
  const [, setDayTick] = useState(0)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setDayTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const today = trainingDay()
  const { data: workouts } = useWorkouts()
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const { data: plans } = usePlans()
  const createWorkout = useCreateWorkout()
  const addSet = useAddSet()
  const addSets = useAddSets()
  const deleteSet = useDeleteSet()
  const updateSet = useUpdateSet()

  // Kurze lokale Sperre gegen Doppel-Tipps. Bewusst NICHT an isPending gekoppelt:
  // offline pausierte Schreibvorgänge bleiben „pending", die Knöpfe sollen aber
  // weiter funktionieren (die Daten stehen dank optimistischer Updates sofort da).
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  function guarded(fn: () => void) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      fn()
    } finally {
      window.setTimeout(() => {
        busyRef.current = false
        setBusy(false)
      }, 400)
    }
  }

  const todaysWorkout = workouts?.find((w) => w.date === today)
  const { data: workoutSets } = useWorkoutSets(todaysWorkout?.id)
  // Immer der neueste Stand (für asynchrone Entscheidungen, z. B. KI-Aufwärmcheck)
  const latestSets = useRef(workoutSets)
  latestSets.current = workoutSets

  // Training für heute anlegen — höchstens eins pro Tag (auch wenn das Anlegen
  // offline noch aussteht, steht es dank optimistischem Update schon im Cache).
  const creatingFor = useRef('')
  function startWorkout(): boolean {
    if (todaysWorkout || (creatingFor.current === today && !createWorkout.isError)) return false
    creatingFor.current = today
    createWorkout.mutate({ id: newId(), date: today })
    return true
  }

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
    const done = workoutSets.filter(isPerformed)
    const exCount = new Set(done.map((s) => s.exercise_id)).size
    const sessions = frequencyStats(sessionDates(allSets ?? [])).totalSessions
    await shareStatCard({
      title: 'Training abgeschlossen 💪',
      dateLabel: new Date(today + 'T00:00:00').toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      volume: Math.round(totalVolume(done)),
      sets: done.length,
      exercises: exCount,
      highlight: prName ? `Rekord: ${prName}` : undefined,
      rank: rankForSessions(sessions).title,
      // Neue App: der Buddy ist ein SVG (im Canvas nicht darstellbar) → neutrales Emoji
      // statt der alten Küken-/Ei-Stufen. Klassisch bleibt unverändert.
      mascot: isNew ? (prName ? '🏆' : '💪') : mascotStage(sessions).emoji,
    })
  }

  function finishWorkout() {
    // Nur erledigte Sätze zählen; ohne einen einzigen erledigten Satz kein Feed-Post.
    const done = (workoutSets ?? []).filter(isPerformed)
    if (isNew && done.length) {
      const key = `feed_workout_${today}`
      let posted = false
      try {
        posted = localStorage.getItem(key) === '1'
      } catch {
        /* ignore */
      }
      if (!posted) {
        const exCount = new Set(done.map((s) => s.exercise_id)).size
        postActivity.mutate({
          kind: 'workout',
          title: 'Training abgeschlossen 💪',
          detail: `${done.length} Sätze · ${exCount} Übungen · ${Math.round(totalVolume(done))} kg`,
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
      const done = workoutSets.filter(isPerformed)
      const perEx = new Map<string, number>()
      done.forEach((s) => perEx.set(s.exercise_id, (perEx.get(s.exercise_id) ?? 0) + 1))
      setHype(
        await hypeLine({
          saetze: done.length,
          uebungen: perEx.size,
          volumen: Math.round(totalVolume(done)),
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
    const best1RM = setBest1RM
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

  // Alle heutigen Rekorde (nur Anzeige in der Abschluss-Übersicht; gleiche Regel wie oben).
  const todayPrs = useMemo(() => {
    if (!isNew || !workoutSets || !allSets || !exercises) return []
    const prior = new Map<string, number>()
    for (const s of onlyWorking(allSets)) {
      if (s.date === today) continue
      prior.set(s.exercise_id, Math.max(prior.get(s.exercise_id) ?? 0, setBest1RM(s)))
    }
    const todays = new Map<string, number>()
    for (const s of onlyWorking(workoutSets)) {
      todays.set(s.exercise_id, Math.max(todays.get(s.exercise_id) ?? 0, setBest1RM(s)))
    }
    const out: { id: string; name: string; e1: number; gain: number }[] = []
    for (const [exId, cur] of todays) {
      const before = prior.get(exId) ?? 0
      if (before > 0 && cur > before + 0.01) {
        out.push({
          id: exId,
          name: exercises.find((e) => e.id === exId)?.name ?? 'Übung',
          e1: cur,
          gain: cur - before,
        })
      }
    }
    return out
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

  /**
   * Aufwärmsatz VOR die bestehenden Sätze setzen. set_number muss laut DB > 0
   * sein — ist vorne kein Platz, rücken die bestehenden Sätze eine Nummer nach
   * hinten (die Updates laufen in derselben Warteschlange vor dem Einfügen).
   */
  function insertWarmupFirst(ex: Exercise, exSets: WorkoutSet[], base: number) {
    if (!todaysWorkout) return
    const d = deriveSet('warmup', base)
    const weight = snapWeight(ex, d.weight)
    const minNo = exSets.reduce((m, s) => Math.min(m, s.set_number), Infinity)
    let setNumber = 1
    if (exSets.length && minNo > 1) setNumber = minNo - 1
    else if (exSets.length) {
      for (const s of [...exSets].sort((a, b) => b.set_number - a.set_number)) {
        updateSet.mutate({ id: s.id, set_number: s.set_number + 1 })
      }
    }
    addSet.mutate({
      workout_id: todaysWorkout.id,
      exercise_id: ex.id,
      set_number: setNumber,
      reps: d.reps,
      weight,
      reps_right: ex.unilateral ? d.reps : null,
      weight_right: ex.unilateral ? weight : null,
      set_type: 'warmup',
      to_failure: false,
    })
  }

  // KI entscheidet im Hintergrund über den Aufwärmsatz und passt ihn still an —
  // aber nur, solange bei der Übung noch kein Satz erledigt ist, und nur einmal
  // pro Übung und Training (gemerkt in localStorage, übersteht also einen Reload).
  const exNotStarted =
    !!selectedExercise &&
    setsForExercise.length > 0 &&
    !setsForExercise.some((s) => isSetDone(s, selectedExercise.unilateral))
  useEffect(() => {
    const wid = todaysWorkout?.id
    if (!isNew || !ai?.enabled || !selectedExercise || !wid || !exNotStarted) return
    const checked = readWarmupChecked(wid)
    if (checked.has(selectedExercise.id)) return
    checked.add(selectedExercise.id)
    writeWarmupChecked(wid, checked)
    const ex = selectedExercise
    const base = workingBase
    ;(async () => {
      try {
        const otherSets = (workoutSets ?? []).filter((s) => s.exercise_id !== ex.id)
        const adv = await warmupAdvice({
          exercise: ex.name,
          primary: ex.muscle_group,
          secondary: ex.secondary_muscles ?? [],
          muscleAlreadyWarm: !willWarmup,
          firstOfSession: otherSets.length === 0,
          base,
        })
        // Aktuellen Stand prüfen — inzwischen könnte schon ein Satz erledigt sein.
        const exSets = (latestSets.current ?? [])
          .filter((s) => s.exercise_id === ex.id && s.workout_id === wid)
          .sort((a, b) => a.set_number - b.set_number)
        if (exSets.length === 0 || exSets.some((s) => isSetDone(s, ex.unilateral))) return
        const warmups = exSets.filter((s) => s.set_type === 'warmup')
        if (adv.warmup && warmups.length === 0) insertWarmupFirst(ex, exSets, base)
        else if (!adv.warmup) {
          // Erledigte Aufwärmsätze werden nie gelöscht.
          for (const w of warmups) if (!isSetDone(w, ex.unilateral)) deleteSet.mutate(w)
        }
      } catch {
        /* still im Hintergrund – Standardregel bleibt */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, ai?.enabled, selectedExercise?.id, exNotStarted, todaysWorkout?.id])

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

  function addTemplate() {
    guarded(() => {
      if (!todaysWorkout || !selectedExercise) return
      // Schon Sätze da (z. B. Doppel-Tipp, optimistisch eingetragen)? Dann nichts tun.
      if ((latestSets.current ?? []).some((s) => s.exercise_id === selectedExercise.id)) return
      const warmed = warmedMuscleGroups(
        (workoutSets ?? []).filter((s) => s.exercise_id !== selectedExercise.id),
        exercises ?? [],
      )
      addSets.mutate(
        templateInputs(
          todaysWorkout.id,
          selectedExercise,
          workingBase,
          nextSetNumber,
          needsWarmup(selectedExercise, warmed),
        ),
      )
    })
  }

  /**
   * Einen Satz anhängen. Leere Übung → erster Satz der (aufwärm-bewussten) Vorlage.
   * Sonst: Kopie des letzten ARBEITSsatzes (Typ + Gewicht) — nicht des Drops mit
   * seinen 70 %.
   */
  function addOne() {
    guarded(() => {
      if (!todaysWorkout || !selectedExercise) return
      const uni = selectedExercise.unilateral
      const lastWorking = [...setsForExercise].reverse().find((s) => s.set_type === 'working')
      let type: SetType
      let weight: number
      let weightRight: number | null
      if (setsForExercise.length === 0) {
        type = (willWarmup ? TEMPLATE : TEMPLATE_NO_WARMUP)[0]
        weight = snapWeight(selectedExercise, deriveSet(type, workingBase).weight)
        weightRight = uni ? weight : null
      } else {
        type = 'working'
        weight = lastWorking?.weight ?? snapWeight(selectedExercise, workingBase)
        weightRight = uni ? (lastWorking?.weight_right ?? weight) : null
      }
      addSet.mutate({
        workout_id: todaysWorkout.id,
        exercise_id: selectedExercise.id,
        set_number: nextSetNumber,
        reps: 0,
        weight,
        reps_right: uni ? 0 : null,
        weight_right: weightRight,
        set_type: type,
        to_failure: type === 'working' && lastWorking ? lastWorking.to_failure : type !== 'warmup',
      })
      autoRest()
    })
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
  // Übungsbibliothek (nur Neu-Modus): „Ausführung" der aktiven Übung + Bibliothek im Picker
  const [libOpen, setLibOpen] = useState(false)
  const [howToOpen, setHowToOpen] = useState(false)
  const [libAddId, setLibAddId] = useState('')
  const activeHowTo = useLibraryMatch(selectedExercise, isNew)
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
    const idx = list.findIndex((x) => x.id === s.id)
    // Der gerade abgehakte Satz gilt als erledigt, auch wenn das (optimistische)
    // Update noch nicht im Cache angekommen ist.
    const isDone = (id: string, x: WorkoutSet) => x.id === s.id || isSetDone(x, isUni(id))
    // Runde = gleicher Satz-Typ an gleicher Position (k-ter Arbeitssatz ↔ k-ter Arbeitssatz)
    const decision = afterSetDone({
      exId,
      setType: s.set_type,
      occurrence: typeOccurrence(list, idx),
      pairs,
      setsOf: (id) => setsOf(id).map((x) => ({ set_type: x.set_type, done: isDone(id, x) })),
    })
    if (decision.rest && rest.mode === 'auto') {
      // Pausenlänge nach Satztyp: vor Drop keine, nach Aufwärmen kurz, sonst Übungs-/Standardpause.
      const nextEx = decision.next ?? exId
      // Nächster Satz: bei derselben Übung der nächste offene dahinter, sonst der
      // erste offene der nächsten Übung (Supersatz: nächste Runde von A1).
      const nextList = setsOf(nextEx)
      const nextSet =
        nextEx === exId
          ? (nextList.find((x) => x.set_number > s.set_number && !isDone(nextEx, x)) ??
            nextList.find((x) => !isDone(nextEx, x)))
          : nextList.find((x) => !isDone(nextEx, x))
      const base = getExerciseRest(nextEx) ?? rest.total
      const sec = restSecondsAfter(s.set_type, nextSet?.set_type ?? null, base, getRestRules())
      if (sec > 0) rest.start(sec)
      else rest.stop()
    }
    if (decision.next) setExerciseId(decision.next)
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
  }

  // Übungen, die gerade aus dem Training entfernt werden (Löschen läuft noch).
  const removingIds = useRef<Set<string>>(new Set())

  function addExerciseToday(id: string) {
    removingIds.current.delete(id)
    if (woId) appendOrder(woId, [id])
    selectExercise(id)
    setSheet(null)
    setPickerQuery('')
    bump()
  }

  // Aus der Bibliothek neu angelegte Übung: hinzufügen, sobald sie in der Liste ist.
  useEffect(() => {
    if (!libAddId || !exById.has(libAddId)) return
    setLibAddId('')
    addExerciseToday(libAddId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libAddId, exById])

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

  // Plan = Reihenfolge-Vorlage: nicht alles vorab anlegen, sondern Übung für
  // Übung dazuholen. So bleibt die Leiste kurz und spontane Übungen passen rein.
  const planQueue = useMemo(
    () => (woId ? getPlanQueue(woId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [woId, sessionVer],
  )
  const queuePlan = plans?.find((p) => p.id === planQueue?.planId)
  const remainingPlanIds = (planQueue?.ids ?? []).filter(
    (id) => !todayExIds.includes(id) && exById.has(id) && id !== exerciseId,
  )

  function loadPlanOrdered(plan: PlanWithExercises) {
    if (!woId) return
    setPlanQueue(woId, { planId: plan.id, ids: plan.exercise_ids })
    const first = plan.exercise_ids.find((id) => !todayExIds.includes(id) && exById.has(id))
    if (first) addExerciseToday(first)
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

  // „Starten" auf der Pläne-Seite: navigate('/', { state: { startPlanId } }).
  // Einmalig ausführen, dann den State leeren (kein erneutes Auslösen bei Reload).
  const location = useLocation()
  const handledStartKey = useRef('')
  useEffect(() => {
    const startPlanId = (location.state as { startPlanId?: string } | null)?.startPlanId
    if (!isNew || !startPlanId || handledStartKey.current === location.key) return
    if (!workouts || !plans || (todaysWorkout && !workoutSets)) return // Daten abwarten
    handledStartKey.current = location.key
    navigate('.', { replace: true, state: null })
    const p = plans.find((x) => x.id === startPlanId)
    if (!p) return
    if (todaysWorkout) {
      loadPlanOrdered(p)
    } else {
      setPendingPlanId(p.id)
      startWorkout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, location.key, location.state, workouts, plans, todaysWorkout, workoutSets])

  // Beim Öffnen automatisch die erste noch offene Übung wählen.
  useEffect(() => {
    if (!isNew || exerciseId) return
    const ids = todayExIds.filter((id) => !removingIds.current.has(id))
    if (ids.length === 0) return
    const firstOpen = ids.find((id) => setsOf(id).some((s) => !isSetDone(s, isUni(id))))
    setExerciseId(firstOpen ?? ids[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, exerciseId, todayExIds])

  const openSets = (workoutSets ?? []).filter((s) => !isSetDone(s, isUni(s.exercise_id)))
  const doneCount = (workoutSets?.length ?? 0) - openSets.length

  function finishNew() {
    // finishWorkout zählt nur erledigte Sätze — offene werden hier ggf. entfernt.
    // Kennzahlen für den Buddy-Moment vor dem Aufräumen festhalten.
    const doneSets = (workoutSets ?? []).filter((s) => isSetDone(s, isUni(s.exercise_id)))
    const firstMs = workoutSets?.length
      ? Math.min(...workoutSets.map((s) => Date.parse(s.created_at)))
      : Date.now()
    const mins = Math.round((Date.now() - firstMs) / 60000)
    const prCount = todayPrs.length || (prName ? 1 : 0)
    if (dropOpenSets) for (const s of openSets) deleteSet.mutate(s)
    setSheet(null)
    finishWorkout()
    if (woId && doneSets.length > 0) {
      // Großer Buddy-Moment (einmal pro Training, Host lebt in App.tsx).
      showBuddyMoment({
        key: `finish-${woId}`,
        mood: prCount > 0 ? 'proud' : 'cheer',
        title: 'Training geschafft!',
        subtitle: prCount > 0 ? 'Neuer Rekord – ich bin so stolz auf dich!' : 'Stark durchgezogen.',
        chips: [
          ...(mins > 0 && mins < 300 ? [{ value: String(mins), label: 'Min' }] : []),
          { value: String(doneSets.length), label: doneSets.length === 1 ? 'Satz' : 'Sätze' },
          { value: Math.round(totalVolume(doneSets)).toLocaleString('de-DE'), label: 'kg' },
          ...(prCount > 0 ? [{ value: String(prCount), label: prCount === 1 ? 'Rekord' : 'Rekorde' }] : []),
        ],
      })
    }
  }

  /** Übung aus dem heutigen Training entfernen und direkt die nächste wählen. */
  function removeExerciseToday(exId: string) {
    const list = setsOf(exId)
    removingIds.current.add(exId)
    const remaining = todayExIds.filter((id) => !removingIds.current.has(id))
    const idx = todayExIds.indexOf(exId)
    const after = todayExIds.slice(idx + 1).find((id) => !removingIds.current.has(id))
    list.forEach((s) => deleteSet.mutate(s))
    unpair(exId)
    setExerciseId(after ?? remaining[remaining.length - 1] ?? '')
    setSheet(null)
  }

  if (isNew) {
    const dateLabel = new Date(today + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    // ---- Heute noch kein Training: Start-Screen ----
    if (!todaysWorkout) {
      return (
        <HomeStart
          today={today}
          busy={busy}
          error={saveError}
          onStartPlan={(p) =>
            guarded(() => {
              setPendingPlanId(p.id)
              startWorkout()
            })
          }
          onStartFree={() => guarded(startWorkout)}
        />
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
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] z-30 mx-auto max-w-md px-4">
            <div className="flex animate-[pop_0.35s_ease-out] items-center justify-center gap-2 rounded-full bg-gold py-2 pl-2.5 pr-4 text-sm font-bold text-white shadow-lg dark:text-bg">
              <MyBuddy size={26} mood="proud" animate={false} className="-my-1.5" />
              Neuer Rekord: {prName}
            </div>
          </div>
        )}

        <header
          className="relative overflow-hidden rounded-3xl bg-cocoa p-4 text-cream shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
          style={enter(0)}
        >
          {/* dezenter Brand-Schimmer */}
          <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            <MyBuddy size={48} mood={prName && confetti ? 'cheer' : 'focus'} className="-my-1.5 -ml-1 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="shrink-0 text-xl font-bold tracking-tight">Heute</h1>
                {queuePlan && (
                  <span className="truncate rounded-full bg-cream/10 px-2.5 py-0.5 text-[11px] font-semibold text-cream/85 dark:bg-white/5 dark:text-cocoa">
                    {queuePlan.name}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-cream/60 dark:text-cocoa-light">{dateLabel}</p>
            </div>
            {hasSets && (
              <button
                className="btn-primary shrink-0 px-4 py-2 text-sm shadow-lg shadow-brand/30"
                onClick={() => setSheet('finish')}
              >
                Beenden
              </button>
            )}
          </div>
          {hasSets && (
            <>
              <div className="relative mt-4 grid grid-cols-3 gap-2">
                {(
                  [
                    [<SessionClock key="t" startMs={startMs} />, 'Dauer', Timer],
                    [
                      <span key="s" className="tabular">
                        {doneCount}
                        <span className="text-sm font-semibold opacity-50">/{workoutSets!.length}</span>
                      </span>,
                      'Sätze',
                      Check,
                    ],
                    [
                      <span key="v" className="tabular">
                        {Math.round(totalVolume(workoutSets!)).toLocaleString('de-DE')}
                      </span>,
                      'kg Volumen',
                      Dumbbell,
                    ],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <div key={label} className="min-w-0 rounded-2xl bg-cream/10 px-2.5 py-2 dark:bg-white/5">
                    <div className="truncate text-lg font-bold leading-tight">{value}</div>
                    <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-cream/55 dark:text-cocoa-light">
                      <Icon size={11} strokeWidth={2.5} className="shrink-0" />
                      <span className="truncate">{label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-cream/15 dark:bg-sand-dark/60">
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.round((doneCount / workoutSets!.length) * 100)}%` }}
                />
              </div>
            </>
          )}
        </header>

        {saveError && (
          <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{saveError.message} — wird automatisch erneut gesendet, sobald wieder Verbindung besteht.</span>
          </div>
        )}

        {/* Übungsleiste */}
        {hasSets && (
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={enter(1)}
          >
            <button
              onClick={() => setSheet('picker')}
              className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-sand-dark px-3.5 text-cocoa-light transition active:scale-95"
              aria-label="Übung hinzufügen"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">Übung</span>
            </button>
            {todayExIds.map((id) => {
              const ex = exById.get(id)
              const list = setsOf(id)
              const d = list.filter((s) => isSetDone(s, isUni(id))).length
              const complete = list.length > 0 && d === list.length
              const isActive = id === exerciseId
              const p = pairOf(pairs, id)
              return (
                <Fragment key={id}>
                  {p && p[1] === id && (
                    <Link2 size={14} className="-mx-1 shrink-0 self-center text-cocoa-muted" aria-label="Supersatz" />
                  )}
                  <button
                    onClick={() => setExerciseId(id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex min-w-[6.5rem] shrink-0 flex-col items-start rounded-2xl px-3 py-2 text-left transition duration-200 active:scale-95 ${
                      isActive
                        ? 'bg-cocoa text-cream shadow-md shadow-black/10 dark:shadow-none'
                        : complete
                          ? 'bg-success/10 text-cocoa'
                          : 'bg-cream text-cocoa'
                    }`}
                  >
                    <span className="flex max-w-[9rem] items-center gap-1 truncate text-sm font-semibold">
                      {complete && <Check size={13} strokeWidth={3} className={isActive ? '' : 'text-success'} />}
                      <span className="truncate">{ex?.name ?? 'Übung'}</span>
                    </span>
                    <span className={`tabular text-[10px] ${isActive ? 'opacity-70' : 'text-cocoa-muted'}`}>
                      {d}/{list.length} Sätze
                    </span>
                    <span
                      className={`mt-1 h-0.5 w-full overflow-hidden rounded-full ${isActive ? 'bg-cream/20' : 'bg-sand-dark/50'}`}
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-success transition-[width] duration-500"
                        style={{ width: `${list.length ? Math.round((d / list.length) * 100) : 0}%` }}
                      />
                    </span>
                  </button>
                </Fragment>
              )
            })}
          </div>
        )}

        {/* Plan als Vorlage: was noch kommt, ohne die Leiste zu füllen */}
        {hasSets && queuePlan && remainingPlanIds.length > 0 && (
          <button
            onClick={() => setSheet('picker')}
            className="flex w-full items-center gap-1.5 truncate rounded-full bg-sand/60 px-3 py-1.5 text-left text-xs text-cocoa-light"
          >
            <Play size={11} className="shrink-0 fill-brand text-brand" />
            <span className="truncate">
              <span className="font-semibold text-cocoa">{queuePlan.name}</span> · noch{' '}
              {remainingPlanIds.map((id) => exById.get(id)?.name).join(', ')}
            </span>
          </button>
        )}

        {/* Leeres Training: Einstieg */}
        {!hasSets && !active && (
          <>
            <DailyOverview />
            <div className="card space-y-3" style={enter(1)}>
              <h2 className="text-lg font-bold tracking-tight">Womit startest du?</h2>
              {plans && plans.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      className="btn justify-start gap-2 rounded-2xl bg-sand py-3 text-left text-cocoa"
                      onClick={() => guarded(() => loadPlanOrdered(p))}
                      disabled={busy}
                    >
                      <Play size={14} className="shrink-0 fill-brand text-brand" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn-primary w-full py-3" onClick={() => setSheet('picker')}>
                Übung wählen
              </button>
            </div>
          </>
        )}

        {/* Aktive Übung */}
        {active && (
          <div className="space-y-3 rounded-3xl bg-cream p-4" style={enter(2)}>
            {pair && (
              <div className="grid grid-cols-2 gap-1 rounded-full bg-sand p-1">
                {pair.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => setExerciseId(id)}
                    className={`truncate rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${
                      id === exerciseId ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
                    }`}
                  >
                    A{i + 1} · {exById.get(id)?.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {curIdx >= 0 && todayExIds.length > 1 && (
                  <p className="tabular text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
                    Übung {curIdx + 1} von {todayExIds.length}
                  </p>
                )}
                <h2 className="truncate text-xl font-bold leading-tight tracking-tight">{active.name}</h2>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                  <MuscleChip muscle={active.muscle_group} size="xs" />
                  {(active.secondary_muscles ?? []).slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium text-cocoa-light"
                    >
                      + {m}
                    </span>
                  ))}
                  {pair && (
                    <span className="flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-cocoa-light">
                      <Link2 size={11} /> Supersatz
                    </span>
                  )}
                  {activeHowTo && (
                    <button
                      className="flex shrink-0 items-center gap-1 rounded-full bg-cocoa px-2.5 py-0.5 text-[11px] font-semibold text-cream active:scale-95"
                      onClick={() => setHowToOpen(true)}
                      aria-label="Ausführung anzeigen"
                    >
                      <PlayCircle size={12} /> Ausführung
                    </button>
                  )}
                </div>
              </div>
              <button
                className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition active:scale-90"
                onClick={() => setSheet('menu')}
                aria-label="Übungs-Optionen"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            {suggestion && (
              <button
                type="button"
                onClick={() => setTipOpen((o) => !o)}
                className="flex w-full items-start gap-2 rounded-2xl bg-sand/70 px-3 py-2 text-left text-xs"
              >
                <Lightbulb size={14} className="mt-px shrink-0 text-gold" />
                <span className={`${tipStyles[suggestion.action]} ${tipOpen ? 'block' : 'line-clamp-2'}`}>
                  {suggestion.reason}
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
              <button className="btn-primary w-full" onClick={addTemplate} disabled={busy}>
                Standard-Sätze anlegen
              </button>
            )}
          </div>
        )}

        {/* Feste Aktionsleiste über der Tab-Leiste */}
        {active && (
          <div
            className="fixed inset-x-0 z-10 mx-auto max-w-md px-3"
            style={{ bottom: isNew ? 'calc(82px + env(safe-area-inset-bottom))' : 'calc(62px + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-2 rounded-3xl bg-cream/95 p-2 shadow-[0_4px_24px_rgb(0_0_0/0.12)] ring-1 ring-sand-dark/40 backdrop-blur">
              <RestControl timer={rest} exercise={active ? { id: active.id, name: active.name } : undefined} />
              {rest.left == null && (
                <>
                  <button
                    className="btn flex-1 gap-1 rounded-2xl bg-sand px-2 py-2 text-sm text-cocoa"
                    onClick={addOne}
                    disabled={busy}
                  >
                    <Plus size={16} /> Satz
                  </button>
                  {nextExId || remainingPlanIds[0] ? (
                    <button
                      className="btn-primary min-w-0 flex-1 gap-0.5 rounded-2xl px-2 py-2 text-sm"
                      onClick={() =>
                        nextExId ? setExerciseId(nextExId) : addExerciseToday(remainingPlanIds[0])
                      }
                    >
                      Nächste <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button className="btn-primary flex-1 gap-1 rounded-2xl px-2 py-2 text-sm" onClick={() => setSheet('finish')}>
                      <Check size={16} strokeWidth={3} /> Fertig
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- Sheets ---- */}
        {sheet === 'menu' && active && (
          <PremiumSheet
            title={active.name}
            subtitle={[active.muscle_group, pair ? 'Supersatz' : null].filter(Boolean).join(' · ')}
            onClose={() => setSheet(null)}
            bodyClassName="space-y-3"
          >
            {active.notes && (
              <p className="rounded-2xl bg-sand px-3.5 py-2.5 text-sm leading-snug text-cocoa">{active.notes}</p>
            )}
            <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream [&>button]:flex [&>button]:min-h-[3.25rem] [&>button]:w-full [&>button]:items-center [&>button]:gap-3 [&>button]:px-4 [&>button]:py-2.5 [&>button]:text-left [&>button]:text-[15px] [&>button]:font-semibold [&>button]:transition-colors [&>button:active]:bg-sand-light">
              {pair ? (
                <button
                  onClick={() => {
                    unpair(active.id)
                    setSheet(null)
                  }}
                >
                  <MenuIcon>
                    <Unlink size={17} />
                  </MenuIcon>
                  Supersatz lösen
                </button>
              ) : (
                <button onClick={() => setSheet('pair')}>
                  <MenuIcon>
                    <Link2 size={17} />
                  </MenuIcon>
                  <span className="flex-1">Als Supersatz kombinieren …</span>
                  <ChevronRight size={16} className="text-cocoa-muted" />
                </button>
              )}
              <button onClick={() => setSheet('alts')}>
                <MenuIcon>
                  <RefreshCw size={17} />
                </MenuIcon>
                <span className="flex-1">Gerät besetzt? Alternative</span>
                <ChevronRight size={16} className="text-cocoa-muted" />
              </button>
              <button
                onClick={() => {
                  addOne()
                  setSheet(null)
                }}
              >
                <MenuIcon>
                  <Plus size={17} />
                </MenuIcon>
                Satz hinzufügen
              </button>
              {activeSets.length > 0 && (
                <button
                  className="text-red-500 dark:text-red-400"
                  onClick={() => {
                    if (!confirm(`„${active.name}" aus dem heutigen Training entfernen?`)) return
                    removeExerciseToday(active.id)
                  }}
                >
                  <MenuIcon danger>
                    <Trash2 size={17} />
                  </MenuIcon>
                  Aus heutigem Training entfernen
                </button>
              )}
            </div>
          </PremiumSheet>
        )}

        {(sheet === 'picker' || sheet === 'pair') && (
          <PremiumSheet
            title={sheet === 'pair' ? 'Supersatz-Partner wählen' : 'Übung hinzufügen'}
            subtitle={sheet === 'pair' && active ? `Zusammen mit ${active.name}` : undefined}
            onClose={() => {
              setSheet(null)
              setPickerQuery('')
            }}
            bodyClassName="space-y-4"
          >
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cocoa-muted" />
              <input
                className={`${BIG_INPUT} pl-10`}
                placeholder="Suchen (Name oder Muskel) …"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </div>
            {sheet === 'picker' && queuePlan && remainingPlanIds.length > 0 && !q && (
              <div>
                <SheetLabel>Als Nächstes aus „{queuePlan.name}"</SheetLabel>
                <div className="flex flex-wrap gap-2">
                  {remainingPlanIds.map((id) => (
                    <button
                      key={id}
                      className="flex items-center gap-1.5 rounded-full bg-cocoa px-3 py-1.5 text-sm font-semibold text-cream transition active:scale-95"
                      onClick={() => addExerciseToday(id)}
                    >
                      <Plus size={13} strokeWidth={2.5} /> {exById.get(id)?.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sheet === 'picker' && plans && plans.length > 0 && !q && (
              <div>
                <SheetLabel>{queuePlan ? 'Anderen Plan als Vorlage' : 'Plan als Vorlage'}</SheetLabel>
                <div className="flex flex-wrap gap-2">
                  {plans
                    .filter((p) => p.id !== queuePlan?.id)
                    .map((p) => (
                      <button
                        key={p.id}
                        className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-sm font-semibold text-cocoa transition active:scale-95"
                        onClick={() => loadPlanOrdered(p)}
                      >
                        <Play size={12} className="fill-brand text-brand" /> {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {sheet === 'picker' && (
              <button
                className="flex w-full items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left transition-colors active:bg-sand-light"
                onClick={() => {
                  setSheet(null)
                  setPickerQuery('')
                  setLibOpen(true)
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
                  <BookOpen size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Bibliothek</span>
                  <span className="block truncate text-xs text-cocoa-light">Neue Übung mit Animation & Ausführung</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
              </button>
            )}
            <div>
              {!q && sheet === 'picker' && <SheetLabel>Alle Übungen</SheetLabel>}
              <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
                {pickerList.map((e) => {
                  const inToday = todayExIds.includes(e.id)
                  return (
                    <li key={e.id}>
                      <button
                        className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors active:bg-sand-light"
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
                          <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                          <span className="block text-xs text-cocoa-light">{e.muscle_group}</span>
                        </span>
                        {inToday ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                            <Check size={12} strokeWidth={3} /> heute
                          </span>
                        ) : (
                          <Plus size={16} className="shrink-0 text-cocoa-muted" />
                        )}
                      </button>
                    </li>
                  )
                })}
                {pickerList.length === 0 && (
                  <li className="px-4 py-3 text-sm text-cocoa-light">
                    {sheet === 'picker' && q
                      ? 'Keine eigene Übung gefunden.'
                      : 'Keine Übung gefunden. Neue Übungen legst du im Tab „Übungen" an.'}
                  </li>
                )}
              </ul>
            </div>
            {sheet === 'picker' && q && (
              <LibraryResults
                query={pickerQuery}
                onPicked={(ex) => {
                  setSheet(null)
                  setPickerQuery('')
                  setLibAddId(ex.id)
                }}
              />
            )}
          </PremiumSheet>
        )}

        {libOpen && (
          <LibrarySheet
            onClose={() => setLibOpen(false)}
            onAdded={(ex) => {
              setLibOpen(false)
              setLibAddId(ex.id)
            }}
            existingAction={{
              label: 'Zum Training hinzufügen',
              run: (ex) => {
                setLibOpen(false)
                if (todayExIds.includes(ex.id)) setExerciseId(ex.id)
                else addExerciseToday(ex.id)
              },
            }}
          />
        )}

        {howToOpen && active && activeHowTo && (
          <PremiumSheet
            title={active.name}
            subtitle="Ausführung"
            onClose={() => setHowToOpen(false)}
            bodyClassName="space-y-3"
          >
            <ExerciseHowTo item={activeHowTo} />
          </PremiumSheet>
        )}

        {sheet === 'alts' && active && (
          <PremiumSheet
            title="Alternative Übung"
            subtitle={`Statt ${active.name} · ${active.muscle_group}`}
            onClose={() => {
              setSheet(null)
              setAltAi(null)
            }}
            bodyClassName="space-y-3"
          >
            {alternatives.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {alternatives.map((a) => (
                  <button
                    key={a.id}
                    className="rounded-full bg-sand px-3 py-1.5 text-sm font-semibold text-cocoa transition active:scale-95"
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
              <button
                className="btn w-full gap-2 rounded-2xl bg-sand py-3 text-cocoa"
                onClick={findAltAi}
                disabled={altBusy}
              >
                <Sparkles size={16} className="text-brand" />
                {altBusy ? 'Suche …' : 'Beste Alternative finden'}
              </button>
            )}
            {altAi &&
              (altAi.name ? (
                <button
                  className="anim-fade w-full rounded-2xl bg-brand/10 p-3.5 text-left text-sm"
                  onClick={() => {
                    const ex = exercises?.find((e) => e.name === altAi.name)
                    if (ex) addExerciseToday(ex.id)
                    setAltAi(null)
                  }}
                >
                  <span className="flex items-center gap-1 font-semibold text-cocoa">
                    <Sparkles size={14} className="text-brand" />
                    {altAi.name} <ChevronRight size={15} className="ml-auto text-cocoa-muted" />
                  </span>
                  <span className="mt-0.5 block text-cocoa-light">{altAi.reason}</span>
                </button>
              ) : (
                <p className="text-sm text-cocoa-light">{altAi.reason || 'Keine passende Alternative gefunden.'}</p>
              ))}
          </PremiumSheet>
        )}

        {sheet === 'finish' && (
          <PremiumSheet
            title="Training beenden"
            onClose={() => setSheet(null)}
            bodyClassName="space-y-4"
            hero={
              <SheetHero
                art={<MyBuddy size={120} mood={prName ? 'proud' : doneCount > 0 ? 'cheer' : 'happy'} />}
                title={doneCount > 0 ? 'Training geschafft!' : 'Training beenden?'}
                subtitle={
                  prName
                    ? 'Neuer Rekord – ich bin so stolz auf dich!'
                    : doneCount > 0
                      ? 'Geschafft! Das war richtig stark.'
                      : 'Noch kein Satz abgehakt – weiter geht’s?'
                }
              />
            }
            footer={
              <>
                <button className="btn-primary w-full gap-2 py-3.5 text-base shadow-lg shadow-brand/30" onClick={finishNew}>
                  <Check size={18} strokeWidth={3} />
                  Speichern & zum Verlauf
                </button>
                <button
                  className="w-full py-1.5 text-center text-sm font-semibold text-cocoa-light"
                  onClick={() => setSheet(null)}
                >
                  Weiter trainieren
                </button>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [minutes > 0 && minutes < 300 ? String(minutes) : '–', 'Minuten', Timer],
                  [String(doneCount), doneCount === 1 ? 'Satz' : 'Sätze', Check],
                  [Math.round(totalVolume(workoutSets ?? [])).toLocaleString('de-DE'), 'kg Volumen', Dumbbell],
                  [
                    String(
                      new Set(
                        (workoutSets ?? []).filter((s) => isSetDone(s, isUni(s.exercise_id))).map((s) => s.exercise_id),
                      ).size,
                    ),
                    'Übungen',
                    ListChecks,
                  ],
                ] as const
              ).map(([value, label, Icon]) => (
                <div key={label} className="rounded-2xl bg-cream px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
                    <Icon size={13} strokeWidth={2.5} className="text-brand" />
                    {label}
                  </div>
                  <div className="tabular mt-0.5 text-3xl font-bold tracking-tight text-cocoa">{value}</div>
                </div>
              ))}
            </div>

            {(todayPrs.length > 0 || prName) && (
              <div className="overflow-hidden rounded-2xl bg-gold/10 ring-1 ring-gold/30">
                <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gold">
                  <Trophy size={14} strokeWidth={2.5} />
                  {todayPrs.length > 1 ? `${todayPrs.length} neue Rekorde` : 'Neuer Rekord'}
                </div>
                <ul className="divide-y divide-gold/15">
                  {(todayPrs.length ? todayPrs : [{ id: 'pr', name: prName ?? '', e1: 0, gain: 0 }]).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0 truncate font-semibold text-cocoa">{p.name}</span>
                      {p.e1 > 0 && (
                        <span className="tabular shrink-0 text-sm font-bold text-gold">
                          ~{Math.round(p.e1)} kg
                          <span className="ml-1 text-xs font-semibold opacity-70">+{Math.max(1, Math.round(p.gain))}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="px-4 pb-3 text-[11px] text-cocoa-light">Geschätztes Maximum (1RM)</p>
              </div>
            )}

            {openSets.length > 0 && (
              <button
                className="flex w-full items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left text-sm font-medium"
                onClick={() => setDropOpenSets((v) => !v)}
                role="checkbox"
                aria-checked={dropOpenSets}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors ${
                    dropOpenSets ? 'bg-cocoa text-cream' : 'bg-sand ring-1 ring-sand-dark'
                  }`}
                >
                  {dropOpenSets && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="tabular">{openSets.length} nicht abgehakte Sätze entfernen</span>
              </button>
            )}
            {hype && (
              <p className="anim-fade rounded-2xl bg-brand/10 px-4 py-3 text-center text-sm font-semibold text-cocoa">
                {hype}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {ai?.enabled && (
                <button
                  className="btn gap-1.5 rounded-2xl bg-sand py-3 text-sm text-cocoa"
                  onClick={makeHype}
                  disabled={hypeBusy}
                >
                  <Flame size={16} className="text-brand" /> {hypeBusy ? '…' : 'Spruch'}
                </button>
              )}
              <button
                className={`btn gap-1.5 rounded-2xl bg-sand py-3 text-sm text-cocoa ${ai?.enabled ? '' : 'col-span-2'}`}
                onClick={shareToday}
              >
                <Share2 size={16} /> Teilen
              </button>
            </div>
          </PremiumSheet>
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
          <button className="btn-primary w-full" onClick={() => guarded(startWorkout)} disabled={busy}>
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
            {new Date(today + 'T00:00:00').toLocaleDateString('de-DE', {
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
              onClick={() => guarded(() => loadPlan(activePlan))}
              disabled={busy}
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
                    {new Date(lastSession.date + 'T00:00:00').toLocaleDateString('de-DE')}):{' '}
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
                <button className="btn-primary w-full" onClick={addTemplate} disabled={busy}>
                  Standard-Sätze anlegen
                </button>
                <p className="text-center text-xs text-cocoa-muted">
                  {willWarmup
                    ? '1 Aufwärmen · 2 Arbeitssätze · 1 Dropsatz'
                    : '2 Arbeitssätze · 1 Dropsatz (Muskel schon warm → kein Aufwärmsatz)'}{' '}
                  — danach nur noch Gewicht/Wdh anpassen
                </p>
                <button className="btn-ghost w-full" onClick={addOne} disabled={busy}>
                  + Einzelnen Satz
                </button>
              </div>
            ) : (
              <button className="btn-ghost w-full" onClick={addOne} disabled={busy}>
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
            <p className="mt-3 rounded-lg bg-ruby/10 p-2 text-center text-sm font-semibold text-ruby dark:text-ruby-light">
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
