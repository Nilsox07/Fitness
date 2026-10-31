import { describe, expect, it } from 'vitest'
import { mergePeriods } from './cyclePeriods'

const TODAY = '2026-10-31'

describe('mergePeriods', () => {
  it('liefert leere Liste ohne Daten', () => {
    expect(mergePeriods([], [], TODAY)).toEqual([])
    expect(mergePeriods(undefined, null, TODAY)).toEqual([])
  })

  it('übernimmt ausdrückliche Perioden sortiert', () => {
    expect(
      mergePeriods(
        [
          { start: '2026-09-28', end: '2026-10-02' },
          { start: '2026-08-31', end: '2026-09-04' },
        ],
        [],
        TODAY,
      ),
    ).toEqual([
      { start_date: '2026-08-31', end_date: '2026-09-04' },
      { start_date: '2026-09-28', end_date: '2026-10-02' },
    ])
  })

  it('leitet Perioden aus Blutungstagen ab (Lücke ≤ 2 Tage = dieselbe)', () => {
    const flow = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-09', '2026-10-10']
    expect(mergePeriods([], flow, TODAY)).toEqual([
      { start_date: '2026-10-01', end_date: '2026-10-05' },
      { start_date: '2026-10-09', end_date: '2026-10-10' },
    ])
  })

  it('führt Perioden und Blutungstage zusammen (frühester Start, spätestes Ende)', () => {
    expect(
      mergePeriods(
        [{ start: '2026-10-02', end: '2026-10-04' }],
        ['2026-10-01', '2026-10-02', '2026-10-06', '2026-10-03'],
        TODAY,
      ),
    ).toEqual([{ start_date: '2026-10-01', end_date: '2026-10-06' }])
  })

  it('entfernt Doppelte und überlappende Perioden', () => {
    expect(
      mergePeriods(
        [
          { start: '2026-10-01', end: '2026-10-05' },
          { start: '2026-10-01', end: '2026-10-05' },
          { start: '2026-10-03', end: '2026-10-07' },
        ],
        [],
        TODAY,
      ),
    ).toEqual([{ start_date: '2026-10-01', end_date: '2026-10-07' }])
  })

  it('ignoriert zukünftige Daten und ungültige Einträge', () => {
    expect(
      mergePeriods(
        [
          { start: '2026-11-05', end: '2026-11-08' },
          { start: 'kaputt', end: null },
        ],
        ['2026-11-02', 'x', '2026-10-20'],
        TODAY,
      ),
    ).toEqual([{ start_date: '2026-10-20', end_date: '2026-10-20' }])
  })

  it('offene oder in die Zukunft reichende Periode läuft noch (end null)', () => {
    expect(mergePeriods([{ start: '2026-10-29', end: null }], ['2026-10-30'], TODAY)).toEqual([
      { start_date: '2026-10-29', end_date: null },
    ])
    expect(mergePeriods([{ start: '2026-10-30', end: '2026-11-03' }], [], TODAY)).toEqual([
      { start_date: '2026-10-30', end_date: null },
    ])
  })

  it('ältere offene Periode verschluckt keine späteren', () => {
    expect(
      mergePeriods(
        [
          { start: '2026-08-01', end: null },
          { start: '2026-09-01', end: '2026-09-05' },
        ],
        [],
        TODAY,
      ),
    ).toEqual([
      { start_date: '2026-08-01', end_date: '2026-08-01' },
      { start_date: '2026-09-01', end_date: '2026-09-05' },
    ])
  })

  it('funktioniert über Monats- und Jahresgrenzen', () => {
    expect(mergePeriods([], ['2025-12-30', '2025-12-31', '2026-01-02'], TODAY)).toEqual([
      { start_date: '2025-12-30', end_date: '2026-01-02' },
    ])
  })
})
