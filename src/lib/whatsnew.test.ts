import { describe, expect, it } from 'vitest'
import { shouldShowWhatsNew } from './whatsnew'

describe('Was ist neu?', () => {
  const base = { onboarded: true, version: '2.1' }
  it('nach einem Update auf diesem Gerät', () => {
    expect(shouldShowWhatsNew({ ...base, local: '2.0', remote: null })).toBe(true)
  })
  it('nicht auf einem frischen Gerät', () => {
    expect(shouldShowWhatsNew({ ...base, local: null, remote: null })).toBe(false)
  })
  it('nicht, wenn schon auf einem anderen Gerät gesehen', () => {
    expect(shouldShowWhatsNew({ ...base, local: '2.0', remote: '2.1' })).toBe(false)
  })
  it('nicht vor dem Intro und nicht doppelt', () => {
    expect(shouldShowWhatsNew({ ...base, onboarded: false, local: '2.0', remote: null })).toBe(false)
    expect(shouldShowWhatsNew({ ...base, local: '2.1', remote: null })).toBe(false)
  })
})
