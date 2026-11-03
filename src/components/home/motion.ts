import type { CSSProperties } from 'react'

/** Sanftes, gestaffeltes Einblenden der Karten (Keyframes `fade-in` aus index.css). */
export function enter(index: number): CSSProperties {
  return { animation: 'fade-in .3s ease-out backwards', animationDelay: `${index * 60}ms` }
}

/** Kurzes Aufploppen (Keyframes `check-pop`), z. B. für trainierte Tage. */
export function pop(delayMs: number): CSSProperties {
  return { animation: 'check-pop .28s ease-out backwards', animationDelay: `${delayMs}ms` }
}
