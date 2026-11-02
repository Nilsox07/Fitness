// Supplement-Vorrat (Migration 0042, alles optional): Rest = Vorrat − Dosis × Einnahmen seit dem Setzen.
// So wird nichts doppelt gezählt; Abhaken/Rückgängig im Log ändert den Rest automatisch.

import { shiftDate } from './day'
import type { Supplement } from './supplements'

export const STOCK_UNITS = ['Stück', 'g', 'ml'] as const
export type StockUnit = (typeof STOCK_UNITS)[number]

/** Ab so vielen Tagen Restreichweite gibt es den Nachfüll-Hinweis. */
export const STOCK_LOW_DAYS = 7

export interface StockFields {
  stock_amount?: number | null
  stock_unit?: StockUnit | null
  /** Menge pro Einnahme in stock_unit (Standard 1) */
  dose_amount?: number | null
  stock_set_at?: string | null
  /** zuletzt gekaufte Packung (Vorschlag beim Nachfüllen) */
  stock_pack?: number | null
}

export type StockSupplement = Supplement & StockFields

export interface StockLogRow {
  supplement_id: string
  taken_at: string
}

/** Gibt es die Vorrat-Spalten schon? (Zeilen haben den Schlüssel, auch wenn er null ist.) */
export function hasStockColumns(list: readonly object[]): boolean {
  return list.some((s) => 'stock_amount' in s)
}

/** Hat das Supplement einen Vorrat eingetragen? */
export function hasStock(s: StockFields): boolean {
  return s.stock_amount != null && Number.isFinite(Number(s.stock_amount))
}

/** Einnahmen pro Tag im Schnitt (Uhrzeiten × Wochentage / 7). */
export function dosesPerDay(s: Pick<Supplement, 'times' | 'days'>): number {
  return (s.times.length * s.days.length) / 7
}

/** Abgehakte Einnahmen seit dem Setzen des Vorrats. */
export function takenSince(s: Pick<Supplement, 'id'> & StockFields, log: readonly StockLogRow[]): number {
  const since = s.stock_set_at ? Date.parse(s.stock_set_at) : NaN
  return log.filter((l) => l.supplement_id === s.id && (!Number.isFinite(since) || Date.parse(l.taken_at) >= since))
    .length
}

/** Restmenge (nie unter 0) oder null ohne Vorrat. */
export function stockRemaining(s: StockFields, taken: number): number | null {
  if (!hasStock(s)) return null
  const dose = Number(s.dose_amount) > 0 ? Number(s.dose_amount) : 1
  return Math.max(0, Number(s.stock_amount) - taken * dose)
}

/** Ganze Tage, die der Rest noch reicht (abgerundet) — null, wenn nichts geplant ist. */
export function stockDaysLeft(remaining: number, s: Pick<Supplement, 'times' | 'days'> & StockFields): number | null {
  const dose = Number(s.dose_amount) > 0 ? Number(s.dose_amount) : 1
  const perDay = dosesPerDay(s) * dose
  if (!(perDay > 0)) return null
  return Math.floor(remaining / perDay + 1e-9)
}

export interface StockStatus {
  remaining: number
  days: number | null
  /** ≤ STOCK_LOW_DAYS → goldener Hinweis */
  low: boolean
}

/** Alles in einem: Rest, Reichweite, knapp? (null ohne Vorrat) */
export function stockStatus(s: StockSupplement, log: readonly StockLogRow[]): StockStatus | null {
  const remaining = stockRemaining(s, takenSince(s, log))
  if (remaining == null) return null
  const days = stockDaysLeft(remaining, s)
  return { remaining, days, low: days != null && days <= STOCK_LOW_DAYS }
}

/** „reicht noch ca. 7 Tage“, „reicht noch ca. 1 Tag“, „Vorrat leer“. */
export function stockLabel(st: Pick<StockStatus, 'remaining' | 'days'>): string {
  if (st.remaining <= 0) return 'Vorrat leer'
  if (st.days == null) return ''
  if (st.days === 0) return 'reicht nur noch heute'
  return `reicht noch ca. ${st.days} ${st.days === 1 ? 'Tag' : 'Tage'}`
}

/** Menge hübsch: 120 → „120 g“, 1,5 → „1,5 g“, Stück ganz. */
export function fmtStock(n: number, unit: StockUnit | null | undefined): string {
  const v = unit === 'Stück' ? Math.floor(n + 1e-9) : Math.round(n * 10) / 10
  return `${v.toLocaleString('de-DE')} ${unit ?? 'Stück'}`
}

/** Vorschlag für „pro Einnahme“ aus dem Mengen-Text („5 g“ → 5 bei g, „2 Kapseln“ → 2 bei Stück). */
export function guessDoseAmount(dose: string, unit: StockUnit): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜ.]*)/.exec(dose)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const u = m[2].toLowerCase()
  if (!(n > 0)) return null
  if (unit === 'g' && u === 'g') return n
  if (unit === 'ml' && u === 'ml') return n
  if (unit === 'Stück' && /^(stk|stück|tabl|tablette|kaps|kapsel|tab|caps|softgel|$)/.test(u)) return n
  return null
}

/** Nachfüllen: neuer Vorrat = Rest + neue Packung (Rest bleibt ja im Schrank). */
export function refill(remaining: number, pack: number): number {
  return Math.max(0, remaining) + Math.max(0, pack)
}

/**
 * Für den Erinnerungs-Planer: ab welchem Tag (YYYY-MM-DD) soll „Bald nachkaufen“ kommen?
 * = heute + (Reichweite − Vorlauf), frühestens heute. null ohne Vorrat/Plan.
 */
export function refillReminderDate(
  s: StockSupplement,
  log: readonly StockLogRow[],
  today: string,
  lead = STOCK_LOW_DAYS,
): string | null {
  const st = stockStatus(s, log)
  if (!st || st.days == null) return null
  return shiftDate(today, Math.max(0, st.days - lead))
}
