import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import {
  getRestMode,
  getRestSeconds,
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
  total: number
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
  const [left, setLeft] = useState<number | null>(null)
  const beeped = useRef(false)

  useEffect(() => {
    if (endAt == null) {
      setLeft(null)
      return
    }
    beeped.current = false
    const tick = () => {
      const l = Math.ceil((endAt - Date.now()) / 1000)
      setLeft(l)
      if (l <= 0 && !beeped.current) {
        beeped.current = true
        beep()
        setTimeout(() => setEndAt(null), 1200)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endAt])

  const start = useCallback((sec?: number) => setEndAt(Date.now() + (sec ?? total) * 1000), [total])
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

  return { left, total, mode, start, stop, add, setTotal, setMode }
}

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

/** Timer-Steuerung für die Aktionsleiste (läuft → Countdown, sonst Start-Button). */
export function RestControl({ timer }: { timer: RestTimer }) {
  const [settings, setSettings] = useState(false)

  if (timer.left != null) {
    const pct = Math.max(0, Math.min(100, (timer.left / timer.total) * 100))
    return (
      <div className="relative flex flex-1 items-center gap-1.5 overflow-hidden rounded-xl bg-cocoa px-2.5 py-1.5 text-cream dark:bg-sand-light dark:text-cocoa">
        <div
          className="absolute inset-y-0 left-0 bg-brand/40 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
        <span className="relative w-12 text-lg font-bold tabular-nums">
          {timer.left <= 0 ? 'Los!' : mmss(timer.left)}
        </span>
        <button className="relative rounded-full bg-white/15 px-2 py-0.5 text-xs" onClick={() => timer.add(-15)}>
          −15
        </button>
        <button className="relative rounded-full bg-white/15 px-2 py-0.5 text-xs" onClick={() => timer.add(15)}>
          +15
        </button>
        <button
          className="relative ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold"
          onClick={timer.stop}
          aria-label="Pause beenden"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-xl ring-1 ring-sand-dark">
        <button
          className="bg-sand-light px-3 py-2 text-sm font-semibold text-cocoa"
          onClick={() => timer.start()}
          aria-label="Pause starten"
        >
          ⏱ {mmss(timer.total)}
        </button>
        <button
          className="border-l border-sand-dark bg-sand-light px-2 text-sm text-cocoa-light"
          onClick={() => setSettings(true)}
          aria-label="Timer-Einstellungen"
        >
          ⚙
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
                    timer.total === p ? 'bg-brand text-white' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                  }`}
                >
                  {mmss(p)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Automatisch starten</div>
            <div className="grid grid-cols-2 gap-2">
              {(['auto', 'off'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => timer.setMode(m)}
                  className={`btn py-2 text-sm ${
                    timer.mode === m ? 'bg-brand text-white' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                  }`}
                >
                  {m === 'auto' ? 'Nach Satz' : 'Nur manuell'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-cocoa-light">
              „Nach Satz" startet beim Abhaken ✓. Bei <strong>Supersätzen</strong> erst, wenn die
              Runde aus beiden Übungen erledigt ist — dazwischen springt die App direkt zur
              Partner-Übung.
            </p>
          </div>
        </Sheet>
      )}
    </>
  )
}
