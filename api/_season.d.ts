// Typen für die Tests (api/_season.js ist reines JS für die Serverless-Funktionen).
export const QUEST_TYPES: Record<string, { min: number; max: number; label: (t: number, m?: string) => string }>
export const MUSCLES: string[]
export const FALLBACK_THEMES: unknown[]
export function normalizeTheme(
  raw: unknown,
  month: string,
): {
  id: string
  name: string
  emoji: string
  tagline: string
  badge: { emoji: string; label: string }
  quests: { type: string; target: number; muscle?: string; label: string }[]
}
export function seasonPrompt(month: string): string
