import { describe, expect, it } from 'vitest'
import {
  bfCategory,
  bfChange,
  bfMid,
  bfRangeLabel,
  composition,
  katchMcArdle,
  photoDue,
  proteinFromLean,
  toBodyFatEstimate,
  type BodyScan,
} from './bodyScan'

const scan = (date: string, low: number | null, high: number | null, photo = true): BodyScan => ({
  id: date,
  user_id: 'u',
  date,
  photo_path: photo ? `u/${date}.jpg` : null,
  bf_low: low,
  bf_high: high,
  weight_kg: 80,
  confidence: 'mittel',
  source: 'ai',
  created_at: `${date}T08:00:00Z`,
})

describe('toBodyFatEstimate', () => {
  it('übernimmt einen sinnvollen Bereich', () => {
    expect(toBodyFatEstimate({ ok: true, low: 18, high: 22, confidence: 'hoch', hints: ['Mehr Licht'] })).toEqual({
      ok: true,
      low: 18,
      high: 22,
      confidence: 'hoch',
      hints: ['Mehr Licht'],
    })
  })
  it('vertauscht, verbreitert zu schmale und kappt zu breite Bereiche', () => {
    const swapped = toBodyFatEstimate({ low: '22', high: '18' })
    expect([swapped.low, swapped.high]).toEqual([18, 22])
    const narrow = toBodyFatEstimate({ low: 20, high: 20 })
    expect(narrow.high - narrow.low).toBe(2)
    const wide = toBodyFatEstimate({ low: 10, high: 30 })
    expect(wide.high - wide.low).toBe(8)
    expect(toBodyFatEstimate({ low: 15, high: 17, confidence: 'super' }).confidence).toBe('niedrig')
  })
  it('meldet unbrauchbare Fotos', () => {
    const r = toBodyFatEstimate({ ok: false, reason: 'Keine Person erkennbar' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('Keine Person erkennbar')
    expect(toBodyFatEstimate(null).ok).toBe(false)
  })
})

describe('Rechnungen', () => {
  it('Mitte, Label und Zusammensetzung', () => {
    expect(bfMid(scan('2026-01-01', 18, 22))).toBe(20)
    expect(bfRangeLabel(scan('2026-01-01', 18, 22))).toBe('18–22 %')
    expect(bfRangeLabel(scan('2026-01-01', 15, 15))).toBe('15 %')
    expect(composition(80, 20)).toEqual({ fatKg: 16, leanKg: 64 })
    expect(proteinFromLean(64)).toBe(140)
    expect(katchMcArdle(64)).toBe(1752)
  })
  it('Einordnung nach Geschlecht', () => {
    expect(bfCategory(12, 'm')).toBe('athletisch')
    expect(bfCategory(12, 'f')).toBe('sehr definiert')
    expect(bfCategory(30, 'm')).toBe('erhöht')
  })
  it('Veränderung und fälliges Vergleichsfoto', () => {
    const list = [scan('2026-01-01', 22, 26), scan('2026-03-01', 19, 23)]
    expect(bfChange(list)).toEqual({ delta: -3, days: 59 })
    expect(bfChange(list.slice(0, 1))).toBeNull()
    expect(photoDue(list, '2026-04-01')).toBe(false)
    expect(photoDue(list, '2026-04-26')).toBe(true)
    expect(photoDue([scan('2026-01-01', 20, 22, false)], '2026-12-01')).toBe(false)
  })
})
