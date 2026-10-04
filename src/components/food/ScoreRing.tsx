import { useEffect, useState } from 'react'
import type { ScoreTone } from '../../lib/mealScore'
import { useCountUp } from './useCountUp'

/** Textfarbe je Bewertung (Ring nutzt currentColor). Rot nur für die Warnstufe. */
export const TONE_TEXT: Record<ScoreTone, string> = {
  great: 'text-success',
  good: 'text-success/75',
  ok: 'text-gold',
  poor: 'text-red-500 dark:text-red-400',
}

const SIZE = 84
const STROKE = 8
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

/** Kreisring mit Score 0–100: zeichnet sich beim Öffnen, Zahl zählt hoch. */
export function ScoreRing({ score, tone }: { score: number; tone: ScoreTone }) {
  // Erst leer rendern, dann im nächsten Frame auf den Zielwert → CSS-Transition zeichnet den Ring.
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const shown = Math.round(useCountUp(score))
  const offset = drawn ? C * (1 - Math.max(0, Math.min(100, score)) / 100) : C

  return (
    <div className={`relative shrink-0 ${TONE_TEXT[tone]}`} style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="tabular text-2xl font-bold text-cocoa" aria-label={`Score ${score} von 100`}>
          {shown}
        </span>
      </div>
    </div>
  )
}
