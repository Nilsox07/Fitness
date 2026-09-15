import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface RestTimerHandle {
  start: (seconds?: number) => void
  autoEnabled: () => boolean
}

const PRESETS = [60, 90, 120, 180]

function getNum(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
    /* Ton nicht verfügbar – egal */
  }
  try {
    navigator.vibrate?.([200, 80, 200])
  } catch {
    /* keine Vibration – egal */
  }
}

/** Pausentimer als schwebende Pille über der Tab-Leiste. Auto-Start & Dauer per localStorage. */
export const RestTimer = forwardRef<RestTimerHandle>(function RestTimer(_props, ref) {
  const [total, setTotal] = useState(() => getNum('rest_seconds', 120))
  const [left, setLeft] = useState<number | null>(null)
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem('rest_auto') !== '0'
    } catch {
      return true
    }
  })
  const [showSettings, setShowSettings] = useState(false)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useImperativeHandle(ref, () => ({
    start: (seconds?: number) => setLeft(seconds ?? getNum('rest_seconds', 120)),
    autoEnabled: () => {
      try {
        return localStorage.getItem('rest_auto') !== '0'
      } catch {
        return true
      }
    },
  }))

  useEffect(() => {
    if (left == null) return
    if (left <= 0) {
      beep()
      const t = setTimeout(() => setLeft(null), 900)
      return () => clearTimeout(t)
    }
    tick.current = setInterval(() => setLeft((l) => (l == null ? l : l - 1)), 1000)
    return () => {
      if (tick.current) clearInterval(tick.current)
    }
  }, [left])

  function setDuration(sec: number) {
    setTotal(sec)
    try {
      localStorage.setItem('rest_seconds', String(sec))
    } catch {
      /* ignore */
    }
  }
  function toggleAuto() {
    setAuto((a) => {
      const next = !a
      try {
        localStorage.setItem('rest_auto', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const mmss =
    left == null
      ? ''
      : `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, '0')}`

  return (
    <>
      {left != null && (
        <div className="fixed inset-x-0 bottom-[76px] z-20 mx-auto flex max-w-md items-center gap-2 px-4">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-cocoa px-3 py-2 text-cream shadow-lg dark:bg-sand-light dark:text-cocoa">
            <span className="text-lg">⏱️</span>
            <span className="w-14 text-xl font-bold tabular-nums">{left <= 0 ? 'Los!' : mmss}</span>
            <button className="rounded-full bg-white/15 px-2 py-1 text-sm" onClick={() => setLeft((l) => (l ?? 0) + 15)}>
              +15
            </button>
            <button className="rounded-full bg-white/15 px-2 py-1 text-sm" onClick={() => setLeft((l) => Math.max(0, (l ?? 0) - 15))}>
              −15
            </button>
            <button className="ml-auto rounded-full bg-white/25 px-3 py-1 text-sm font-semibold" onClick={() => setLeft(null)}>
              Überspringen
            </button>
          </div>
        </div>
      )}

      {/* kleine Steuerung, immer sichtbar unten rechts, wenn kein Timer läuft */}
      {left == null && (
        <div className="fixed bottom-[76px] right-3 z-20">
          {showSettings && (
            <div className="mb-2 space-y-2 rounded-xl bg-cream p-3 text-sm shadow-lg ring-1 ring-sand-dark dark:bg-cocoa/95">
              <div className="flex gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDuration(p)}
                    className={`rounded-full px-2 py-1 text-xs ${
                      total === p ? 'bg-brand text-white' : 'bg-sand-light text-cocoa'
                    }`}
                  >
                    {p}s
                  </button>
                ))}
              </div>
              <button onClick={toggleAuto} className="flex w-full items-center justify-between gap-2">
                <span>Auto-Start nach Satz</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${auto ? 'bg-brand text-white' : 'bg-sand-dark text-cocoa-light'}`}>
                  {auto ? 'an' : 'aus'}
                </span>
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="h-11 w-11 rounded-full bg-sand-light text-lg shadow ring-1 ring-sand-dark"
              aria-label="Timer-Einstellungen"
            >
              ⚙️
            </button>
            <button
              onClick={() => setLeft(total)}
              className="h-11 rounded-full bg-brand px-4 font-semibold text-white shadow"
            >
              ⏱️ Pause
            </button>
          </div>
        </div>
      )}
    </>
  )
})
