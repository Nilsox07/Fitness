import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Confetti } from '../Confetti'
import type { BuddyMood } from '../../lib/buddyMood'
import { MyBuddy } from './MyBuddy'
import { Buddy } from './Buddy'
import { useBuddyLook } from './useBuddy'

/**
 * Buddy-Momente — große, bildschirmfüllende Feiern für Schlüsselmomente
 * (Wochenziel, Buddy-Entwicklung, Level-up, Training abgeschlossen …).
 *
 * ## API (stabil)
 *
 * ```ts
 * import { showBuddyMoment } from '../components/buddy/BuddyMoment'
 *
 * showBuddyMoment({
 *   key: `workout-${workoutId}`,   // optional: einmalig pro Schlüssel (localStorage)
 *   mood: 'cheer',                  // optional, Standard 'cheer'
 *   title: 'Training geschafft!',
 *   subtitle: 'Push · 48 Min',      // optional
 *   chips: [{ value: '18', label: 'Sätze' }, '2 Rekorde'], // optional
 * })
 * ```
 *
 * - Ausgelöst wird per `window`-CustomEvent `buddy-moment` (`BUDDY_MOMENT_EVENT`);
 *   angezeigt vom `BuddyMomentHost`, der in `App.tsx` (neuer Modus) einmal gemountet ist.
 * - Mehrere Momente kurz hintereinander werden nacheinander gezeigt (Warteschlange).
 * - Mit `key` erscheint ein Moment höchstens einmal (gemerkt unter `buddy_moments_seen`).
 * - Rückgabe: `true`, wenn der Moment angenommen wurde; `false`, wenn der Schlüssel schon
 *   gezeigt wurde oder kein Host gemountet ist (z. B. klassischer Modus).
 * - Schließen per Tipp, „Weiter", Escape oder automatisch nach `autoDismissMs` (Standard 6 s).
 * - Konfetti (abschaltbar per `confetti: false`) entfällt bei „Bewegung reduzieren".
 */

export const BUDDY_MOMENT_EVENT = 'buddy-moment'

export interface BuddyMomentChip {
  value: string
  label: string
}

export interface BuddyMomentOptions {
  /** Einmal-Schlüssel, z. B. `goal-2026-W40`. Ohne Schlüssel: immer anzeigen. */
  key?: string
  /** Stimmung des großen Buddys (Standard: 'cheer'). */
  mood?: BuddyMood
  title: string
  subtitle?: string
  /** Kleine Kennzahlen-Chips: Text oder { value, label }. */
  chips?: (string | BuddyMomentChip)[]
  /** Wachstumsstufe überschreiben (Standard: eigene Stufe). */
  stage?: number
  /** Für „Buddy hat sich entwickelt": vorherige Stufe (zeigt alt → neu). */
  fromStage?: number
  /** Konfetti (Standard: true). */
  confetti?: boolean
  /** Automatisch schließen nach ms (Standard 6000; 0 = nie). */
  autoDismissMs?: number
  /** Beschriftung des Hauptknopfs (Standard: „Weiter"). */
  buttonLabel?: string
  /** Optionale Zweitaktion (z. B. „Teilen"); schließt den Moment danach. */
  action?: { label: string; onClick: () => void }
}

/** Event-Detail; `accepted` setzt der Host synchron. */
export interface BuddyMomentEventDetail {
  moment: BuddyMomentOptions
  accepted?: boolean
}

/** Zeigt einen großen Buddy-Moment. Siehe Dateikopf. */
export function showBuddyMoment(moment: BuddyMomentOptions): boolean {
  const detail: BuddyMomentEventDetail = { moment }
  try {
    window.dispatchEvent(new CustomEvent<BuddyMomentEventDetail>(BUDDY_MOMENT_EVENT, { detail }))
  } catch {
    return false
  }
  return detail.accepted === true
}

// ---------------------------------------------------------------------------
// Einmal-Speicher
// ---------------------------------------------------------------------------

const SEEN_KEY = 'buddy_moments_seen'
const SEEN_MAX = 80

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Wurde der Moment mit diesem Schlüssel schon gezeigt? */
export function hasSeenBuddyMoment(key: string): boolean {
  return readSeen().includes(key)
}

