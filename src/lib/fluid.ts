// Flüssigkeit aus Getränken (ml pro Ernährungseintrag). Zählt zusätzlich zur
// Trinkmenge. Gespeichert in food_entries.fluid_ml (Migration 0029); solange
// die Spalte fehlt, lokal im Gerät (Fallback), damit nichts verloren geht.

const FALLBACK_KEY = 'fluid_fallback'

function readFallback(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function rememberFluid(entryId: string, ml: number): void {
  if (!(ml > 0)) return
  try {
    const m = readFallback()
    m[entryId] = Math.round(ml)
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/** Flüssigkeit eines Eintrags in ml (DB-Spalte oder lokaler Fallback). */
export function fluidOf(e: { id: string; fluid_ml?: number | null }): number {
  if (e.fluid_ml != null) return Math.max(0, Number(e.fluid_ml) || 0)
  return readFallback()[e.id] ?? 0
}

/** Summe der Getränke-Flüssigkeit mehrerer Einträge. */
export function fluidTotal(entries: readonly { id: string; fluid_ml?: number | null }[]): number {
  return entries.reduce((s, e) => s + fluidOf(e), 0)
}

/** Fehlt die Spalte fluid_ml (Migration 0029 noch nicht ausgeführt)? */
export function isMissingFluidColumn(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  return e.code === 'PGRST204' || e.code === '42703' || /fluid_ml/.test(e.message ?? '')
}

const SIZES: Record<string, number> = { short: 236, tall: 354, grande: 473, venti: 591 }

/** Volumen aus einem Getränkenamen lesen: „Cola 0,5 l", „330 ml", „Latte Grande". */
export function volumeFromName(name: string): number | null {
  const s = name.toLowerCase()
  const ml = /(\d+(?:[.,]\d+)?)\s*ml\b/.exec(s)
  if (ml) return Math.round(parseFloat(ml[1].replace(',', '.')))
  const cl = /(\d+(?:[.,]\d+)?)\s*cl\b/.exec(s)
  if (cl) return Math.round(parseFloat(cl[1].replace(',', '.')) * 10)
  const l = /(\d+(?:[.,]\d+)?)\s*(?:l|liter)\b/.exec(s)
  if (l) return Math.round(parseFloat(l[1].replace(',', '.')) * 1000)
  for (const [k, v] of Object.entries(SIZES)) if (new RegExp(`\\b${k}\\b`).test(s)) return v
  return null
}
