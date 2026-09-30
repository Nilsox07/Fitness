// Kleine Anzeige-Helfer für Community & Feed.

import type { UserStat } from '../../hooks/useSocial'
import { localDate } from '../../lib/day'
import { mascotStage } from '../../lib/gamification'
import { mascotEmoji } from '../../lib/cosmetics'

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

/** Maskottchen-Emoji: eigenes mit gewähltem Skin, Freunde im Standard-Skin. */
export function avatarEmoji(u: Pick<UserStat, 'total_sessions'>, isMe: boolean): string {
  return isMe ? mascotEmoji(u.total_sessions ?? 0) : mascotStage(u.total_sessions ?? 0).emoji
}

/** Plan heute gesetzt? (Zeile heute aktualisiert und Status nicht leer) */
export function planToday(u: Person, today = localDate()): string | null {
  const s = u.gym_status?.trim()
  if (!s) return null
  if (u.updated_at && localDate(new Date(u.updated_at)) !== today) return null
  return s
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
