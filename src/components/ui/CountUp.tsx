import { useEffect, useState } from 'react'
import { useCountUp } from '../food/useCountUp'

/** Zahl, die beim Erscheinen sanft hochzählt (deutsches Format). */
export function CountUp({
  value,
  decimals = 0,
  duration = 700,
}: {
  value: number
  decimals?: number
  duration?: number
}) {
  const v = useCountUp(value, duration)
  return <>{v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}

/** Erst nach dem ersten Bild „true“ – damit Ringe & Balken von 0 an loslaufen. */
export function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return m
}
