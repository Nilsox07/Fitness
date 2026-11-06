// Gewichts-Leiter: real wählbare Gewichte eines Geräts (für ungleichmäßige Stacks).
// Eingabe als Text, getrennt durch Leerzeichen/Semikolon; Dezimal-Komma erlaubt (z. B. "2,5 5 7,5").

const round1 = (n: number) => Math.round(n * 10) / 10

function parseNums(text: string): number[] {
  const nums = text
    .split(/[\s;]+/)
    .map((t) => parseFloat(t.trim().replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  return [...new Set(nums)].sort((a, b) => a - b)
}

/**
 * Gespeicherter Text → Grundstufen + Zusatzgewichte. Format: „5 10 15 | 2.5 5 7.5“ – rechts vom
 * Strich die Zusatzgewichte, von denen man an der Maschine EINES auf eine Stufe legen kann.
 */
export function splitLadder(text: string | null | undefined): { base: number[]; addons: number[] } {
  if (!text) return { base: [], addons: [] }
  const [b, a = ''] = text.split('|')
  return { base: parseNums(b), addons: parseNums(a) }
}

/** Grundstufen + je ein Zusatzgewicht obendrauf (oder keins) → alle wählbaren Gewichte. */
export function withAddons(base: number[], addons: number[]): number[] {
  const out = new Set<number>()
  for (const b of base) {
    out.add(round1(b))
    for (const a of addons) out.add(round1(b + a))
  }
  return [...out].sort((x, y) => x - y)
}

/** Text → sortierte, eindeutige Liste aller wählbaren Gewichte (inkl. Zusatzgewichte). Leer bei ungültig. */
export function parseLadder(text: string | null | undefined): number[] {
  const { base, addons } = splitLadder(text)
  return addons.length ? withAddons(base, addons) : base
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

/**
 * Eine Stufe korrigieren (z. B. ein unregelmäßiger Sprung an der Maschine). `shiftRest`: alle
 * folgenden Stufen um dieselbe Differenz mitverschieben – passt, wenn ab hier alles versetzt ist.
 * Ergebnis bleibt sortiert und ohne Doppelte; 0 oder weniger entfernt die Stufe.
 */
export function editLadderStep(ladder: number[], index: number, value: number, shiftRest: boolean): number[] {
  if (index < 0 || index >= ladder.length || !Number.isFinite(value)) return ladder
  if (value <= 0) return ladder.filter((_, i) => i !== index)
  const delta = value - ladder[index]
  const next = ladder.map((v, i) => (i === index ? value : shiftRest && i > index ? v + delta : v))
  return [...new Set(next.map(round2).filter((v) => v > 0))].sort((a, b) => a - b)
}

/** Stufe ergänzen (z. B. eine fehlende Zwischenstufe). */
export function addLadderStep(ladder: number[], value: number): number[] {
  if (!Number.isFinite(value) || value <= 0) return ladder
  return [...new Set([...ladder, round2(value)])].sort((a, b) => a - b)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Grundstufen (+ Zusatzgewichte) → Text fürs Speichern. */
export function ladderText(ladder: number[], addons: number[] = []): string | null {
  if (!ladder.length) return null
  const base = ladder.map((v) => String(round2(v))).join(' ')
  return addons.length ? `${base} | ${addons.map((v) => String(round2(v))).join(' ')}` : base
}