/** Merkt sich einen Schlüssel als gezeigt. */
export function markBuddyMomentSeen(key: string): void {
  try {
    const seen = readSeen().filter((k) => k !== key)
    seen.push(key)
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const STYLE = `
@keyframes bm-in{0%{opacity:0;transform:translateY(24px) scale(.92)}100%{opacity:1;transform:none}}
@keyframes bm-hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-16px)}60%{transform:translateY(0) scaleY(.96)}}
@keyframes bm-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.12)}}
@keyframes bm-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.bm-in{animation:bm-in .45s cubic-bezier(.2,.9,.3,1.2) both}
.bm-hop{animation:bm-hop 1.1s ease-in-out .35s infinite}
.bm-glow{animation:bm-glow 2.4s ease-in-out infinite}
.bm-bar{transform-origin:left;animation-name:bm-bar;animation-timing-function:linear;animation-fill-mode:both}
@media (prefers-reduced-motion:reduce){.bm-in,.bm-hop,.bm-glow{animation:none!important}.bm-bar{display:none}}
`

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Ein großer Buddy-Moment (Vollbild). Meist über `showBuddyMoment` + Host genutzt. */
export function BuddyMoment({ moment, onClose }: { moment: BuddyMomentOptions; onClose: () => void }) {
  const titleId = useId()
  const look = useBuddyLook()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const btnRef = useRef<HTMLButtonElement>(null)
  const [confetti, setConfetti] = useState(() => moment.confetti !== false && !prefersReducedMotion())
  const auto = moment.autoDismissMs ?? 6000
  const mood = moment.mood ?? 'cheer'
  const stage = moment.stage ?? look.stage
  const confettiDone = useCallback(() => setConfetti(false), [])

  useEffect(() => {
    btnRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    const t = auto > 0 ? window.setTimeout(() => closeRef.current(), auto) : undefined
    return () => {
      window.removeEventListener('keydown', onKey)
      if (t) window.clearTimeout(t)
    }
  }, [auto])

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/75 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center text-white backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => closeRef.current()}
    >
      <style>{STYLE}</style>
      {confetti && <Confetti show onDone={confettiDone} />}

      <div className="bm-in relative flex w-full max-w-sm flex-col items-center">
        <div className="relative flex items-end justify-center gap-3">
          <div
            className="bm-glow pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/40 blur-3xl"
            aria-hidden
          />
          {moment.fromStage != null && (
            <>
              <Buddy
                size={76}
                mood="happy"
                stage={moment.fromStage}
                skin={look.skin}
                animate={false}
                className="relative mb-6 opacity-60 grayscale-[40%]"
              />
              <ArrowRight size={22} className="relative mb-12 shrink-0 text-white/60" aria-hidden />
            </>
          )}
          <div className="bm-hop relative">
            {moment.stage != null ? (
              <Buddy size={moment.fromStage != null ? 160 : 180} mood={mood} stage={stage} skin={look.skin} />
            ) : (
              <MyBuddy size={moment.fromStage != null ? 160 : 180} mood={mood} />
            )}
          </div>
        </div>

        <h2 id={titleId} className="relative mt-4 text-3xl font-bold leading-tight tracking-tight">
          {moment.title}
        </h2>
        {moment.subtitle && <p className="relative mt-2 text-base text-white/75">{moment.subtitle}</p>}

        {moment.chips && moment.chips.length > 0 && (
          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            {moment.chips.map((c, i) =>
              typeof c === 'string' ? (
                <span key={i} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold ring-1 ring-white/15">
                  {c}
                </span>
              ) : (
                <span
                  key={i}
                  className="flex min-w-[4.5rem] flex-col items-center rounded-2xl bg-white/10 px-3.5 py-2 ring-1 ring-white/15"
                >
                  <span className="tabular text-lg font-bold leading-tight">{c.value}</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/60">{c.label}</span>
                </span>
              ),
            )}
          </div>
        )}

        <div className="relative mt-8 w-full max-w-xs space-y-2">
          <button
            ref={btnRef}
            type="button"
            className="btn-primary relative w-full overflow-hidden py-3.5 text-base shadow-lg shadow-brand/30"
            onClick={(e) => {
              e.stopPropagation()
              closeRef.current()
            }}
          >
            {moment.buttonLabel ?? 'Weiter'}
            {auto > 0 && (
              <span
                className="bm-bar absolute inset-x-0 bottom-0 h-1 bg-white/35"
                style={{ animationDuration: `${auto}ms` }}
                aria-hidden
              />
            )}
          </button>
          {moment.action && (
            <button
              type="button"
              className="w-full rounded-full py-2.5 text-sm font-semibold text-white/80 transition active:scale-95"
              onClick={(e) => {
                e.stopPropagation()
                moment.action?.onClick()
                closeRef.current()
              }}
            >
              {moment.action.label}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
