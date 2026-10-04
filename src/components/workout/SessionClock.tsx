import { useEffect, useState } from 'react'

/** „12:05" bzw. ab einer Stunde „1:02:05". */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`
}

/**
 * Laufende Trainingsdauer seit `startMs`. Tickt in einer eigenen kleinen
 * Komponente, damit nicht die ganze Trainingsseite jede Sekunde neu rendert.
 */
export function SessionClock({ startMs, className = '' }: { startMs: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const sec = (now - startMs) / 1000
  // Über 10 Stunden ist es kein laufendes Training mehr (z. B. morgens angelegt, abends trainiert).
  return <span className={`tabular ${className}`}>{sec > 36000 ? '–' : fmtClock(sec)}</span>
}
