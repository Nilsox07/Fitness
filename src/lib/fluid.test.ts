import { describe, expect, it } from 'vitest'
import { volumeFromName } from './fluid'

describe('volumeFromName', () => {
  it('liest Liter, ml, cl und Becher-Größen', () => {
    expect(volumeFromName('Coca-Cola 0,5 l')).toBe(500)
    expect(volumeFromName('Red Bull 250 ml')).toBe(250)
    expect(volumeFromName('Bier 33 cl')).toBe(330)
    expect(volumeFromName('Caffè Latte Grande (Halbfettmilch)')).toBe(473)
    expect(volumeFromName('Big Mac')).toBeNull()
  })
})
