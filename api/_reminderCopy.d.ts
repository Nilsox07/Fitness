// Typen zu api/_reminderCopy.js (reines JS für die Serverless-Funktionen, auch in der App genutzt).
export type ReminderKind =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'water'
  | 'protein'
  | 'fasting_open'
  | 'fasting_close'
  | 'workout'
  | 'streak'
  | 'supplement'
  | 'weigh'
  | 'review'
  | 'body'

export interface ReminderCtx {
  kcalLeft?: number
  drankL?: number | string
  targetL?: number | string
  missing?: number
  plan?: string | null
  days?: number
  weeks?: number
  danger?: boolean
  name?: string
  dose?: string | null
  end?: string
}

export function reminderCopy(
  kind: ReminderKind,
  ctx?: ReminderCtx,
  seed?: number,
): { title: string; body: string } | null
export function daySeed(date?: Date): number
