import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetBackStack, backStackSize, handleBack, pushBack } from './backStack'

describe('backStack', () => {
  beforeEach(() => _resetBackStack())

  it('ohne Handler: nichts abgefangen', () => {
    expect(handleBack()).toBe(false)
  })

  it('ruft nur den obersten Handler', () => {
    const a = vi.fn()
    const b = vi.fn()
    pushBack(a)
    pushBack(b)
    expect(handleBack()).toBe(true)
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
  })

  it('entfernen gibt den darunterliegenden frei, auch außer der Reihe', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = pushBack(a)
    const offB = pushBack(b)
    offA()
    expect(backStackSize()).toBe(1)
    handleBack()
    expect(b).toHaveBeenCalled()
    offB()
    offB()
    expect(backStackSize()).toBe(0)
    expect(handleBack()).toBe(false)
  })
})
