import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings2, Timer, X } from 'lucide-react'
import { Sheet } from './Sheet'
import {
  getExerciseRest,
  getRestMode,
  getRestSeconds,
  setExerciseRest,
  setRestMode,
  setRestSeconds,
  type RestMode,
} from '../../lib/workoutSession'

const PRESETS = [60, 90, 120, 180]

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    /* kein Ton – egal */
  }
  try {
    navigator.vibrate?.([200, 80, 200])
  } catch {
    /* keine Vibration – egal */
  }
}

export interface RestTimer {
  left: number | null
  /** Eingestellte Standardpause */
  total: number
  /** Länge der gerade laufenden Pause (für den Balken) */
  running: number
  mode: RestMode
  start: (sec?: number) => void
  stop: () => void
  add: (delta: number) => void
  setTotal: (sec: number) => void
  setMode: (m: RestMode) => void
}

/** Pausentimer auf Basis einer Endzeit (bleibt korrekt, auch wenn das Handy kurz schläft). */
export function useRestTimer(): RestTimer {
  const [total, setTotalState] = useState(getRestSeconds)
  const [mode, setModeState] = useState<RestMode>(getRestMode)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [running, setRunning] = useState(total)
  const [left, setLeft] = useState<number | null>(null)
  const beeped = useRef(false)

  useEffect(() => {
    if (endAt == null) {
      setLeft(null)
      return
    }
    beeped.current = false
    // „Los!" kurz stehen lassen, dann ausblenden — aber nur, wenn inzwischen keine
    // neue Pause gestartet wurde (Timeout wird beim Wechsel von endAt verworfen).
    let hide: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const l = Math.ceil((endAt - Date.now()) / 1000)
      setLeft(l)
      if (l <= 0 && !beeped.current) {
        beeped.current = true
        beep()
        hide = setTimeout(() => setEndAt((cur) => (cur === endAt ? null : cur)), 1200)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => {
      clearInterval(id)
      if (hide) clearTimeout(hide)
    }
  }, [endAt])

  const start = useCallback(
    (sec?: number) => {
      const d = sec ?? total
      setRunning(d)
      setEndAt(Date.now() + d * 1000)
    },
    [total],
  )
  const stop = useCallback(() => setEndAt(null), [])
  const add = useCallback(
    (delta: number) => setEndAt((e) => (e == null ? e : Math.max(Date.now(), e + delta * 1000))),
    [],
  )
  const setTotal = useCallback((sec: number) => {
    setTotalState(sec)
    setRestSeconds(sec)
  }, [])
  const setMode = useCallback((m: RestMode) => {
    setModeState(m)
    setRestMode(m)
  }, [])

  return { left, total, running, mode, start, stop, add, setTotal, setMode }
}

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

/** Timer-Steuerung für die Aktionsleiste (läuft → Countdown, sonst Start-Button). */
export function RestControl({
  timer,
  exercise,
}: {
  timer: RestTimer
  /** Aktive Übung — für eine eigene Pausenlänge pro Übung */
  exercise?: { id: string; name: string }
}) {
  const [settings, setSettings] = useState(false)
  const [exRest, setExRestState] = useState<number | null>(null)
  useEffect(() => {
    setExRestState(exercise ? getExerciseRest(exercise.id) : null)
  }, [exercise?.id])
  const base = exRest ?? timer.total

  if (timer.left != null) {
    const pct = Math.max(0, Math.min(100, (timer.left / Math.max(1, timer.running)) * 100))
    return (
      <div className="anim-fade relative flex flex-1 items-center gap-1.5 overflow-hidden rounded-xl bg-sand px-2.5 py-1.5 text-cocoa">
        {/* Restzeit als dezent schrumpfender Balken */}
        <div
          className="absolute inset-y-0 left-0 bg-brand/15 transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%` }}
        />
        <Timer size={16} className="relative text-brand" />
        <span className="tabular relative w-12 text-lg font-bold">
          {timer.left <= 0 ? 'Los!' : mmss(timer.left)}
        </span>
        <button
          className="tabular relative rounded-full bg-sand-light px-2 py-0.5 text-xs font-semibold"
          onClick={() => timer.add(-15)}
        >
          −15
        </button>
        <button
          className="tabular relative rounded-full bg-sand-light px-2 py-0.5 text-xs font-semibold"
          onClick={() => timer.add(15)}
        >
          +15
        </button>
        <button
          className="relative ml-auto grid h-7 w-7 place-items-center rounded-full bg-sand-light"
          onClick={timer.stop}
          aria-label="Pause beenden"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-xl bg-sand">
        <button
          className="tabular flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-cocoa"
          onClick={() => timer.start(base)}
          aria-label="Pause starten"
        >
          <Timer size={16} className="text-cocoa-light" />
          {mmss(base)}
        </button>
        <button
          className="grid place-items-center border-l border-sand-dark/60 px-2 text-cocoa-light"
          onClick={() => setSettings(true)}
          aria-label="Timer-Einstellungen"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {settings && (
        <Sheet title="Pausentimer" onClose={() => setSettings(false)}>
          <div>
            <div className="label">Dauer</div>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => timer.setTotal(p)}
                  className={`btn py-2 text-sm ${
                    timer.total === p ? 'bg-brand text-on-brand' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                  }`}
                >
                  {mmss(p)}
                </button>
              ))}
            </div>
          </div>
          {exercise && (
            <div>
              <div className="label">Nur für {exercise.name}</div>
              <div className="grid grid-cols-4 gap-2">
                {[null, 90, 120, 180].map((p) => (
                  <button
                    key={p ?? 'std'}
                    onClick={() => {
                      setExerciseRest(exercise.id, p)
                      setExRestState(p)
                    }}
                    className={`btn py-2 text-sm ${
                      exRest === p ? 'bg-brand text-on-brand' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                    }`}
                  >
                    {p == null ? 'Standard' : mmss(p)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-cocoa-light">
                Schwere Grundübungen (Kniebeuge, Bankdrücken, Kreuzheben) brauchen 2–3 Min, Isolationsübungen
                (Curls, Seitheben) meist 60–90 s.
              </p>
            </div>
          )}
          <div>
            <div className="label">Automatisch starten</div>
            <div className="grid grid-cols-2 gap-2">
              {(['auto', 'off'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => timer.setMode(m)}
                  className={`btn py-2 text-sm ${
                    timer.mode === m ? 'bg-brand text-on-brand' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                  }`}
                >
                  {m === 'auto' ? 'Nach Satz' : 'Nur manuell'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-cocoa-light">
              „Nach Satz" startet beim Abhaken ✓. Bei <strong>Supersätzen</strong> erst, wenn die
              Runde aus beiden Übungen erledigt ist — dazwischen springt die App direkt zur
              Partner-Übung. Vor einem <strong>Dropsatz</strong> gibt es keine Pause, nach dem{' '}
              <strong>Aufwärmen</strong> nur eine kurze (45–90 s).
            </p>
          </div>
        </Sheet>
      )}
    </>
  )
}
