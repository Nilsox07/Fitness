// Schwebender Buddy: welche Seite gerade welchen Tipp anbietet, und wo der Nutzer Buddy hingezogen hat.
// Reine Logik + kleiner Store – getestet in buddyFloat.test.ts.

import type { TipPage } from './buddyTips'

let page: TipPage | null = null
const listeners = new Set<() => void>()

export function setTipPage(p: TipPage | null): void {
  if (page === p) return
  page = p
  listeners.forEach((l) => l())
}
export function getTipPage(): TipPage | null {
  return page
}
export function subscribeTipPage(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Position: Seite (links/rechts) + Abstand vom unteren Rand in px (über der Menüleiste). */
export interface FloatPos {
  side: 'left' | 'right'
  bottom: number
}

export const DEFAULT_POS: FloatPos = { side: 'right', bottom: 0 }

/** Nach dem Loslassen: an den näheren Rand schnappen, Höhe begrenzen (0 = direkt über der Leiste). */
export function snapPos(x: number, bottom: number, width: number, maxBottom: number): FloatPos {
  return { side: x < width / 2 ? 'left' : 'right', bottom: Math.round(Math.min(maxBottom, Math.max(0, bottom))) }
}

export function parsePos(raw: string | null): FloatPos {
  try {
    const p = JSON.parse(raw ?? 'null') as Partial<FloatPos> | null
    if (!p) return DEFAULT_POS
    return {
      side: p.side === 'left' ? 'left' : 'right',
      bottom: typeof p.bottom === 'number' && Number.isFinite(p.bottom) ? Math.max(0, Math.min(600, p.bottom)) : 0,
    }
  } catch {
    return DEFAULT_POS
  }
}
