import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getFigure } from '../../lib/figure/catalog'
import { renderFigure } from '../../lib/figure/render'
import { peakFrame, sampleFigure, VIEW_H, VIEW_W } from '../../lib/figure/rig'
import type { FigureEntry } from '../../lib/figure/types'

/**
 * Farben der Figur, abgeleitet aus den App-Tokens (hell/dunkel über `.dark`
 * am <html>). Einmalig in den <head> geschrieben — bewusst nicht in index.css,
 * damit das Figuren-System in sich geschlossen bleibt.
 */
const STYLE_ID = 'xfig-style'
const CSS = `
.xfig{--xf-skin:#d7dde6;--xf-skin-far:#b8c1cd;--xf-hair:#97a1b0;--xf-equip:#2b3342;--xf-frame:#c9cfd8;
--xf-metal:#9aa3b2;--xf-line:#7d8796;--xf-ring:rgb(255 255 255/.13);--xf-band:#8b95a5;
--xf-floor:rgb(var(--c-sand,233 236 241)/.8);--xf-shadow:rgb(var(--c-text,11 15 25)/.08);--xf-glow:rgb(var(--c-ruby,225 29 72))}
.dark .xfig{--xf-skin:#4b5669;--xf-skin-far:#3a4351;--xf-hair:#2a313d;--xf-equip:#0e131c;--xf-frame:#344155;
--xf-metal:#8492a6;--xf-line:#8492a6;--xf-ring:rgb(255 255 255/.08);--xf-band:#64748b;
--xf-floor:rgb(var(--c-sand,35 46 68)/.7);--xf-shadow:rgb(0 0 0/.28)}
`

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}
ensureStyle()

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/**
 * Stilisierte, animierte Übungsfigur (reines SVG). Transparenter Hintergrund.
 * Pausiert außerhalb des Sichtbereichs, bei verstecktem Tab und bei
 * „Bewegung reduzieren" (dann Standbild der Hauptpose).
 */
export function ExerciseFigure({
  figureId,
  entry,
  size,
  className = '',
  animate = true,
  thumb = false,
  label,
}: {
  figureId?: string
  entry?: FigureEntry | null
  /** Breite in px (Höhe = 3/4). Ohne Angabe: volle Breite des Containers. */
  size?: number
  className?: string
  animate?: boolean
  /** Vorschaubild: Standbild ohne Boden, quadratisch auf die Figur zugeschnitten. */
  thumb?: boolean
  label?: string
}) {
  const fig = entry ?? (figureId ? getFigure(figureId) : null)
  const reduced = usePrefersReducedMotion()
  const gRef = useRef<SVGGElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const still = useMemo(
    () => (fig ? renderFigure(fig.figure, peakFrame(fig.figure), fig, { floor: !thumb }) : ''),
    [fig, thumb],
  )
  const running = animate && !thumb && !reduced && !!fig
  const [box, setBox] = useState<string | null>(null)

  // Vorschaubild: viewBox auf die Figur (inkl. Geräte) zuschneiden.
  useLayoutEffect(() => {
    if (!thumb || !gRef.current) return
    try {
      const b = gRef.current.getBBox()
      if (!b.width || !b.height) return
      const side = Math.max(b.width, b.height) * 1.06
      const cx = b.x + b.width / 2
      const cy = b.y + b.height / 2
      setBox(`${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`)
    } catch {
      /* getBBox nicht verfügbar (z. B. ausgeblendet) → volle Ansicht */
    }
  }, [thumb, still])

  useEffect(() => {
    const g = gRef.current
    const svg = svgRef.current
    if (!g || !svg || !fig) return
    if (!running) {
      g.innerHTML = still
      return
    }
    const def = fig.figure
    const dur = def.duration ?? 3200
    let raf = 0
    let visible = true
    let start = performance.now()
    let paused = 0

    const tick = (now: number) => {
      const t = ((now - start) % dur) / dur
      g.innerHTML = renderFigure(def, sampleFigure(def, t), fig)
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (!raf) return
      cancelAnimationFrame(raf)
      raf = 0
      paused = performance.now()
    }
    const play = () => {
      if (raf || !visible || document.visibilityState === 'hidden') return
      if (paused) start += performance.now() - paused
      raf = requestAnimationFrame(tick)
    }

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((es) => {
            visible = es.some((e) => e.isIntersecting)
            if (visible) play()
            else stop()
          })
        : null
    io?.observe(svg)
    const onVis = () => (document.visibilityState === 'hidden' ? stop() : play())
    document.addEventListener('visibilitychange', onVis)
    play()
    return () => {
      stop()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fig, running, still])

  if (!fig) return null
  return (
    <svg
      ref={svgRef}
      viewBox={thumb ? box ?? `50 0 ${VIEW_H} ${VIEW_H}` : `0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={size ? (thumb ? size : (size * VIEW_H) / VIEW_W) : undefined}
      className={`xfig block ${size ? '' : 'h-full w-full'} ${className}`}
      role="img"
      aria-label={label ?? `Animation: ${fig.name}`}
    >
      <g ref={gRef} dangerouslySetInnerHTML={{ __html: still }} />
    </svg>
  )
}
