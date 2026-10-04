import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { useLibrary } from '../components/library/useLibrary'
import { QuickSetup, type QuickSettings } from '../components/quick/QuickSetup'
import { QuickPreview } from '../components/quick/QuickPreview'
import { QuickPlayer, type QuickResult } from '../components/quick/QuickPlayer'
import { QuickFinish } from '../components/quick/QuickFinish'
import { unlockAudio } from '../components/quick/cues'
import { enter } from '../components/exercises/muscle'
import {
  EQUIPMENT_OPTIONS,
  FOCUS_OPTIONS,
  INTENSITY_OPTIONS,
  QUICK_MINUTES,
  QUICK_PRESETS,
  generateQuickWorkout,
  newSeed,
  replaceStation,
  type QuickPreset,
  type QuickWorkout as Workout,
} from '../lib/quickWorkout'

const SETTINGS_KEY = 'quick_settings'

const DEFAULTS: QuickSettings = { minutes: 15, equipment: ['none'], focus: 'full', intensity: 'normal' }

/** Zuletzt gewählte Einstellungen (nur Komfort, darf fehlen/kaputt sein). */
function loadSettings(): QuickSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<QuickSettings> | null
    if (!raw) return DEFAULTS
    return {
      minutes: (QUICK_MINUTES as readonly number[]).includes(raw.minutes ?? 0) ? raw.minutes! : DEFAULTS.minutes,
      equipment: Array.isArray(raw.equipment)
        ? raw.equipment.filter((e) => EQUIPMENT_OPTIONS.some((o) => o.id === e))
        : DEFAULTS.equipment,
      focus: FOCUS_OPTIONS.some((o) => o.id === raw.focus) ? raw.focus! : DEFAULTS.focus,
      intensity: INTENSITY_OPTIONS.some((o) => o.id === raw.intensity) ? raw.intensity! : DEFAULTS.intensity,
    }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(s: QuickSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

type Phase = 'setup' | 'preview' | 'play' | 'done'

/** Schnell-Workouts: Einstellungen → Vorschau → Intervall-Player → Abschluss. */
export default function QuickWorkout() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { list, error, loading, retry } = useLibrary()
  const byId = useMemo(() => new Map((list ?? []).map((e) => [e.id, e])), [list])

  const [settings, setSettings] = useState<QuickSettings>(() => {
    const s = loadSettings()
    return s.equipment.length ? s : { ...s, equipment: ['none'] }
  })
  const [phase, setPhase] = useState<Phase>('setup')
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [result, setResult] = useState<QuickResult | null>(null)

  function build(cfg: QuickSettings) {
    if (!list) return
    setWorkout(generateQuickWorkout(list, { ...cfg, seed: newSeed() }))
    setPhase('preview')
  }

  function create() {
    saveSettings(settings)
    build(settings)
  }

  function startPreset(p: QuickPreset) {
    build(p.config)
  }

  // Direkteinstieg per ?preset=… (z. B. von einer Karte auf dem Start-Screen)
  const presetHandled = useRef(false)
  useEffect(() => {
    const id = params.get('preset')
    if (!id || !list || presetHandled.current) return
    presetHandled.current = true
    const p = QUICK_PRESETS.find((x) => x.id === id)
    if (p) build(p.config)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, list])

  function shuffle() {
    if (!list || !workout) return
    setWorkout(generateQuickWorkout(list, { ...workout.config, seed: newSeed() }))
  }

  function start() {
    unlockAudio() // im Tipp entsperren, sonst bleibt iOS stumm
    setResult(null)
    setPhase('play')
  }

  function finish(r: QuickResult) {
    setResult(r)
    setPhase('done')
  }

  if (phase === 'done' && workout && result && list) {
    return (
      <QuickFinish
        workout={workout}
        result={result}
        list={list}
        onAgain={() => {
          setResult(null)
          setWorkout(null)
          setPhase('setup')
        }}
        onDone={() => navigate('/')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-2" style={enter(0)}>
        <button
          type="button"
          onClick={() => (phase === 'preview' ? setPhase('setup') : navigate(-1))}
          className="-ml-1 mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
          aria-label="Zurück"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Schnell-Workout</h1>
          <p className="text-sm text-cocoa-light">
            {phase === 'preview' ? 'Dein Zirkel ist bereit.' : 'Keine Zeit? Kein Problem.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="space-y-2 rounded-2xl bg-cream p-3 text-sm">
          <p className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
            <TriangleAlert size={16} className="shrink-0" /> {error}
          </p>
          <button className="btn-ghost w-full" onClick={retry}>
            Erneut versuchen
          </button>
        </div>
      )}

      {phase === 'setup' || !workout || !list ? (
        <QuickSetup
          value={settings}
          onChange={setSettings}
          onCreate={create}
          onPreset={startPreset}
          disabled={loading || !list}
        />
      ) : (
        <QuickPreview
          workout={workout}
          list={list}
          byId={byId}
          onShuffle={shuffle}
          onSwap={(i, id) => setWorkout((w) => (w ? replaceStation(w, i, id) : w))}
          onStart={start}
          onBack={() => setPhase('setup')}
        />
      )}

      {phase === 'play' && workout && list && <QuickPlayer workout={workout} byId={byId} onFinish={finish} />}
    </div>
  )
}
