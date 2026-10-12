// Freischaltungen über das Buddy-Level hinaus: Accessoires, Skins, Rahmen,
// Hintergründe, Titel, Farb-Varianten, Theme – plus Erfolge (verhaltensbasiert)
// und Prestige ab Level 50. Reine Logik (testbar), Darstellung in Buddy.tsx.

export type UnlockKind = 'accessory' | 'skin' | 'frame' | 'background' | 'title' | 'accent' | 'theme' | 'variant'

export type AchievementId = 'sessions100' | 'protein30' | 'streak10' | 'photo8w' | 'pokes25' | 'prestige1'

export interface UnlockDef {
  kind: UnlockKind
  id: string
  label: string
  /** ab diesem Buddy-Level (fehlt bei reinen Erfolgs-Belohnungen) */
  level?: number
  /** oder: durch diesen Erfolg */
  achievement?: AchievementId
}

/** Level-Belohnungen ab Level 11 (die ersten Skins/Farben stehen in cosmetics.ts). */
export const UNLOCKS: UnlockDef[] = [
  { kind: 'accessory', id: 'headband', label: 'Stirnband', level: 11 },
  { kind: 'title', id: 'eisenbeisser', label: 'Eisenbeißer', level: 13 },
  { kind: 'skin', id: 'penguin', label: 'Pinguin', level: 14 },
  { kind: 'accessory', id: 'sunglasses', label: 'Sonnenbrille', level: 15 },
  { kind: 'frame', id: 'bronze', label: 'Bronze-Rahmen', level: 17 },
  { kind: 'accent', id: 'teal', label: 'Türkis', level: 18 },
  { kind: 'skin', id: 'panda', label: 'Panda', level: 20 },
  { kind: 'title', id: 'dauerbrenner', label: 'Dauerbrenner', level: 20 },
  { kind: 'accessory', id: 'headphones', label: 'Kopfhörer', level: 22 },
  { kind: 'background', id: 'night', label: 'Gym bei Nacht', level: 24 },
  { kind: 'frame', id: 'silver', label: 'Silber-Rahmen', level: 25 },
  { kind: 'accent', id: 'sunset', label: 'Sunset', level: 27 },
  { kind: 'accessory', id: 'belt', label: 'Gewichtheber-Gürtel', level: 28 },
  { kind: 'skin', id: 'fox', label: 'Fuchs', level: 30 },
  { kind: 'theme', id: 'midnight', label: 'Theme „Midnight“', level: 30 },
  { kind: 'accessory', id: 'cap', label: 'Cap', level: 32 },
  { kind: 'background', id: 'beach', label: 'Strand', level: 34 },
  { kind: 'frame', id: 'gold', label: 'Gold-Rahmen', level: 35 },
  { kind: 'title', id: 'maschine', label: 'Maschine', level: 35 },
  { kind: 'accessory', id: 'cape', label: 'Umhang', level: 37 },
  { kind: 'variant', id: 'gold', label: 'Gold-Variante', level: 40 },
  { kind: 'background', id: 'space', label: 'Weltall', level: 42 },
  { kind: 'frame', id: 'diamond', label: 'Diamant-Rahmen', level: 45 },
  { kind: 'title', id: 'legende', label: 'Legende', level: 45 },
  { kind: 'accessory', id: 'laurel', label: 'Lorbeerkranz', level: 48 },
  { kind: 'variant', id: 'neon', label: 'Neon-Variante', level: 50 },
  // Erfolge
  { kind: 'accessory', id: 'chain', label: 'Hantel-Kette', achievement: 'sessions100' },
  { kind: 'variant', id: 'pink', label: 'Protein-Pink', achievement: 'protein30' },
  { kind: 'frame', id: 'flame', label: 'Flammen-Rahmen', achievement: 'streak10' },
  { kind: 'title', id: 'verwandlung', label: 'Verwandlung', achievement: 'photo8w' },
  { kind: 'accessory', id: 'megaphone', label: 'Megafon', achievement: 'pokes25' },
  { kind: 'frame', id: 'prestige', label: 'Prestige-Rahmen', achievement: 'prestige1' },
]

export const PRESTIGE_LEVEL = 50

