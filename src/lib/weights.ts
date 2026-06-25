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
