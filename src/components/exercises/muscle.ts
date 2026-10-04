import type { CSSProperties } from 'react'
import { MUSCLE_CATEGORY, type MovementCategory } from '../../lib/analytics'
import type { Exercise, MuscleGroup } from '../../types'

/** Farbton je Bewegungskategorie (Klassen als Literale, damit Tailwind sie findet). */
export const CATEGORY_TINT: Record<
  MovementCategory,
  { soft: string; text: string; solid: string; stroke: string; fill: string }
> = {
  push: { soft: 'bg-brand/15', text: 'text-brand', solid: 'bg-brand', stroke: 'stroke-brand', fill: 'fill-brand' },
  pull: {
    soft: 'bg-sky-500/15',
    text: 'text-sky-600 dark:text-sky-400',
    solid: 'bg-sky-500',
    stroke: 'stroke-sky-500',
    fill: 'fill-sky-500',
  },
  legs: { soft: 'bg-success/15', text: 'text-success', solid: 'bg-success', stroke: 'stroke-success', fill: 'fill-success' },
  core: { soft: 'bg-gold/15', text: 'text-gold', solid: 'bg-gold', stroke: 'stroke-gold', fill: 'fill-gold' },
  other: {
    soft: 'bg-sand',
    text: 'text-cocoa-light',
    solid: 'bg-cocoa-muted',
    stroke: 'stroke-cocoa-muted',
    fill: 'fill-cocoa-muted',
  },
}

export const CATEGORY_ORDER: MovementCategory[] = ['push', 'pull', 'legs', 'core', 'other']

export function muscleTint(m: MuscleGroup) {
  return CATEGORY_TINT[MUSCLE_CATEGORY[m] ?? 'other']
}

/** Kurzes Kürzel für Avatare (eindeutig, auch bei Brust/Beine/Bizeps/Bauch). */
const ABBR: Record<MuscleGroup, string> = {
  Brust: 'Br',
  Rücken: 'Rü',
  Beine: 'Be',
  Beinbeuger: 'BB',
  Waden: 'Wa',
  Gesäß: 'Gs',
  Schultern: 'Sc',
  Bizeps: 'Bi',
  Trizeps: 'Tr',
  Unterarme: 'UA',
  Bauch: 'Ba',
  Ganzkörper: 'GK',
  Sonstige: '·',
}

export function muscleAbbr(m: MuscleGroup): string {
  return ABBR[m] ?? m.slice(0, 2)
}

/**
 * Muskel-Gewichtung eines Übungs-Sets: Hauptmuskel 1, Nebenmuskeln 0,5.
 * Absteigend sortiert, „Sonstige" ausgelassen.
 */
export function muscleWeights(exs: Pick<Exercise, 'muscle_group' | 'secondary_muscles'>[]) {
  const w = new Map<MuscleGroup, number>()
  for (const e of exs) {
    w.set(e.muscle_group, (w.get(e.muscle_group) ?? 0) + 1)
    for (const s of e.secondary_muscles ?? []) if (s !== e.muscle_group) w.set(s, (w.get(s) ?? 0) + 0.5)
  }
  w.delete('Sonstige')
  return [...w.entries()].sort((a, b) => b[1] - a[1]).map(([muscle, weight]) => ({ muscle, weight }))
}

/** Anteile je Bewegungskategorie (für den Abdeckungs-Balken), Summe = 1. */
export function categoryShares(weights: { muscle: MuscleGroup; weight: number }[]) {
  const by = new Map<MovementCategory, number>()
  let total = 0
  for (const { muscle, weight } of weights) {
    const c = MUSCLE_CATEGORY[muscle] ?? 'other'
    by.set(c, (by.get(c) ?? 0) + weight)
    total += weight
  }
  if (total === 0) return []
  return CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => ({ category: c, share: by.get(c)! / total }))
}

export const CATEGORY_LABEL: Record<MovementCategory, string> = {
  push: 'Drücken',
  pull: 'Ziehen',
  legs: 'Beine',
  core: 'Rumpf',
  other: 'Sonstiges',
}

/** Gestaffeltes Einblenden (Keyframes `fade-in` aus index.css). */
export function enter(index: number, step = 50): CSSProperties {
  return { animation: 'fade-in .3s ease-out both', animationDelay: `${Math.min(index, 12) * step}ms` }
}

/** „heute", „gestern", „vor 3 T.", „vor 2 Wo." — kurz für Meta-Zeilen. */
export function agoShort(date: string | null | undefined, today: string): string | null {
  if (!date) return null
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 14) return `vor ${days} T.`
  if (days < 60) return `vor ${Math.round(days / 7)} Wo.`
  return `vor ${Math.round(days / 30)} Mon.`
}

/** Lange Variante für Überschriften: „vor 3 Tagen". */
export function agoLong(date: string | null | undefined, today: string): string | null {
  if (!date) return null
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 14) return `vor ${days} Tagen`
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen`
  return `vor ${Math.round(days / 30)} Monaten`
}
