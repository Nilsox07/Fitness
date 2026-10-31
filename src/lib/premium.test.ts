import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  aiGateState,
  getTestFree,
  isPremium,
  resolvePremium,
  setBillingEntitlement,
  setTestFree,
  TEST_FREE_KEY,
} from './premium'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage
})

describe('Buddy Plus', () => {
  afterEach(() => {
    setBillingEntitlement(null)
    setTestFree(false)
  })

  it('ohne Abrechnung sind alle Plus, Test-Schalter schaltet ab', () => {
    expect(resolvePremium({ billing: null, testFree: false })).toBe(true)
    expect(resolvePremium({ billing: null, testFree: true })).toBe(false)
    expect(resolvePremium({ billing: true, testFree: true })).toBe(false)
    expect(resolvePremium({ billing: false, testFree: false })).toBe(false)
    expect(resolvePremium({ billing: true, testFree: false })).toBe(true)
  })

  it('KI-Sperre: nur gesperrt, wenn die KI da ist', () => {
    expect(aiGateState(true, true)).toEqual({ canUse: true, locked: false })
    expect(aiGateState(true, false)).toEqual({ canUse: false, locked: true })
    expect(aiGateState(false, true)).toEqual({ canUse: false, locked: false })
    expect(aiGateState(false, false)).toEqual({ canUse: false, locked: false })
  })

  it('Test-Schalter wird gemerkt', () => {
    expect(isPremium()).toBe(true)
    setTestFree(true)
    expect(getTestFree()).toBe(true)
    expect(localStorage.getItem(TEST_FREE_KEY)).toBe('1')
    expect(isPremium()).toBe(false)
    setTestFree(false)
    expect(isPremium()).toBe(true)
  })

  it('Abo aus der Abrechnung', () => {
    setBillingEntitlement(false)
    expect(isPremium()).toBe(false)
    setBillingEntitlement(true)
    expect(isPremium()).toBe(true)
  })
})
