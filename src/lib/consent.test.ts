import { describe, expect, it } from 'vitest'
import {
  CONSENT_VERSION,
  consentFromMeta,
  deleteConfirmed,
  hasValidConsent,
  makeConsent,
  normalizeConsent,
} from './consent'
import { normalizePrefs } from './userPrefs'

describe('Einwilligung', () => {
  it('neue Einwilligung hat aktuelle Version und Zeitpunkt', () => {
    const c = makeConsent(new Date('2026-11-02T10:00:00Z'))
    expect(c).toEqual({ version: CONSENT_VERSION, at: '2026-11-02T10:00:00.000Z' })
    expect(hasValidConsent(c)).toBe(true)
  })
  it('alte Version oder fehlend → erneut fragen', () => {
    expect(hasValidConsent(null)).toBe(false)
    expect(hasValidConsent({ version: '2020-01', at: '2020-01-01T00:00:00Z' })).toBe(false)
  })
  it('nur gültige Werte übernehmen', () => {
    expect(normalizeConsent({ version: '2026-11', at: 'gestern' })).toBeNull()
    expect(normalizeConsent({ version: 3, at: '2026-11-02T10:00:00Z' })).toBeNull()
    expect(normalizeConsent('ja')).toBeNull()
  })
  it('aus den Registrierungs-Metadaten', () => {
    const c = makeConsent()
    expect(consentFromMeta({ consent: c })).toEqual(c)
    expect(consentFromMeta({})).toBeNull()
    expect(consentFromMeta(null)).toBeNull()
  })
  it('in den Einstellungen: alte Caches ohne Feld → null', () => {
    expect(normalizePrefs({}).consent).toBeNull()
    const c = makeConsent()
    expect(normalizePrefs({ consent: c }).consent).toEqual(c)
    expect(normalizePrefs({ consent: { version: '' } }).consent).toBeNull()
  })
})

describe('Konto löschen bestätigen', () => {
  it('LÖSCHEN eintippen', () => {
    expect(deleteConfirmed('LÖSCHEN')).toBe(true)
    expect(deleteConfirmed(' löschen ')).toBe(true)
    expect(deleteConfirmed('loeschen')).toBe(false)
    expect(deleteConfirmed('')).toBe(false)
  })
})
