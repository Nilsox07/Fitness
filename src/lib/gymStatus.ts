// Gym-Status („Wann Gym?") mit Datum. Ohne DB-Änderung: das lokale Datum wird
// vorne in den Text kodiert — `YYYY-MM-DD|<Text>`. So zeigt ein Plan von
// gestern nicht mehr als heutiger Plan, nur weil die Zeile heute (z. B. durch
// den Statistik-Sync) aktualisiert wurde.

import { localDate } from './day'

const RE = /^(\d{4}-\d{2}-\d{2})\|([\s\S]*)$/

export interface GymStatus {
  /** Datum des Plans (YYYY-MM-DD) oder null bei alten Werten ohne Datum. */
  date: string | null
  text: string
}

export function parseGymStatus(raw: string | null | undefined): GymStatus {
  if (!raw) return { date: null, text: '' }
  const m = RE.exec(raw)
  if (m) return { date: m[1], text: m[2].trim() }
  return { date: null, text: raw.trim() }
}

/** Zum Speichern: leerer Text → '' (löscht den Plan). */
export function encodeGymStatus(text: string, today = localDate()): string {
  const t = text.trim()
  return t ? `${today}|${t}` : ''
}
