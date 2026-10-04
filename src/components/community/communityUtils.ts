// Reine Hilfen für den Community-Tab (neues Design): Welt der Aktivitäten,
// Rekord-Zeilen, Untertitel und das Eiweiß-Duell. Ohne UI/DB → testbar.

import type { CSSProperties } from 'react'
import { isNotToday, planToday, proteinToday, type Person } from '../social/format'
import { effectiveProteinDays } from '../../lib/duel'

export type FeedWorld = 'fitness' | 'food'
export type FeedFilter = 'all' | FeedWorld

/** Sanftes, gestaffeltes Einblenden (Keyframes `fade-in` aus index.css). */
export function enter(index: number, step = 60): CSSProperties {
  return { animation: 'fade-in .3s ease-out both', animationDelay: `${index * step}ms` }
}

const FOOD_RE = /cheat|recipe|rezept|food|meal|nutrition|ernähr|ernaehr|protein|eiwei|water|wasser|fast/

/** Zu welcher Welt gehört eine Aktivität? Ernährung: Cheat-Posts, Rezepte, Ernährungs-Level … */
export function activityWorld(kind: string): FeedWorld {
  return FOOD_RE.test(kind.toLowerCase()) ? 'food' : 'fitness'
}

export function matchesFilter(kind: string, filter: FeedFilter): boolean {
  return filter === 'all' || activityWorld(kind) === filter
}

/** „🏆 Neuer Rekord: Bankdrücken" + „~102 kg geschätztes 1RM" → Teile für die Rekord-Zeile. */
export function parsePr(
  title: string,
  detail: string | null,
): { exercise: string; value: string | null; unit: string | null } | null {
  const m = /rekord:?\s*(.+)$/i.exec(title)
  if (!m) return null
  const exercise = m[1].trim()
  if (!exercise) return null
  const d = /(~?\s*[\d.,]+\s*kg)\s*(.*)$/i.exec(detail ?? '')
  if (!d) return { exercise, value: null, unit: null }
  const rest = d[2].trim()
  return { exercise, value: d[1].replace(/\s+/g, ' ').trim(), unit: /1rm/i.test(rest) ? '1RM' : rest || null }
}

/** „12 Sätze · 5 Übungen · 3400 kg" → einzelne Kennzahlen (max. 4). */
export function detailStats(detail: string | null): string[] {
  if (!detail) return []
  const parts = detail.split('·').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2 || parts.length > 4) return []
  // Nur reine Zahlen-Angaben als Kennzahl darstellen
  return parts.every((p) => /^\d/.test(p)) ? parts : []
}

/** „jens.haake" → „Jens"; „Anna Maria" → „Anna". */
export function shortName(name: string | null | undefined, fallback = 'Freund'): string {
  const raw = name?.trim().split(/[\s._-]+/)[0]
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : fallback
}

/** Untertitel unter „Community": Anzahl Freunde + ein aktueller Hinweis. */
export function communitySubtitle(friends: Person[], world: FeedWorld, today: string): string {
  const n = friends.length
  if (n === 0) return 'Gemeinsam bleibt man dran'
  const count = `${n} ${n === 1 ? 'Freund' : 'Freunde'}`
  let hint: string | null = null
  if (world === 'food') {
    const top = [...friends].sort((a, b) => proteinToday(b, today) - proteinToday(a, today))[0]
    const g = top ? proteinToday(top, today) : 0
    if (g > 0) hint = `${shortName(top.display_name)} hat heute ${g} g Eiweiß`
    else {
      const best = [...friends].sort(
        (a, b) => effectiveProteinDays(b, today) - effectiveProteinDays(a, today),
      )[0]
      const d = best ? effectiveProteinDays(best, today) : 0
      if (d > 0) hint = `${shortName(best.display_name)}: ${d}× Eiweiß-Ziel diese Woche`
    }
  } else {
    const trained = friends.find((u) => u.last_workout === today)
    if (trained) hint = `${shortName(trained.display_name)} hat heute trainiert`
    else {
      for (const u of friends) {
        const plan = planToday(u, today)
        if (!plan || isNotToday(plan)) continue
        const who = shortName(u.display_name)
        hint = /^heute/i.test(plan)
          ? `${who} ist heute im Gym`
          : /^morgen/i.test(plan)
            ? `${who} geht morgen ins Gym`
            : `${who}: ${plan}`
        break
      }
    }
  }
  return hint ? `${count} · ${hint}` : count
}

export interface ProteinRow {
  user_id: string
  /** Tage mit erreichtem Eiweiß-Ziel diese Woche (0–7) */
  days: number
  /** Eiweiß heute in g (0, wenn die geteilte Zahl nicht von heute ist) */
  today: number
}

/**
 * Eiweiß-Duell: eigene Zahlen kommen lokal frisch, Freunde nur aus aktuellen
 * Zeilen. Sortiert nach Tagen, dann Eiweiß heute. Führende:r nur bei eindeutiger Spitze.
 */
export function proteinStandings(
  me: { user_id: string; days: number; today: number },
  friends: Person[],
  today: string,
): { rows: ProteinRow[]; leaderId: string | null; maxToday: number; totalDays: number } {
  const rows: ProteinRow[] = [
    { user_id: me.user_id, days: Math.max(0, Math.min(7, Math.round(me.days))), today: Math.max(0, Math.round(me.today)) },
    ...friends.map((u) => ({
      user_id: u.user_id,
      days: effectiveProteinDays(u, today),
      today: proteinToday(u, today),
    })),
  ]
  const sorted = [...rows].sort((a, b) => b.days - a.days || b.today - a.today)
  const [a, b] = sorted
  const leaderId =
    a && (a.days > 0 || a.today > 0) && (!b || a.days > b.days || (a.days === b.days && a.today > b.today))
      ? a.user_id
      : null
  return {
    rows: sorted,
    leaderId,
    maxToday: Math.max(0, ...rows.map((r) => r.today)),
    totalDays: rows.reduce((s, r) => s + r.days, 0),
  }
}

/** Gemeinsames Eiweiß-Wochenziel: so viele Ziel-Tage pro Person. */
export const PROTEIN_TEAM_DAYS = 5

/** „noch 3 Tage" / „letzter Tag". */
export function daysLeftLabel(n: number): string {
  return n === 0 ? 'letzter Tag' : n === 1 ? 'noch 1 Tag' : `noch ${n} Tage`
}
