// Einwilligung (Art. 9 DSGVO, Gesundheitsdaten) + Altersbestätigung 18+.
// Gespeichert in `profiles.prefs.consent` mit Version und Zeitpunkt. Ändert sich der
// Text wesentlich, CONSENT_VERSION erhöhen → alle sehen die Abfrage einmal neu.

export const CONSENT_VERSION = '2026-11'

export const CONSENT_TEXT =
  'Ich bin mindestens 18 Jahre alt und stimme der Datenschutzerklärung und der Verarbeitung meiner Gesundheitsdaten (z. B. Gewicht, Training, Ernährung, Uhr-Daten) zu.'

export interface Consent {
  version: string
  /** ISO-Zeitpunkt der Zustimmung */
  at: string
}

/** Beliebiger Wert → gültige Einwilligung oder null. */
export function normalizeConsent(v: unknown): Consent | null {
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  if (typeof c.version !== 'string' || !c.version || c.version.length > 20) return null
  if (typeof c.at !== 'string' || c.at.length > 40 || Number.isNaN(Date.parse(c.at))) return null
  return { version: c.version, at: c.at }
}

/** Neue Einwilligung für jetzt. */
export function makeConsent(now = new Date()): Consent {
  return { version: CONSENT_VERSION, at: now.toISOString() }
}

/** Gilt die gespeicherte Einwilligung für die aktuelle Version? */
export function hasValidConsent(c: Consent | null | undefined): boolean {
  return !!c && c.version === CONSENT_VERSION
}

/** Bei der Registrierung abgegebene Einwilligung (Auth-Metadaten) – wird beim ersten Start übernommen. */
export function consentFromMeta(meta: unknown): Consent | null {
  if (!meta || typeof meta !== 'object') return null
  return normalizeConsent((meta as Record<string, unknown>).consent)
}

/** Wort, das man zum Konto-Löschen eintippt. */
export const DELETE_WORD = 'LÖSCHEN'

/** Eingabe-Bestätigung: Groß-/Kleinschreibung und Leerzeichen egal. */
export function deleteConfirmed(input: string): boolean {
  return input.trim().toLocaleUpperCase('de-DE') === DELETE_WORD
}
