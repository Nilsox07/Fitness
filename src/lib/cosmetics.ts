// Freischaltbare Kosmetik: Akzentfarben & Maskottchen-Skins (per Level).

export interface Accent {
  id: string
  label: string
  minLevel: number
  /** RGB-Tripel als "r g b" (für die CSS-Variablen --c-ruby*). */
  base: string
  dark: string
  light: string
  /** Vorschau-Farbe */
  swatch: string
}

export const ACCENTS: Accent[] = [
  { id: 'ruby', label: 'Rubin', minLevel: 1, base: '225 29 72', dark: '190 18 60', light: '251 113 133', swatch: '#E11D48' },
  { id: 'ocean', label: 'Ozean', minLevel: 3, base: '14 165 233', dark: '2 132 199', light: '56 189 248', swatch: '#0EA5E9' },
  { id: 'forest', label: 'Wald', minLevel: 5, base: '16 185 129', dark: '5 150 105', light: '52 211 153', swatch: '#10B981' },
  { id: 'violet', label: 'Violett', minLevel: 8, base: '139 92 246', dark: '124 58 237', light: '167 139 250', swatch: '#8B5CF6' },
  { id: 'amber', label: 'Gold', minLevel: 12, base: '245 158 11', dark: '217 119 6', light: '251 191 36', swatch: '#F59E0B' },
  { id: 'slate', label: 'Stahl', minLevel: 16, base: '100 116 139', dark: '71 85 105', light: '148 163 184', swatch: '#64748B' },
]

export interface Skin {
  id: string
  label: string
  minLevel: number
  /** 6 Emojis passend zu den Maskottchen-Stufen. */
  stages: string[]
}

export const SKINS: Skin[] = [
  { id: 'classic', label: 'Klassik', minLevel: 1, stages: ['🥚', '🐣', '🐤', '💪', '🏋️', '🦾'] },
  { id: 'beast', label: 'Bestie', minLevel: 4, stages: ['🥚', '🦎', '🐊', '🐉', '🐲', '🔥'] },
  { id: 'robot', label: 'Roboter', minLevel: 7, stages: ['🔩', '⚙️', '🤖', '🦾', '🛸', '🌌'] },
  { id: 'cat', label: 'Katze', minLevel: 10, stages: ['🥚', '🐱', '😼', '🐯', '🦁', '👑'] },
]

export function mascotStageIndex(sessions: number): number {
  if (sessions >= 250) return 5
  if (sessions >= 120) return 4
  if (sessions >= 60) return 3
  if (sessions >= 30) return 2
  if (sessions >= 10) return 1
  return 0
}

function get(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}
function set(key: string, val: string) {
  try {
    localStorage.setItem(key, val)
  } catch {
    /* ignore */
  }
}

export const getAccentId = () => get('accent', 'ruby')
export const setAccentId = (id: string) => set('accent', id)
export const getSkinId = () => get('skin', 'classic')
export const setSkinId = (id: string) => set('skin', id)

export function applyAccent(id: string) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--c-ruby', a.base)
  root.style.setProperty('--c-ruby-dark', a.dark)
  root.style.setProperty('--c-ruby-light', a.light)
}

export function mascotEmoji(sessions: number, skinId = getSkinId()): string {
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0]
  return skin.stages[mascotStageIndex(sessions)]
}
