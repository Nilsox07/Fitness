// Nachkochen: Mengen in Zutaten skalieren, Zeiten in Schritten erkennen, Timer anzeigen.

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 }

/** Zahl aus „1,5“, „1.5“, „1/2“, „½“, „1½“ lesen (sonst NaN). */
export function parseQty(raw: string): number {
  const t = raw.trim()
  const m = /^(\d+)?\s*([½¼¾⅓⅔⅛])$/.exec(t)
  if (m) return (m[1] ? Number(m[1]) : 0) + FRACTIONS[m[2]]
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t)
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : NaN
  if (/^\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'))
  return NaN
}

/** Menge hübsch auf Deutsch: 0,5 → „½“, 1,5 → „1½“, 2,25 → „2¼“, sonst max. 1 Nachkommastelle (ab 10 ganz). */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  const whole = Math.floor(n)
  const rest = n - whole
  if (n < 10) {
    for (const [sym, v] of [
      ['½', 0.5],
      ['¼', 0.25],
      ['¾', 0.75],
    ] as const)
      if (Math.abs(rest - v) < 0.02) return whole ? `${whole}${sym}` : sym
  }
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

const QTY = '(\\d+\\s*[½¼¾⅓⅔⅛]|[½¼¾⅓⅔⅛]|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?)'
const LEADING = new RegExp(`^(\\s*)${QTY}(?:\\s*[-–]\\s*${QTY})?`)

/**
 * Mengenangabe am Anfang einer Zutat skalieren: „200 g Mehl“ × 2 → „400 g Mehl“,
 * „1/2 TL Salz“ × 3 → „1½ TL Salz“, „2–3 Eier“ × 2 → „4–6 Eier“. Ohne Zahl vorn unverändert
 * (z. B. „Salz nach Geschmack“).
 */
export function scaleIngredient(text: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return text
  const m = LEADING.exec(text)
  if (!m) return text
  const a = parseQty(m[2])
  if (!Number.isFinite(a)) return text
  const b = m[3] ? parseQty(m[3]) : NaN
  const scaled = Number.isFinite(b) ? `${fmtQty(a * factor)}–${fmtQty(b * factor)}` : fmtQty(a * factor)
  return m[1] + scaled + text.slice(m[0].length)
}

/** Faktor von „Rezept ergibt n Portionen“ auf gewünschte Portionen. */
export function portionFactor(wanted: number, servings: number): number {
  const s = Number(servings) > 0 ? Number(servings) : 1
  return wanted > 0 ? wanted / s : 1
}

const UNIT_S: [RegExp, number][] = [
  [/^(?:std\.?|stunden?|h)$/i, 3600],
  [/^(?:min\.?|minuten?|minute)$/i, 60],
  [/^(?:sek\.?|sekunden?|sec\.?|s)$/i, 1],
]

const DURATION =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?\s*(std\.?|stunden?|h|min\.?|minuten?|sek\.?|sekunden?|sec\.?|s)(?![a-zäöüß])/gi

/**
 * Dauer in einem Schritt finden („10 Min“, „10–15 Minuten“, „30 Sek“, „1 Std. 20 Min“) → Sekunden
 * (bei Spannen der kleinere Wert, lieber früher nachsehen). Mehrere Angaben direkt hintereinander
 * werden addiert; sonst zählt die erste. Ohne Angabe: null.
 */
export function parseStepDuration(text: string): number | null {
  const matches = [...text.matchAll(DURATION)]
  if (matches.length === 0) return null
  const secs = (m: RegExpMatchArray) => {
    const unit = UNIT_S.find(([re]) => re.test(m[3]))
    return unit ? Number(m[1].replace(',', '.')) * unit[1] : 0
  }
  let total = secs(matches[0])
  // „1 Std. 20 Min“ / „2 Minuten 30 Sekunden“: direkt folgende, kleinere Einheit dazurechnen
  for (let i = 1; i < matches.length; i++) {
    const prev = matches[i - 1]
    const gap = text.slice((prev.index ?? 0) + prev[0].length, matches[i].index ?? 0)
    if (!/^\s*(?:und\s*)?$/i.test(gap)) break
    total += secs(matches[i])
  }
  total = Math.round(total)
  return total > 0 && total <= 24 * 3600 ? total : null
}

/** Timer-Anzeige: 75 → „1:15“, 3725 → „1:02:05“. */
export function fmtTimer(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Kurztext für den Timer-Knopf: 600 → „10 Min“, 30 → „30 Sek“, 5400 → „1 Std 30 Min“. */
export function fmtDurationShort(sec: number): string {
  if (sec < 60) return `${sec} Sek`
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m} Min`
  return m ? `${h} Std ${m} Min` : `${h} Std`
}
