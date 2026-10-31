import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, X } from 'lucide-react'
import { MyBuddy } from './MyBuddy'
import { openBuddySheet } from './BuddySheet'
import { hideTip, isTipHidden, usePageTip } from './BuddyTip'
import { useBriefing } from './useBriefing'
import { useToday } from '../../hooks/useToday'
import { usePrefs } from '../../lib/prefs'
import { useOverlayOpen } from '../../lib/backStack'
import { isWorkoutRunning } from '../../lib/activeWorkout'
import { haptic } from '../../lib/native'
import { getTipPage, parsePos, snapPos, subscribeTipPage, type FloatPos } from '../../lib/buddyFloat'

const POS_KEY = 'buddy_float_pos'
/** In dieser Sitzung schon gezeigte Tipps – nicht bei jedem Seitenwechsel erneut aufpoppen. */
const shown = new Set<string>()

const SIZE = 54
const BASE_BOTTOM = 'calc(env(safe-area-inset-bottom) + 86px)'

function loadPos(): FloatPos {
  try {
    return parsePos(localStorage.getItem(POS_KEY))
  } catch {
    return parsePos(null)
  }
}

/**
 * Buddy schwebt über der Menüleiste (Standard: rechts). Er spricht per Sprechblase – mit dem Tipp der
 * aktuellen Seite – und verschwindet, sobald ein Fenster offen ist. Man kann ihn verschieben;
 * er schnappt an den linken oder rechten Rand. Antippen öffnet den Chat.
 */
