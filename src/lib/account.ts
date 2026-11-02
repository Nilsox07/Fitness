// Konto & Daten löschen: Server löscht Auth-Nutzer, Tabellen (cascade) und Körperfotos
// (api/account/delete.js). Danach lokal abmelden und alles vom Gerät entfernen.

import { apiUrl } from './native'
import { supabase } from './supabase'
import { clearUserData, setLastUserId } from './userData'
import { stopTracking } from './track'

export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Bitte melde dich erneut an.')
  const res = await fetch(apiUrl('/api/account/delete'), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(msg.error || 'Löschen hat nicht geklappt. Bitte nochmal versuchen.')
  }
  stopTracking()
  // Konto gibt es nicht mehr → nur lokal abmelden (der Server kennt die Sitzung nicht mehr)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  } finally {
    clearUserData()
    setLastUserId(null)
  }
}
