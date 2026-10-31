import { beforeEach, describe, expect, it } from 'vitest'
import { _resetNav, historyIndex, previousNav, recordNav } from './navHistory'

describe('Zurück-Verlauf', () => {
  beforeEach(() => _resetNav())

  it('liefert die Seite, von der man kam', () => {
    recordNav(0, { pathname: '/profile', search: '' })
    recordNav(1, { pathname: '/plans', search: '?rhythm=1' })
    expect(previousNav(1, { pathname: '/plans', search: '?rhythm=1' })).toEqual({ pathname: '/profile', search: '' })
  })

  it('ohne Vorgänger (Direktaufruf) → null, alte Zukunft wird verworfen', () => {
    expect(previousNav(0, { pathname: '/plans', search: '' })).toBeNull()
    recordNav(0, { pathname: '/today', search: '' })
    recordNav(1, { pathname: '/profile', search: '' })
    recordNav(2, { pathname: '/plans', search: '' })
    recordNav(1, { pathname: '/social', search: '' })
    expect(previousNav(3, { pathname: '/x', search: '' })).toBeNull()
  })

  it('liest den Index robust', () => {
    expect(historyIndex({ idx: 4 })).toBe(4)
    expect(historyIndex(null)).toBe(0)
  })
})