export function FloatingBuddy() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const overlay = useOverlayOpen()
  const page = useSyncExternalStore(subscribeTipPage, getTipPage)
  const { tip, day, loading } = usePageTip(page)
  const t = useToday()
  const { hasWatch } = usePrefs()
  const brief = useBriefing()
  const [pos, setPos] = useState<FloatPos>(loadPos)
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const [bubble, setBubble] = useState(false)
  const [hop, setHop] = useState(0)
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  // Beim Scrollen kurz ausblenden, damit Buddy nichts verdeckt
  const [scrolling, setScrolling] = useState(false)
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let id: ReturnType<typeof setTimeout> | undefined
    const on = () => {
      setScrolling(true)
      clearTimeout(id)
      id = setTimeout(() => setScrolling(false), 900)
    }
    main.addEventListener('scroll', on, { passive: true })
    return () => {
      main.removeEventListener('scroll', on)
      clearTimeout(id)
    }
  }, [pathname])

  const tipKey = tip ? `${tip.key}|${day}` : null
  const tipAvailable = !!tip && !loading && !isTipHidden(tip.key, day)

  // Neuer Tipp auf der Seite → Buddy hüpft kurz und spricht (einmal pro Sitzung und Tipp)
  useEffect(() => {
    setBubble(false)
    if (!tipAvailable || !tipKey || shown.has(tipKey)) return
    const id = setTimeout(() => {
      shown.add(tipKey)
      setHop((n) => n + 1)
      setBubble(true)
    }, 700)
    return () => clearTimeout(id)
  }, [tipKey, tipAvailable])

  // Sprechblase schließt sich nach einer Weile von selbst
  useEffect(() => {
    if (!bubble || brief.busy) return
    const id = setTimeout(() => setBubble(false), brief.text ? 20000 : 12000)
    return () => clearTimeout(id)
  }, [bubble, brief.busy, brief.text])

  if (pathname === '/profile' || pathname.startsWith('/exercises/')) return null

  const withBriefing = page === 'today' && brief.aiOn && !(hasWatch && t.readiness)
  // Während eines laufenden Trainings nicht über den Satz-Knöpfen schweben
  const hidden = overlay || (pathname === '/' && isWorkoutRunning())

  function onDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.moved && Math.hypot(dx, dy) < 8) return
    s.moved = true
    setBubble(false)
    setDrag({ dx, dy })
  }
  function onUp(e: React.PointerEvent) {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved) {
      // Antippen: Sprechblase zeigen, falls ein Tipp wartet – sonst Chat öffnen
      void haptic()
      if (tipAvailable && !bubble) setBubble(true)
      else openBuddySheet()
      return
    }
    const w = window.innerWidth
    const el = e.currentTarget.getBoundingClientRect()
    const centerX = el.left + el.width / 2
    const fromBottom = window.innerHeight - el.bottom - 86
    const next = snapPos(centerX, fromBottom, w, window.innerHeight * 0.55)
    setDrag(null)
    setPos(next)
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const sideStyle = pos.side === 'right' ? { right: 12 } : { left: 12 }
  const bubbleOpen = bubble && tipAvailable && !hidden && !drag

  return (
    <div
      className={`pointer-events-none fixed z-[25] transition-all duration-300 ${
        hidden ? 'translate-y-4 scale-75 opacity-0' : scrolling && !bubble ? 'translate-y-2 opacity-0' : 'opacity-100'
      }`}
      style={{ ...sideStyle, bottom: `calc(${BASE_BOTTOM} + ${pos.bottom}px)` }}
      aria-hidden={hidden}
    >
      {/* Sprechblase */}
      {bubbleOpen && tip && (
        <div
          className={`anim-bubble pointer-events-auto absolute bottom-[calc(100%+6px)] w-[min(280px,calc(100vw-40px))] ${
            pos.side === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
          }`}
          role="status"
        >
          <div className="relative rounded-3xl bg-cream p-3.5 pr-9 shadow-[0_12px_32px_-10px_rgb(0_0_0/0.35)] ring-1 ring-black/5 dark:ring-white/10">
            <p className="text-[14px] leading-snug">{brief.text && withBriefing ? brief.text : tip.text}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tip.action && (
                <button
                  className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand active:scale-95"
                  onClick={() => {
                    setBubble(false)
                    navigate(tip.action!.to)
                  }}
                >
                  {tip.action.label}
                </button>
              )}
              {withBriefing && !brief.text && (
                <button
                  className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-on-brand active:scale-95"
                  onClick={() => void brief.load()}
                  disabled={brief.busy}
                >
                  {brief.busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Tagesbriefing
                </button>
              )}
              {brief.aiOn && tip.ask && (
                <button
                  className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs font-semibold text-cocoa active:scale-95"
                  onClick={() => {
                    setBubble(false)
                    openBuddySheet(tip.ask)
                  }}
                >
                  <Sparkles size={12} className="text-brand" /> Frag Buddy
                </button>
              )}
            </div>
            <button
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-cocoa-muted active:bg-sand"
              aria-label="Tipp für heute ausblenden"
              onClick={() => {
                hideTip(tip.key, day)
                setBubble(false)
              }}
            >
              <X size={15} />
            </button>
            {/* Spitze zeigt auf Buddy */}
            <span
              className={`absolute -bottom-1.5 h-4 w-4 rotate-45 bg-cream ${pos.side === 'right' ? 'right-6' : 'left-6'}`}
              aria-hidden
            />
          </div>
        </div>
      )}

      {/* Buddy (ganze Figur) */}
      <button
        type="button"
        aria-label="Buddy – dein Coach"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          start.current = null
          setDrag(null)
        }}
        className="pointer-events-auto relative block touch-none select-none"
        style={{
          width: SIZE,
          height: SIZE,
          transform: drag ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)` : undefined,
          transition: drag ? 'none' : 'transform .35s cubic-bezier(.3,1.35,.5,1)',
        }}
      >
        <span
          className="absolute inset-x-2 bottom-0 h-2 rounded-full bg-black/20 blur-[3px] dark:bg-black/50"
          aria-hidden
        />
        <span key={hop} className={`relative block ${hop ? 'anim-hop' : ''}`}>
          <MyBuddy size={SIZE} mood={bubbleOpen && tip ? tip.mood : 'happy'} />
        </span>
        {tipAvailable && !bubbleOpen && (
          <span className="absolute right-0 top-1 h-3 w-3 rounded-full bg-brand ring-2 ring-bg" aria-hidden />
        )}
      </button>
    </div>
  )
}
