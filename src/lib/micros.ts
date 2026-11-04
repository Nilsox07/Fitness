// Vitamine & Mineralstoffe: von der KI je Lebensmittel geschätzt (bzw. aus Open Food Facts),
// pro Tag aufsummiert und mit den Referenzwerten der DGE (Erwachsene) verglichen.
// Alles Schätzwerte – die App zeigt sie als Orientierung, nicht als Laborwert.
// Reine Logik – getestet in micros.test.ts.

export const MICRO_KEYS = [
  'vit_c',
  'vit_d',
  'vit_b12',
  'folate',
  'iron',
  'calcium',
  'magnesium',
  'zinc',
  'potassium',
] as const
export type MicroKey = (typeof MICRO_KEYS)[number]
export type Micros = Partial<Record<MicroKey, number>>

export interface MicroInfo {
  label: string
  unit: 'mg' | 'µg'
  /** Referenzwert pro Tag: [Mann, Frau] (DGE) */
  ref: [number, number]
  /** Plausible Obergrenze je Lebensmittel-Portion (schützt vor KI-Ausreißern) */
  max: number
  /** wofür (kurz, für das (i)) */
  why: string
  /** Gute Quellen (kurz) */
  sources: string
}

export const MICRO_INFO: Record<MicroKey, MicroInfo> = {
  vit_c: {
    label: 'Vitamin C',
    unit: 'mg',
    ref: [110, 95],
    max: 1000,
    why: 'Immunsystem, Bindegewebe',
    sources: 'Paprika, Zitrusfrüchte, Brokkoli, Beeren',
  },
  vit_d: {
    label: 'Vitamin D',
    unit: 'µg',
    ref: [20, 20],
    max: 100,
    why: 'Knochen, Muskeln – kommt vor allem über Sonne',
    sources: 'Fetter Fisch, Eier, Pilze',
  },
  vit_b12: {
    label: 'Vitamin B12',
    unit: 'µg',
    ref: [4, 4],
    max: 100,
    why: 'Blutbildung, Nerven',
    sources: 'Fleisch, Fisch, Milchprodukte, Eier',
  },
  folate: {
    label: 'Folat',
    unit: 'µg',
    ref: [300, 300],
    max: 1500,
    why: 'Zellteilung, Blutbildung',
    sources: 'Blattgemüse, Hülsenfrüchte, Vollkorn',
  },
  iron: {
    label: 'Eisen',
    unit: 'mg',
    ref: [11, 15],
    max: 60,
    why: 'Sauerstofftransport, Leistung',
    sources: 'Fleisch, Hülsenfrüchte, Haferflocken',
  },
  calcium: {
    label: 'Calcium',
    unit: 'mg',
    ref: [1000, 1000],
    max: 2500,
    why: 'Knochen, Muskelarbeit',
    sources: 'Milchprodukte, Käse, Mineralwasser, Grünkohl',
  },
  magnesium: {
    label: 'Magnesium',
    unit: 'mg',
    ref: [350, 300],
    max: 1000,
    why: 'Muskeln, Nerven, Energie',
    sources: 'Nüsse, Vollkorn, Hülsenfrüchte',
  },
  zinc: {
    label: 'Zink',
    unit: 'mg',
    ref: [14, 8],
    max: 60,
    why: 'Immunsystem, Regeneration',
    sources: 'Fleisch, Käse, Haferflocken, Kürbiskerne',
  },
  potassium: {
    label: 'Kalium',
    unit: 'mg',
    ref: [4000, 4000],
    max: 6000,
    why: 'Muskeln, Blutdruck',
    sources: 'Kartoffeln, Bananen, Hülsenfrüchte, Gemüse',
  },
}

/** Robust lesen (KI/DB): nur bekannte Schlüssel, Zahlen ≥ 0, Ausreißer gekappt. null = nichts Brauchbares. */
export function normalizeMicros(raw: unknown): Micros | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out: Micros = {}
  for (const k of MICRO_KEYS) {
    const n = typeof r[k] === 'number' ? (r[k] as number) : Number(r[k])
    if (!Number.isFinite(n) || n < 0) continue
    const v = Math.min(n, MICRO_INFO[k].max)
    out[k] = Math.round(v * 10) / 10
  }
  return Object.keys(out).length ? out : null
}

export function scaleMicros(m: Micros | null | undefined, f: number): Micros | null {
  if (!m) return null
  const out: Micros = {}
  for (const k of MICRO_KEYS) if (m[k] != null) out[k] = Math.round(m[k]! * f * 10) / 10
  return out
}

export interface MicroRow {
  key: MicroKey
  label: string
  unit: string
  amount: number
  target: number
  /** 0–… (1 = Referenzwert erreicht) */
  share: number
}

export interface MicroDay {
  rows: MicroRow[]
  /** Anteil der kcal des Tages aus Einträgen MIT Vitamin-Daten (0–1) */
  coverage: number
}

/**
 * Tagessumme gegen die Referenz. `sex` = 'f' nimmt die Frauen-Werte, sonst Männer.
 * Ohne einen einzigen Eintrag mit Daten: null.
 */
export function microDay(
  entries: readonly { kcal: number; micros?: Micros | null }[],
  sex: 'm' | 'f' | null,
): MicroDay | null {
  const withData = entries.filter((e) => e.micros && Object.keys(e.micros).length)
  if (withData.length === 0) return null
  const totalKcal = entries.reduce((s, e) => s + Math.max(0, e.kcal), 0)
  const dataKcal = withData.reduce((s, e) => s + Math.max(0, e.kcal), 0)
  const idx = sex === 'f' ? 1 : 0
  const rows = MICRO_KEYS.map((k) => {
    const amount = withData.reduce((s, e) => s + (e.micros?.[k] ?? 0), 0)
    const target = MICRO_INFO[k].ref[idx]
    return {
      key: k,
      label: MICRO_INFO[k].label,
      unit: MICRO_INFO[k].unit,
      amount: Math.round(amount * 10) / 10,
      target,
      share: target > 0 ? amount / target : 0,
    }
  })
  return { rows, coverage: totalKcal > 0 ? Math.min(1, dataKcal / totalKcal) : 1 }
}

/** Die knappsten Werte (für einen kurzen Hinweis), ohne Vitamin D (kommt v. a. über Sonne). */
export function lowest(day: MicroDay, n = 2, below = 0.5): MicroRow[] {
  return [...day.rows]
    .filter((r) => r.key !== 'vit_d' && r.share < below)
    .sort((a, b) => a.share - b.share)
    .slice(0, n)
}

export function fmtMicro(v: number, unit: string): string {
  const d = v >= 100 ? 0 : v >= 10 ? 0 : 1
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: d })} ${unit}`
}

/** Schlüssel-Liste für den KI-Prompt. */
export const MICRO_PROMPT =
  '"micros":{"vit_c":<mg>,"vit_d":<µg>,"vit_b12":<µg>,"folate":<µg>,"iron":<mg>,"calcium":<mg>,' +
  '"magnesium":<mg>,"zinc":<mg>,"potassium":<mg>}'
