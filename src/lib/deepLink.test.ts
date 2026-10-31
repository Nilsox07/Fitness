import { describe, expect, it } from 'vitest'
import { claimDeepLink, deepLinkRoute, launchRoute, markDeepLinkHandled, recentDeepLink } from './deepLink'

describe('deepLinkRoute', () => {
  it('liest Pfad und Query', () => {
    expect(deepLinkRoute('fitnessbuddy://open/nutrition')).toBe('/nutrition')
    expect(deepLinkRoute('fitnessbuddy://open/share?text=a%20b')).toBe('/share?text=a%20b')
  })
  it('ohne Pfad → Heute', () => {
    expect(deepLinkRoute('fitnessbuddy://open')).toBe('/today')
  })
  it('fremde URLs ignorieren', () => {
    expect(deepLinkRoute('https://example.com/x')).toBeNull()
    expect(deepLinkRoute(undefined)).toBeNull()
  })
})

describe('recentDeepLink', () => {
  it('nur kurz nach einem Deep Link', () => {
    expect(recentDeepLink(1000)).toBe(false)
    markDeepLinkHandled(10_000)
    expect(recentDeepLink(12_000)).toBe(true)
    expect(recentDeepLink(20_000)).toBe(false)
  })
  it('im Browser keine Start-Route', async () => {
    expect(await launchRoute()).toBeNull()
  })
})

describe('claimDeepLink', () => {
  it('denselben Link kurz hintereinander nur einmal öffnen', () => {
    expect(claimDeepLink('/nutrition', 100_000)).toBe(true)
    expect(claimDeepLink('/nutrition', 101_000)).toBe(false)
    expect(claimDeepLink('/today', 101_500)).toBe(true)
    expect(claimDeepLink('/today', 110_000)).toBe(true)
  })
})
