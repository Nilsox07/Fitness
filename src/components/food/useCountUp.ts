import { useEffect, useRef, useState } from 'react'

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Zählt sanft (ease-out) vom bisherigen zum neuen Wert hoch — bei
 *  „Bewegung reduzieren" springt der Wert direkt. */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  const fromRef = useRef(value)
  fromRef.current = value

  useEffect(() => {
    if (reducedMotion()) {
      setValue(target)
      return
    }
    const from = fromRef.current
    if (from === target) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
