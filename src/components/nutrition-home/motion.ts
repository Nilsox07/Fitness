import type { CSSProperties } from 'react'

/** Sanftes, gestaffeltes Einblenden der Karten (global bei „Bewegung reduzieren" aus). */
export function stagger(i: number, step = 60): CSSProperties {
  return { animation: 'fade-in .3s ease-out both', animationDelay: `${i * step}ms` }
}
