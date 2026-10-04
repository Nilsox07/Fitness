// Automatisches Gesamt-Wochenfazit: einmal pro Kalenderwoche (ab Montag) erzeugt,
// als Popup beim Öffnen gezeigt und im Profil einsehbar.

import { estimate1RM, onlyWorking } from './analytics'
import type { SetWithDate } from '../types'

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

/**
 * Anzahl Übungen mit neuem Rekord (bester geschätzter 1RM) in [start, end]
 * gegenüber der gesamten Historie davor. Nur durchgeführte Arbeitssätze
 * (Wdh > 0); Übungen ohne Vorgeschichte zählen nicht als Rekord.
 */
export function weekPrCount(sets: SetWithDate[], start: string, end: string): number {
  const byEx = new Map<string, { before: number; cur: number }>()
  for (const s of onlyWorking(sets)) {
    if (s.date > end) continue
    const e1 = Math.max(
      s.reps > 0 ? estimate1RM(s.weight, s.reps) : 0,
      (s.reps_right ?? 0) > 0 ? estimate1RM(s.weight_right ?? 0, s.reps_right ?? 0) : 0,
    )
    if (e1 <= 0) continue
    const rec = byEx.get(s.exercise_id) ?? { before: 0, cur: 0 }
    if (s.date >= start) rec.cur = Math.max(rec.cur, e1)
    else rec.before = Math.max(rec.before, e1)
    byEx.set(s.exercise_id, rec)
  }
  let n = 0
  for (const r of byEx.values()) if (r.before > 0 && r.cur > r.before + 0.01) n++
  return n
}

/** Gewichtsverlauf innerhalb der Woche: erste vs. letzte Messung (null bei < 2). */
export function weekBodyweight(
  weights: { date: string; weight_kg: number | string }[],
  start: string,
  end: string,
): { start: number; current: number } | null {
  const inRange = weights
    .filter((w) => w.date >= start && w.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (inRange.length < 2) return null
  return { start: Number(inRange[0].weight_kg), current: Number(inRange[inRange.length - 1].weight_kg) }
}
