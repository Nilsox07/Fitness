// Reine Logik für „Konto & Daten löschen“ (api/account/delete.js).
//
// Alle App-Tabellen mit Nutzerbezug verweisen per `on delete cascade` auf auth.users
// (geprüft für Migration 0001–0040) – das Löschen des Auth-Nutzers entfernt sie mit.
// Nicht per Fremdschlüssel verbunden sind nur:
//   - Dateien im Storage (Körperfotos), Ordner `<user_id>/…`
//   - anonyme Nutzungs-Ereignisse (`app_events`, pseudonym über user_hash)

/** Storage-Buckets mit Nutzer-Ordnern (`<user_id>/<datei>`). */
export const USER_BUCKETS = ['body-photos']

/** Fester App-Salt für den pseudonymen Nutzer-Hash (gleicher Wert wie in src/lib/track.ts). */
export const ANALYTICS_SALT = 'fitnessbuddy-events-v1'

/** Text, aus dem der Nutzer-Hash (SHA-256, hex) gebildet wird. */
export function analyticsHashInput(userId) {
  return `${ANALYTICS_SALT}:${userId}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v) {
  return typeof v === 'string' && UUID.test(v)
}

/**
 * Pfade zum Löschen aus einer Storage-Auflistung des Ordners `<userId>/`.
 * Nur echte Dateien (Unterordner haben keine id) und nie außerhalb des eigenen Ordners.
 */
export function storagePaths(userId, files) {
  if (!isUuid(userId) || !Array.isArray(files)) return []
  return files
    .filter((f) => f && typeof f.name === 'string' && f.name && f.id != null && !f.name.includes('/'))
    .map((f) => `${userId}/${f.name}`)
}
