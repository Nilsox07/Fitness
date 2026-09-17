// Automatisches Gesamt-Wochenfazit: einmal pro Kalenderwoche (ab Montag) erzeugt,
// als Popup beim Öffnen gezeigt und im Profil einsehbar.

const KEY = 'weekly_review'
const SEEN_KEY = 'weekly_review_seen'

export interface StoredReview {
  weekId: string
  text: string
  createdAt: string
}

/** ISO-Wochen-ID wie "2026-W38". */
export function isoWeekId(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7 // Mo=1 … So=7
  t.setUTCDate(t.getUTCDate() + 4 - day) // Donnerstag der Woche
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Lokales Datum als YYYY-MM-DD. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Montag–Sonntag der VORIGEN Kalenderwoche (das wird montags ausgewertet). */
export function lastWeekRange(now = new Date()): { start: string; end: string; label: string } {
  const day = now.getDay() || 7 // Mo=1 … So=7
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - (day - 1))
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday)
  lastSunday.setDate(thisMonday.getDate() - 1)
  const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
  return { start: ymd(lastMonday), end: ymd(lastSunday), label: `${fmt(lastMonday)}–${fmt(lastSunday)}` }
}

export function getStoredReview(): StoredReview | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredReview) : null
  } catch {
    return null
  }
}

export function storeReview(r: StoredReview) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    /* ignore */
  }
}

export function getSeenWeekId(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function markSeen(weekId: string) {
  try {
    localStorage.setItem(SEEN_KEY, weekId)
  } catch {
    /* ignore */
  }
}