export interface AchievementDef {
  id: AchievementId
  label: string
  hint: string
  goal: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'sessions100', label: '100 Trainings', hint: 'Insgesamt 100 Trainings absolvieren', goal: 100 },
  { id: 'protein30', label: '30× Eiweißziel', hint: 'An 30 Tagen dein Eiweißziel erreichen', goal: 30 },
  { id: 'streak10', label: '10 Wochen am Stück', hint: '10 Wochen in Folge dein Wochenziel trainieren', goal: 10 },
  { id: 'photo8w', label: 'Verwandlung', hint: 'Ein Vergleichsfoto 8 Wochen nach dem ersten', goal: 56 },
  { id: 'pokes25', label: 'Motivator', hint: 'Freunde 25× anstupsen', goal: 25 },
  { id: 'prestige1', label: 'Prestige', hint: `Level ${PRESTIGE_LEVEL} erreichen und Prestige starten`, goal: 1 },
]

export interface AchievementStats {
  sessions: number
  proteinDays: number
  weekStreak: number
  /** Tage zwischen erstem und letztem Körperfoto */
  photoSpanDays: number
  pokesSent: number
  prestige: number
}

/** Fortschritt je Erfolg (Wert und erreicht?). */
export function achievementProgress(s: AchievementStats): Record<AchievementId, { value: number; done: boolean }> {
  const v: Record<AchievementId, number> = {
    sessions100: s.sessions,
    protein30: s.proteinDays,
    streak10: s.weekStreak,
    photo8w: s.photoSpanDays,
    pokes25: s.pokesSent,
    prestige1: s.prestige,
  }
  const out = {} as Record<AchievementId, { value: number; done: boolean }>
  for (const a of ACHIEVEMENTS) out[a.id] = { value: v[a.id], done: v[a.id] >= a.goal }
  return out
}

export interface UnlockContext {
  /** aktuelles Buddy-Level (nach Prestige wieder ab 1) */
  level: number
  /** Anzahl Prestige-Runden – ab 1 bleiben alle Level-Belohnungen offen */
  prestige: number
  /** jemals erreichte Erfolge */
  achievements: ReadonlySet<string>
}

export function isUnlocked(def: Pick<UnlockDef, 'level' | 'achievement'>, ctx: UnlockContext): boolean {
  if (def.achievement) return ctx.achievements.has(def.achievement)
  if (def.level == null) return true
  return ctx.prestige > 0 || ctx.level >= def.level
}

/** Die nächsten noch gesperrten Level-Belohnungen (für „Als Nächstes“). */
export function nextUnlocks(ctx: UnlockContext, n = 3): UnlockDef[] {
  if (ctx.prestige > 0) return []
  return UNLOCKS.filter((u) => u.level != null && u.level > ctx.level).slice(0, n)
}

// --- Aussehen --------------------------------------------------------------

export interface BuddyLookPrefs {
  skin: string
  variant: string
  accessory: string
  background: string
  frame: string
  title: string
}

export const DEFAULT_LOOK: BuddyLookPrefs = {
  skin: 'classic',
  variant: 'normal',
  accessory: 'none',
  background: 'none',
  frame: 'none',
  title: 'none',
}

const ID_RE = /^[a-z0-9:_-]{1,40}$/

export function normalizeLook(raw: unknown): BuddyLookPrefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pick = (k: keyof BuddyLookPrefs) =>
    typeof r[k] === 'string' && ID_RE.test(r[k] as string) ? (r[k] as string) : DEFAULT_LOOK[k]
  return {
    skin: pick('skin'),
    variant: pick('variant'),
    accessory: pick('accessory'),
    background: pick('background'),
    frame: pick('frame'),
    title: pick('title'),
  }
}

/** Anzeigename eines Titels ('' wenn keiner). Saison-Titel kommen mit Label. */
export function titleLabel(id: string | null | undefined): string {
  if (!id || id === 'none') return ''
  return UNLOCKS.find((u) => u.kind === 'title' && u.id === id)?.label ?? ''
}

/** Ring-Farben der Rahmen (Tailwind-Klassen). */
export const FRAME_RING: Record<string, string> = {
  bronze: 'ring-[#C77B3A]',
  silver: 'ring-[#A8B2C1]',
  gold: 'ring-[#F2B705]',
  diamond: 'ring-[#7DD3FC]',
  flame: 'ring-[#F97316]',
  prestige: 'ring-[#A855F7]',
}

// --- Prestige --------------------------------------------------------------

export interface PrestigeState {
  count: number
  /** Gesamt-XP zum Zeitpunkt des letzten Prestige (wird vom Level abgezogen) */
  xpOffset: number
}

export function normalizePrestige(raw: unknown): PrestigeState {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  return { count: n(r.count), xpOffset: n(r.xpOffset) }
}
