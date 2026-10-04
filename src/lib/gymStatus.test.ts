import { describe, expect, it } from 'vitest'
import { encodeGymStatus, parseGymStatus } from './gymStatus'

describe('gymStatus', () => {
  it('kodiert Datum + Text', () => {
    expect(encodeGymStatus(' heute 18 Uhr ', '2026-10-04')).toBe('2026-10-04|heute 18 Uhr')
    expect(encodeGymStatus('   ', '2026-10-04')).toBe('')
  })

  it('liest neue und alte Werte', () => {
    expect(parseGymStatus('2026-10-04|heute 18 Uhr')).toEqual({ date: '2026-10-04', text: 'heute 18 Uhr' })
    expect(parseGymStatus('heute 18 Uhr')).toEqual({ date: null, text: 'heute 18 Uhr' })
    expect(parseGymStatus(null)).toEqual({ date: null, text: '' })
    expect(parseGymStatus('2026-10-04|')).toEqual({ date: '2026-10-04', text: '' })
  })
})
