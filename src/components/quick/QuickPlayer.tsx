import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { Ring } from '../nutrition-home/Ring'
import { ExerciseAnimation } from '../library/ExerciseAnimation'
import { Sheet } from '../workout/Sheet'
import type { LibraryExercise } from '../../lib/exerciseLibrary'
import type { Interval, QuickWorkout } from '../../lib/quickWorkout'
import {
  countBeep,
  finishBeep,
  phaseBeep,
  setVoiceEnabled,
  speak,
  speechAvailable,
  stopSpeaking,
  unlockAudio,
  useWakeLock,
  voiceEnabled,
} from './cues'

export interface QuickResult {
  /** Tatsächlich trainierte Zeit (inkl. Pausen, ohne angehaltene Zeit), Sekunden. */
  activeSeconds: number
  /** Je absolvierter Arbeitsphase ein Eintrag. */
  work: { exerciseId: string; seconds: number; round: number }[]
  rounds: number
  completed: boolean
}

/** Teilweise absolvierte Arbeitsphasen zählen ab dieser Dauer. */
const MIN_PARTIAL_S = 10

const PHASE_LABEL: Record<Interval['kind'], string> = {
  warmup: 'Aufwärmen',
  work: 'Los!',
  rest: 'Pause',
  roundRest: 'Rundenpause',
}

interface Clock {
  idx: number
  /** Endzeit der laufenden Phase (ms) — null, solange pausiert. */
  endAt: number | null
  /** Restzeit beim Anhalten (ms). */
  pausedMs: number | null
  active: number
  work: QuickResult['work']
  lastCount: string
}

/**
 * Vollbild-Intervall-Player. Zeit läuft über Endzeitpunkte (wie der Pausentimer):
 * war der Tab kurz im Hintergrund, holt der nächste Tick verpasste Phasen nach.
 */
