// Feedback & Problem melden (Tabelle `feedback`, Migration 0040). Reine Logik.

export type FeedbackKind = 'idea' | 'missing' | 'problem'

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; placeholder: string }[] = [
  { id: 'idea', label: 'Idee', placeholder: 'Was wäre cool?' },
  { id: 'missing', label: 'Fehlt mir', placeholder: 'Was vermisst du?' },
  { id: 'problem', label: 'Problem', placeholder: 'Was ist passiert? Was hast du davor gemacht?' },
]

export const FEEDBACK_MAX_CHARS = 2000
/** Data-URL-Länge für ≈ 300 KB JPEG (Base64 ≈ 4/3 der Bytes). */
export const SCREENSHOT_MAX_CHARS = 400_000

export interface FeedbackMeta {
  version: string
  platform: string
  route: string
  lang: string | null
}

/** Route ohne Query/Hash (keine Suchbegriffe oder Daten mitschicken). */
export function cleanRoute(pathname: string): string {
  const p = (pathname || '/').split(/[?#]/)[0]
  // IDs in Pfaden (z. B. /cardio/<uuid>) unkenntlich machen
  return p.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').slice(0, 80) || '/'
}

export function feedbackMeta(o: { version: string; platform: string; pathname: string; lang?: string | null }) {
  return {
    version: o.version.slice(0, 20),
    platform: o.platform.slice(0, 20),
    route: cleanRoute(o.pathname),
    lang: o.lang ? o.lang.slice(0, 10) : null,
  } satisfies FeedbackMeta
}

/** Darf gesendet werden? (Text vorhanden, nicht zu lang, Bild klein genug) */
export function canSendFeedback(text: string, screenshot: string | null): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= FEEDBACK_MAX_CHARS && (!screenshot || screenshot.length <= SCREENSHOT_MAX_CHARS)
}
