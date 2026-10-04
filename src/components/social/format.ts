// Kleine Anzeige-Helfer für Community & Feed.

import type { UserStat } from '../../hooks/useSocial'
import { localDate } from '../../lib/day'
import { mascotStageIndex } from '../../lib/cosmetics'
import { friendBuddyMood, type BuddyMood } from '../../lib/buddyMood'
import { parseGymStatus } from '../../lib/gymStatus'

/** `UserStat` inkl. `updated_at`, das per `select *` mitkommt (nicht im Typ deklariert). */
export type Person = UserStat & { updated_at?: string | null }

/** „vor 5 Min", „vor 3 Std", „vor 2 T." */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000))
  if (s < 60) return 'gerade eben'
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`
  return `vor ${Math.floor(s / 86400)} T.`
}

/** Tage zwischen zwei YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function firstName(u: Pick<UserStat, 'display_name'> | undefined): string {
  return u?.display_name?.trim() || 'Freund'
}

/** Aussehen eines Buddy-Avatars. */
export interface BuddyLook {
  stage: number
  mood: BuddyMood
  skin: string
}

/**
 * Buddy einer Person aus den geteilten Stats: Stufe = Trainings gesamt, Stimmung =
 * letztes Training. Eigener Buddy mit gewähltem Skin; Skins der Freunde werden nicht
 * geteilt → Standard-Skin.
 */
export function buddyLook(
  u: Pick<UserStat, 'total_sessions' | 'last_workout'>,
  isMe: boolean,
  mySkin: string,
  today = localDate(),
): BuddyLook {
  return {
    stage: mascotStageIndex(u.total_sessions ?? 0),
    mood: friendBuddyMood(u.last_workout, today),
    skin: isMe ? mySkin : 'classic',
  }
}

/** Wurde die Zeile heute (lokal) aktualisiert? */
export function updatedToday(u: Person, today = localDate()): boolean {
  return Boolean(u.updated_at) && localDate(new Date(u.updated_at!)) === today
}

/**
 * Plan heute gesetzt? Neue Werte tragen ihr Datum im Text (`YYYY-MM-DD|…`);
 * alte Werte ohne Datum gelten nur, wenn die Zeile heute aktualisiert wurde.
 */
export function planToday(u: Person, today = localDate()): string | null {
  const { date, text } = parseGymStatus(u.gym_status)
  if (!text) return null
  if (date) return date === today ? text : null
  if (u.updated_at && !updatedToday(u, today)) return null
  return text
}

/** Protein heute eines Freundes — 0, wenn die geteilte Zahl nicht von heute ist. */
export function proteinToday(u: Person, today = localDate()): number {
  return updatedToday(u, today) ? Math.round(u.protein_today ?? 0) : 0
}

/** kcal heute eines Freundes — 0, wenn die geteilte Zahl nicht von heute ist. */
export function kcalToday(u: Person, today = localDate()): number {
  return updatedToday(u, today) ? Math.round(u.kcal_today ?? 0) : 0
}

export const NOT_TODAY = 'Heute nicht'

export function isNotToday(plan: string | null): boolean {
  return (plan ?? '').toLowerCase().startsWith('heute nicht')
}

export type StatusKind = 'trained' | 'plan' | 'idle'

/** Kurzer Status unter dem Avatar. */
export function statusLine(u: Person, today = localDate()): { kind: StatusKind; text: string } {
  if (u.last_workout === today) return { kind: 'trained', text: 'trainiert' }
  const plan = planToday(u, today)
  if (plan && !isNotToday(plan)) {
    const rest = plan.replace(/^heute\s+(um\s+)?/i, '')
    return { kind: 'plan', text: /^\d/.test(rest) ? `im Gym ${rest}` : plan }
  }
  if (!u.last_workout) return { kind: 'idle', text: 'noch kein Training' }
  const d = daysBetween(u.last_workout, today)
  return { kind: 'idle', text: d <= 1 ? 'gestern' : `vor ${d} T.` }
}