export function QuickPlayer({
  workout,
  byId,
  onFinish,
}: {
  workout: QuickWorkout
  byId: Map<string, LibraryExercise>
  onFinish: (r: QuickResult) => void
}) {
  const intervals = workout.intervals
  const clock = useRef<Clock>({
    idx: 0,
    endAt: Date.now() + intervals[0].seconds * 1000,
    pausedMs: null,
    active: 0,
    work: [],
    lastCount: '',
  })
  const [, setRender] = useState(0)
  const rerender = useCallback(() => setRender((n) => n + 1), [])
  const [voice, setVoice] = useState(voiceEnabled)
  const [confirmEnd, setConfirmEnd] = useState(false)
  /** Lief der Timer, bevor „Beenden?" gefragt wurde? Dann beim Abbrechen weiterlaufen lassen. */
  const resumeAfterConfirm = useRef(false)
  const finished = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const c = clock.current
  const paused = c.endAt == null
  useWakeLock(!paused)

  const nameOf = (id?: string) => (id ? byId.get(id)?.name_de ?? 'Übung' : '')

  // ---- Ansagen beim Betreten einer Phase ----
  const announce = useCallback(
    (i: number) => {
      const it = intervals[i]
      const prev = intervals[i - 1]
      const nextWork = intervals.slice(i + 1).find((x) => x.kind === 'work')
      if (it.kind === 'work') {
        phaseBeep('work')
        speak(prev && prev.kind !== 'warmup' && workout.rest > 0 ? 'Los!' : `Los! ${nameOf(it.exerciseId)}`)
      } else if (it.kind === 'warmup') {
        phaseBeep('work')
        speak(`Aufwärmen: ${nameOf(it.exerciseId)}`)
      } else {
        phaseBeep('rest')
        const next = nextWork ? `Nächste Übung: ${nameOf(nextWork.exerciseId)}` : ''
        speak(it.kind === 'roundRest' ? `Runde geschafft. Pause. ${next}` : `Pause. ${next}`)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intervals, workout.rest, byId],
  )

  const finish = useCallback(
    (completed: boolean) => {
      if (finished.current) return
      finished.current = true
      const s = clock.current
      s.endAt = null
      if (completed) {
        finishBeep()
        speak('Geschafft! Stark gemacht.')
      } else stopSpeaking()
      const rounds = s.work.reduce((m, w) => Math.max(m, w.round), 0)
      finishRef.current({ activeSeconds: Math.round(s.active), work: s.work, rounds, completed })
    },
    [],
  )

  /** Teil der laufenden Phase verbuchen (beim Überspringen/Beenden/Zurück). */
  const bookPartial = useCallback(() => {
    const s = clock.current
    const it = intervals[s.idx]
    const leftMs = s.endAt != null ? s.endAt - Date.now() : s.pausedMs ?? 0
    const done = Math.max(0, Math.min(it.seconds, it.seconds - leftMs / 1000))
    s.active += done
    if (it.kind === 'work' && it.exerciseId && done >= MIN_PARTIAL_S) {
      s.work.push({ exerciseId: it.exerciseId, seconds: Math.round(done), round: it.round })
    }
  }, [intervals])

  /** In Phase `i` springen (volle Länge). */
  const goTo = useCallback(
    (i: number) => {
      const s = clock.current
      s.idx = i
      const ms = intervals[i].seconds * 1000
      if (s.endAt != null) s.endAt = Date.now() + ms
      else s.pausedMs = ms
      s.lastCount = ''
      if (s.endAt != null) announce(i)
      rerender()
    },
    [intervals, announce, rerender],
  )

  // ---- Takt ----
  useEffect(() => {
    const tick = () => {
      const s = clock.current
      if (s.endAt == null || finished.current) return
      const now = Date.now()
      let advanced = false
      // Verpasste Phasen nachholen (Tab war im Hintergrund)
      while (s.endAt != null && now >= s.endAt) {
        const it = intervals[s.idx]
        s.active += it.seconds
        if (it.kind === 'work' && it.exerciseId) {
          s.work.push({ exerciseId: it.exerciseId, seconds: it.seconds, round: it.round })
        }
        if (s.idx >= intervals.length - 1) {
          finish(true)
          rerender()
          return
        }
        s.idx += 1
        s.endAt += intervals[s.idx].seconds * 1000
        s.lastCount = ''
        advanced = true
      }
      if (advanced) announce(s.idx)
      const left = Math.ceil((s.endAt! - now) / 1000)
      const key = `${s.idx}:${left}`
      if (left >= 1 && left <= 3 && s.lastCount !== key && !advanced) {
        s.lastCount = key
        countBeep()
      }
      rerender()
    }
    const id = window.setInterval(tick, 200)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervals, announce, finish, rerender])

  // Erste Phase ansagen; beim Verlassen Sprachausgabe stoppen.
  useEffect(() => {
    unlockAudio()
    announce(0)
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Steuerung ----
  function togglePause() {
    const s = clock.current
    unlockAudio()
    if (s.endAt != null) {
      s.pausedMs = Math.max(0, s.endAt - Date.now())
      s.endAt = null
      stopSpeaking()
    } else {
      s.endAt = Date.now() + (s.pausedMs ?? intervals[s.idx].seconds * 1000)
      s.pausedMs = null
    }
    rerender()
  }

  function skip() {
    bookPartial()
    const s = clock.current
    if (s.idx >= intervals.length - 1) finish(true)
    else goTo(s.idx + 1)
  }

  function back() {
    const s = clock.current
    const it = intervals[s.idx]
    const leftMs = s.endAt != null ? s.endAt - Date.now() : s.pausedMs ?? 0
    const elapsed = it.seconds - leftMs / 1000
    // Zurück = Phase neu starten; ganz am Anfang einer Phase → vorherige Phase.
    s.active += Math.max(0, elapsed)
    goTo(elapsed > 3 || s.idx === 0 ? s.idx : s.idx - 1)
  }

  function end() {
    bookPartial()
    finish(false)
  }

  function cancelEnd() {
    setConfirmEnd(false)
    if (resumeAfterConfirm.current && clock.current.endAt == null) togglePause()
  }

  function toggleVoice() {
    const next = !voice
    setVoice(next)
    setVoiceEnabled(next)
  }

  // ---- Anzeige ----
  const it = intervals[c.idx]
  const now = Date.now()
  const leftMs = c.endAt != null ? Math.max(0, c.endAt - now) : c.pausedMs ?? 0
  const left = Math.ceil(leftMs / 1000)
  const isRest = it.kind === 'rest' || it.kind === 'roundRest'
  const nextWork = intervals.slice(c.idx + 1).find((x) => x.kind === 'work')
  // In der Pause zeigt die große Animation die kommende Übung.
  const focusId = isRest ? nextWork?.exerciseId : it.exerciseId
  const focusEx = focusId ? byId.get(focusId) : undefined
  const previewId = isRest
    ? intervals.slice(c.idx + 1).filter((x) => x.kind === 'work')[1]?.exerciseId
    : nextWork?.exerciseId
  const doneMs =
    intervals.slice(0, c.idx).reduce((sum, x) => sum + x.seconds * 1000, 0) + (it.seconds * 1000 - leftMs)
  const overall = Math.min(1, doneMs / Math.max(1, workout.totalSeconds * 1000))
  const stationCount = workout.stations.length

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex flex-col bg-bg text-cocoa"
      role="dialog"
      aria-modal="true"
      aria-label="Schnell-Workout läuft"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {/* Kopfzeile */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resumeAfterConfirm.current = !paused
              if (!paused) togglePause()
              setConfirmEnd(true)
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
            aria-label="Workout beenden"
          >
            <X size={18} />
          </button>
          <p className="tabular min-w-0 flex-1 truncate text-center text-sm font-semibold text-cocoa-light">
            {it.kind === 'warmup'
              ? 'Aufwärmen'
              : `Runde ${it.round}/${workout.rounds} · Übung ${Math.min(it.station + 1, stationCount)}/${stationCount}`}
          </p>
          {speechAvailable() ? (
            <button
              type="button"
              onClick={toggleVoice}
              className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
              aria-label={voice ? 'Sprachansage aus' : 'Sprachansage an'}
              aria-pressed={voice}
            >
              {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </div>

        {/* Gesamtfortschritt */}
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(overall * 100)}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-linear" style={{ width: `${overall * 100}%` }} />
        </div>

        {/* Countdown */}
        <div className="mt-4 flex justify-center">
          <Ring
            key={c.idx}
            size={188}
            stroke={14}
            progress={leftMs / (it.seconds * 1000)}
            barClass={isRest ? 'stroke-success' : 'stroke-brand'}
            trackClass="stroke-sand-dark/40"
            transition={false}
          >
            <div className="text-center">
              <span
                className={`block text-xs font-bold uppercase tracking-wider ${isRest ? 'text-success' : 'text-brand'}`}
              >
                {paused ? 'Pausiert' : PHASE_LABEL[it.kind]}
              </span>
              <span className={`tabular block text-6xl font-bold leading-none ${left <= 3 && !paused ? 'text-brand' : ''}`}>
                {left}
              </span>
              <span className="mt-1 block text-[11px] text-cocoa-muted">Sekunden</span>
            </div>
          </Ring>
        </div>

        {/* Übung */}
        <div className="mt-3 text-center">
          {isRest && <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Gleich</p>}
          <h2 className="truncate text-2xl font-bold tracking-tight">{focusEx?.name_de ?? 'Durchatmen'}</h2>
        </div>
        <div className="mt-3 flex min-h-0 flex-1 justify-center">
          {focusEx && (
            <ExerciseAnimation
              images={focusEx.images}
              alt={`Animation: ${focusEx.name_de}`}
              className={`aspect-[4/3] h-full max-h-60 max-w-full ${isRest ? 'opacity-70' : ''}`}
            />
          )}
        </div>

        {/* Als Nächstes */}
        <div className="mt-3 flex min-h-[3.25rem] items-center gap-3 rounded-2xl bg-cream px-3 py-2">
          {previewId ? (
            <>
              <ExerciseAnimation
                images={byId.get(previewId)?.images ?? []}
                alt=""
                still
                className="h-9 w-9 shrink-0 rounded-lg"
              />
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="text-cocoa-light">Als Nächstes: </span>
                <span className="font-semibold">{nameOf(previewId)}</span>
              </p>
            </>
          ) : (
            <p className="flex-1 text-center text-sm font-semibold text-cocoa-light">Letzte Übung – gib alles!</p>
          )}
        </div>

        {/* Steuerung */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={back}
            className="grid h-14 w-14 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
            aria-label="Zurück"
          >
            <SkipBack size={22} />
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="grid h-20 w-20 place-items-center rounded-full bg-brand text-on-brand shadow-lg shadow-brand/30 transition active:scale-95"
            aria-label={paused ? 'Weiter' : 'Pause'}
          >
            {paused ? <Play size={32} fill="currentColor" /> : <Pause size={32} fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={skip}
            className="grid h-14 w-14 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
            aria-label="Überspringen"
          >
            <SkipForward size={22} />
          </button>
        </div>
      </div>

      {confirmEnd && (
        <Sheet title="Workout beenden?" onClose={cancelEnd}>
          <div className="space-y-2">
            <p className="text-sm text-cocoa-light">
              Was du bisher geschafft hast, kannst du im Anschluss speichern.
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                setConfirmEnd(false)
                end()
              }}
            >
              Beenden &amp; auswerten
            </button>
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={cancelEnd}
            >
              Weiter trainieren
            </button>
          </div>
        </Sheet>
      )}
    </div>,
    document.body,
  )
}
