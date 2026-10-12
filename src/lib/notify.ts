// Erinnerungen – Arten, Texte und Standardwerte für die Einstellungsseite.
// Der Server (api/_notify.js) nutzt dieselben Arten und Standardwerte; ein Test
// stellt sicher, dass beide übereinstimmen.

export type NotifyKind =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'water'
  | 'protein'
  | 'fasting'
  | 'workout'
  | 'streak'
  | 'weigh'
  | 'review'
  | 'body'
  | 'social'

export interface NotifySetting {
  on: boolean
  /** lokale Uhrzeit „HH:MM“ (fehlt bei Arten ohne feste Zeit) */
  time?: string
  /** Wochentage 0 = Mo … 6 = So (nur Wiegen) */
  days?: number[]
}

export type NotifyPrefs = Record<NotifyKind, NotifySetting>

export const NOTIFY_DEFAULTS: NotifyPrefs = {
  breakfast: { on: false, time: '09:30' },
  lunch: { on: true, time: '13:30' },
  dinner: { on: true, time: '19:30' },
  water: { on: true, time: '16:00' },
  protein: { on: true, time: '20:00' },
  fasting: { on: false },
  workout: { on: true, time: '17:30' },
  streak: { on: true, time: '19:00' },
  weigh: { on: false, time: '08:00', days: [0] },
  review: { on: true, time: '09:00' },
  body: { on: true, time: '10:00' },
  social: { on: true },
}

export type NotifyGroup = 'Ernährung' | 'Training' | 'Fortschritt' | 'Community'

export interface NotifyItem {
  kind: NotifyKind
  group: NotifyGroup
  label: string
  /** Wann genau kommt sie? */
  hint: string
}

export const NOTIFY_ITEMS: NotifyItem[] = [
  { kind: 'breakfast', group: 'Ernährung', label: 'Frühstück', hint: 'Nur wenn noch nichts eingetragen ist' },
  { kind: 'lunch', group: 'Ernährung', label: 'Mittagessen', hint: 'Nur wenn noch nichts eingetragen ist' },
  { kind: 'dinner', group: 'Ernährung', label: 'Abendessen', hint: 'Mit den kcal, die noch übrig sind' },
  { kind: 'water', group: 'Ernährung', label: 'Trinken', hint: 'Wenn du unter der Hälfte deines Ziels bist' },
  { kind: 'protein', group: 'Ernährung', label: 'Eiweiß', hint: 'Wenn noch mehr als ¼ deines Ziels fehlt' },
  { kind: 'fasting', group: 'Ernährung', label: 'Essensfenster', hint: 'Beim Öffnen und 30 min vor dem Schließen' },
  {
    kind: 'workout',
    group: 'Training',
    label: 'Trainingstage',
    hint: 'An deinen Rhythmus-Tagen, wenn du noch nicht warst',
  },
  {
    kind: 'streak',
    group: 'Training',
    label: 'Serie in Gefahr',
    hint: 'Nach 3 Tagen Pause oder wenn die Wochen-Serie wackelt',
  },
  {
    kind: 'weigh',
    group: 'Fortschritt',
    label: 'Wiegen',
    hint: 'An den gewählten Tagen, wenn noch kein Gewicht da ist',
  },
  {
    kind: 'review',
    group: 'Fortschritt',
    label: 'Wochenfazit',
    hint: 'Montags, wenn Buddy deine Woche ausgewertet hat',
  },
  {
    kind: 'body',
    group: 'Fortschritt',
    label: 'Vergleichsfoto',
    hint: 'Sonntags, wenn dein letztes Foto 8 Wochen alt ist',
  },
  {
    kind: 'social',
    group: 'Community',
    label: 'Cheat-Alarm von Freunden',
    hint: 'Wenn ein Freund ein Cheat-Meal teilt',
  },
]

export const NOTIFY_GROUPS: NotifyGroup[] = ['Ernährung', 'Training', 'Fortschritt', 'Community']

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Gespeicherte Werte mit Standardwerten zusammenführen (gleiche Regeln wie der Server). */
export function normalizeNotify(raw: unknown): NotifyPrefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = {} as NotifyPrefs
  for (const k of Object.keys(NOTIFY_DEFAULTS) as NotifyKind[]) {
    const d = NOTIFY_DEFAULTS[k]
    const v = (r[k] && typeof r[k] === 'object' ? r[k] : {}) as Record<string, unknown>
    const item: NotifySetting = { on: typeof v.on === 'boolean' ? v.on : d.on }
    if (d.time) item.time = typeof v.time === 'string' && TIME_RE.test(v.time) ? v.time : d.time
    if (d.days) {
      const days = Array.isArray(v.days)
        ? [...new Set(v.days.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6))]
        : null
      item.days = days && days.length ? days.sort() : d.days
    }
    out[k] = item
  }
  return out
}

/** Zeitzone dieses Geräts (für die Uhrzeiten auf dem Server). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
  } catch {
    return 'Europe/Berlin'
  }
}
