import { describe, expect, it } from 'vitest'
import { getTipPage, parsePos, setTipPage, snapPos } from './buddyFloat'

describe('Schwebender Buddy', () => {
  it('schnappt an den näheren Rand und begrenzt die Höhe', () => {
    expect(snapPos(50, 120, 390, 400)).toEqual({ side: 'left', bottom: 120 })
    expect(snapPos(300, -20, 390, 400)).toEqual({ side: 'right', bottom: 0 })
    expect(snapPos(300, 900, 390, 400)).toEqual({ side: 'right', bottom: 400 })
  })

  it('liest gespeicherte Positionen robust', () => {
    expect(parsePos(null)).toEqual({ side: 'right', bottom: 0 })
    expect(parsePos('{"side":"left","bottom":80}')).toEqual({ side: 'left', bottom: 80 })
    expect(parsePos('kaputt')).toEqual({ side: 'right', bottom: 0 })
  })

  it('merkt sich die Tipp-Seite', () => {
    setTipPage('today')
    expect(getTipPage()).toBe('today')
    setTipPage(null)
    expect(getTipPage()).toBeNull()
  })
})
