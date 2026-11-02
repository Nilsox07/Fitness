// Anonyme Nutzungs-Statistik (Tabelle `app_events`, Migration 0040).
//
// - pseudonym: user_hash = SHA-256 aus App-Salt + User-ID (im Gerät berechnet)
// - nur Funktions-Namen und kleine Merkmale (z. B. method: 'photo'), nie Gesundheitswerte
// - ohne Einwilligung passiert nichts; Fehler werden verschluckt
// - gesammelt und alle 10 s bzw. beim Verlassen der App gesendet
//
// Der Host (ConsentGate) ruft `initTracking` mit Hash, Einwilligung und Sender auf.

/** Gleicher Wert wie ANALYTICS_SALT in api/_account.js (Löschen beim Konto-Löschen). */
export const ANALYTICS_SALT = 'fitnessbuddy-events-v1'

export type FoodMethod = 'photo' | 'text' | 'search' | 'barcode' | 'manual' | 'recipe' | 'routine'

export type EventProps = Record<string, string | number | boolean>

export interface EventRow {
  user_hash: string
  name: string
  props: EventProps
  app_version: string | null
  platform: string | null
}

type Sender = (rows: EventRow[]) => Promise<unknown>

const FLUSH_MS = 10_000
const MAX_QUEUE = 100

/** Nur kurze, flache Werte durchlassen (max. 6 Schlüssel, Texte ≤ 40 Zeichen). */
export function sanitizeProps(props: unknown): EventProps {
  const out: EventProps = {}
  if (!props || typeof props !== 'object') return out
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (Object.keys(out).length >= 6) break
    if (!/^[a-z][a-z0-9_]{0,19}$/i.test(k)) continue
    if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100
    else if (typeof v === 'string' && v.length > 0) out[k] = v.slice(0, 40)
  }
  return out
}

export function validEventName(name: string): boolean {
  return /^[a-z][a-z0-9_]{0,39}$/.test(name)
}

/** SHA-256 (hex) aus Salt + User-ID. */
export async function hashUserId(userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${ANALYTICS_SALT}:${userId}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** app_open höchstens einmal pro Tag. */
export function shouldLogAppOpen(lastDay: string | null, today: string): boolean {
  return lastDay !== today
}

// ---------- Zustand ----------

let pending: { name: string; props: EventProps }[] = []
let state: { hash: string; send: Sender; version: string | null; platform: string | null } | null = null
/** null = noch unbekannt (Ereignisse puffern), false = keine Einwilligung (verwerfen) */
let enabled: boolean | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

/** Ereignis vermerken (No-op ohne Einwilligung). */
export function track(name: string, props?: Record<string, unknown>): void {
  try {
    if (enabled === false || !validEventName(name)) return
    if (pending.length >= MAX_QUEUE) pending.shift()
    pending.push({ name, props: sanitizeProps(props) })
    schedule()
  } catch {
    /* nie stören */
  }
}

/** KI-Funktion genutzt (nur der Name der Funktion). */
export function trackAi(feature: string): void {
  track('ai_used', { feature })
}

// Hinweis für „Essen eingetragen“: die Eingabeart (Foto, Text …) kennt nur die aufrufende Stelle.
let foodHint: { method: FoodMethod; at: number } | null = null

/** Merkt die Eingabeart für den nächsten Eintrag (gilt 15 min). */
export function hintFoodMethod(method: FoodMethod): void {
  foodHint = { method, at: Date.now() }
}

/** Eingabeart für einen gespeicherten Eintrag: zuletzt gemerkter Hinweis, sonst Barcode am Eintrag, sonst manuell. */
export function foodMethod(hasBarcode: boolean, now = Date.now()): FoodMethod {
  const h = foodHint
  if (h && now - h.at < 15 * 60 * 1000) return h.method
  return hasBarcode ? 'barcode' : 'manual'
}

/** Mit Einwilligung starten bzw. (ohne) alles verwerfen. */
export function initTracking(opts: {
  enabled: boolean
  hash?: string
  send?: Sender
  version?: string | null
  platform?: string | null
}): void {
  enabled = opts.enabled && !!opts.hash && !!opts.send
  if (!enabled) {
    pending = []
    state = null
    return
  }
  state = { hash: opts.hash!, send: opts.send!, version: opts.version ?? null, platform: opts.platform ?? null }
  if (!listening && typeof document !== 'undefined') {
    listening = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush()
    })
  }
  schedule()
}

/** Abmelden/Konto gelöscht: nichts mehr senden. */
export function stopTracking(): void {
  enabled = null
  state = null
  pending = []
}

function schedule() {
  if (timer || !state || !pending.length) return
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, FLUSH_MS)
}

/** Gesammelte Ereignisse senden (Fehler werden verworfen). */
export async function flush(): Promise<void> {
  if (!state || !pending.length) return
  const s = state
  const batch = pending
  pending = []
  try {
    await s.send(
      batch.map((e) => ({
        user_hash: s.hash,
        name: e.name,
        props: e.props,
        app_version: s.version,
        platform: s.platform,
      })),
    )
  } catch {
    /* verwerfen */
  }
}
