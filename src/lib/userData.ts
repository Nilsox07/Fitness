// Beim Abmelden bzw. Kontowechsel alle Daten des bisherigen Nutzers vom Gerät
// entfernen: Query-Cache (auch der persistierte), offene Schreibvorgänge und
// nutzerbezogene localStorage-Einträge. Geräte-Einstellungen (Theme, Akzent,
// App-Modus, Pausen-Timer …) bleiben erhalten.

import { PERSIST_KEY, queryClient } from './queryClient'
import { disablePushOnThisDevice } from './push'
import { supabase } from './supabase'

/** Zuletzt angemeldete User-ID (erkennt Kontowechsel). */
export const LAST_USER_KEY = 'last_user_id'

/** Exakte nutzerbezogene Schlüssel. */
const USER_KEYS = [
  'weekly_review',
  'weekly_review_seen',
  'pr_celebrated',
  'seen_level',
  'seen_nutrition_level',
  'shopping_checked',
  'diet_avoid',
]

/** Nutzerbezogene Präfixe (pro Workout / Übung / Tag). */
const USER_PREFIXES = ['wo_', 'rest_ex_', 'quests_done_', 'feed_workout_', 'weekly_review', 'shopping_checked']

export function isUserKey(key: string): boolean {
  return USER_KEYS.includes(key) || USER_PREFIXES.some((p) => key.startsWith(p))
}

/** Cache + nutzerbezogene lokale Daten löschen. */
export function clearUserData() {
  try {
    queryClient.cancelQueries()
    queryClient.getMutationCache().clear()
    queryClient.clear()
  } catch {
    /* ignore */
  }
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    for (const k of keys) if (k === PERSIST_KEY || isUserKey(k)) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function getLastUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export function setLastUserId(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_USER_KEY, id)
    else localStorage.removeItem(LAST_USER_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Abmelden: zuerst das Push-Abo dieses Geräts entfernen (sonst bekäme der
 * nächste Nutzer am Gerät die Pushes des alten Kontos), dann ausloggen.
 * Das Leeren der Daten übernimmt der SIGNED_OUT-Handler in `auth.tsx`.
 */
export async function signOut(): Promise<void> {
  await disablePushOnThisDevice()
  try {
    await supabase.auth.signOut()
  } catch {
    /* ignore – lokal wird trotzdem aufgeräumt */
  } finally {
    // Auch wenn der Server nicht erreichbar war: lokal alles weg.
    clearUserData()
    setLastUserId(null)
  }
}
