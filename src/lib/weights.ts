// Gewichts-Leiter: real wählbare Gewichte eines Geräts (für ungleichmäßige Stacks).
// Eingabe als Text, getrennt durch Leerzeichen/Semikolon; Dezimal-Komma erlaubt (z. B. "2,5 5 7,5").

const round1 = (n: number) => Math.round(n * 10) / 10

/** Text → sortierte, eindeutige Gewichtsliste. Leer bei ungültig. */
export function parseLadder(text: string | null | undefined): number[] {
  if (!text) return []
  const nums = text
    .split(/[\s;]+/)
    .map((t) => parseFloat(t.trim().replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  return [...new Set(nums)].sort((a, b) => a - b)
}

/** Nächstgelegenes Gewicht auf der Leiter. */
export function snapToLadder(value: number, ladder: number[]): number {
  if (ladder.length === 0) return value
  return ladder.reduce((best, w) => (Math.abs(w - value) < Math.abs(best - value) ? w : best))
}

/** Einen Schritt entlang der Leiter (dir +1/-1) ausgehend vom nächstgelegenen Wert. */
export function ladderStep(value: number, ladder: number[], dir: number): number {
  if (ladder.length === 0) return value
  const nearest = snapToLadder(value, ladder)
  const idx = ladder.indexOf(nearest)
  const next = Math.min(ladder.length - 1, Math.max(0, idx + (dir >= 0 ? 1 : -1)))
  return ladder[next]
}

/**
 * Erzeugt eine Leiter aus Start + sich wiederholendem Zuwachs-Muster bis max.
 * z. B. start=4, pattern=[5,4], max=30 → 4, 9, 13, 18, 22, 27
 */
export function generateLadder(start: number, pattern: number[], max: number): number[] {
  if (!(start > 0) || pattern.length === 0 || !(max > start)) return []
  const out = [round1(start)]
  let cur = start
  let i = 0
  // Sicherheits-Limit gegen Endlosschleifen
  for (let guard = 0; guard < 1000; guard++) {
    const inc = pattern[i % pattern.length]
    if (!(inc > 0)) break
    cur += inc
    if (cur > max + 1e-9) break
    out.push(round1(cur))
    i++
  }
  return out
}

/**
 * Alle erreichbaren Summen aus Teilmengen der Zusatzgewichte – inkl. 0 (nichts drauf).
 * z. B. [2.5, 5, 7] → 0, 2.5, 5, 7, 7.5, 9.5, 12, 14.5
 */
export function subsetSums(addons: number[]): number[] {
  const clean = addons.filter((n) => Number.isFinite(n) && n > 0)
  const sums = new Set<number>([0])
  for (const a of clean) {
    for (const s of [...sums]) sums.add(round1(s + a))
  }
  return [...sums].sort((x, y) => x - y)
}

/**
 * Verfeinert eine Basis-Leiter, indem auf jedes Basisgewicht jede Kombination
 * der Zusatzgewichte gelegt werden kann. Ergebnis: sortiert & eindeutig.
 * z. B. base=[13,18], addons=[2.5,5] → 13, 15.5, 18, 20.5, 23, 25.5
 */
export function expandWithAddons(base: number[], addons: number[]): number[] {
  const extras = subsetSums(addons)
  if (extras.length <= 1) return [...base].sort((x, y) => x - y)
  const out = new Set<number>()
  for (const b of base) {
    for (const e of extras) out.add(round1(b + e))
  }
  return [...out].sort((x, y) => x - y)
}
