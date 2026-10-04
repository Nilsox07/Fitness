import type { BuddyMood } from '../../lib/buddyMood'
import { Buddy } from './Buddy'

/** Wie SCALE in Buddy.tsx (Körpergröße je Wachstumsstufe). */
const SCALE = [0.86, 0.78, 0.86, 0.92, 0.96, 1]

/**
 * Runder Ausschnitt mit Buddys Gesicht (z. B. für die obere Leiste). Buddy wird größer
 * gerendert und so verschoben, dass Augen + Mund mittig im Kreis sitzen — unabhängig
 * von der Wachstumsstufe.
 */
export function BuddyFace({
  size = 36,
  mood = 'happy',
  stage = 1,
  skin = 'classic',
  className = '',
}: {
  size?: number
  mood?: BuddyMood
  stage?: number
  skin?: string
  className?: string
}) {
  const s = SCALE[Math.max(0, Math.min(5, Math.round(stage)))]
  const inner = Math.round((size * 1.55) / s)
  // Gesichtsmitte im SVG (viewBox 120): x = 60, y ≈ 64 (Stufen-Skalierung um y = 107).
  const fy = ((107 - 43 * s) / 120) * inner
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="absolute block" style={{ left: size / 2 - inner / 2, top: size / 2 - fy }}>
        <Buddy size={inner} mood={mood} stage={stage} skin={skin} animate={false} className="block" />
      </span>
    </span>
  )
}
