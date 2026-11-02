// Konto & Daten löschen (Play-Store-Pflicht, DSGVO Art. 17).
//
// POST /api/account/delete   (Authorization: Bearer <Supabase-Access-Token>)
//   1. Token prüfen → nur das eigene Konto
//   2. Dateien im Storage löschen (Körperfotos)
//   3. anonyme Nutzungs-Ereignisse (app_events) löschen
//   4. Auth-Nutzer löschen → alle App-Tabellen folgen per `on delete cascade`
//
// Braucht SUPABASE_SERVICE_ROLE_KEY (nur in Vercel, nie im Code).
// Es werden keine personenbezogenen Daten geloggt.

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../_supabase.js'
import { cors } from '../_cors.js'
import { USER_BUCKETS, analyticsHashInput, isUuid, storagePaths } from '../_account.js'

/** Prüft das Access-Token beim Auth-Server und liefert die User-ID oder null. */
async function currentUserId(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: auth },
    })
    if (!r.ok) return null
    const u = await r.json()
    return isUuid(u?.id) ? u.id : null
  } catch {
    return null
  }
}

/** Alle Dateien im Ordner `<userId>/` eines Buckets löschen (seitenweise). */
async function removeUserFiles(db, bucket, userId) {
  for (let round = 0; round < 50; round++) {
    const { data, error } = await db.storage.from(bucket).list(userId, { limit: 1000 })
    if (error) {
      // Bucket fehlt (Migration nicht ausgeführt) → nichts zu löschen
      if (/not.?found/i.test(String(error.message))) return
      throw new Error('storage_list')
    }
    const paths = storagePaths(userId, data)
    if (!paths.length) return
    const { error: rmErr } = await db.storage.from(bucket).remove(paths)
    if (rmErr) throw new Error('storage_remove')
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST.' })

  const userId = await currentUserId(req)
  if (!userId) return res.status(401).json({ error: 'Bitte melde dich erneut an.' })

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return res.status(503).json({ error: 'Löschen ist gerade nicht möglich. Bitte später nochmal.' })

  const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    for (const bucket of USER_BUCKETS) await removeUserFiles(db, bucket, userId)

    const hash = createHash('sha256').update(analyticsHashInput(userId)).digest('hex')
    const { error: evErr } = await db.from('app_events').delete().eq('user_hash', hash)
    // Tabelle fehlt (Migration 0040 noch nicht gelaufen) → ignorieren
    if (evErr && evErr.code !== '42P01' && !/does not exist|schema cache/i.test(String(evErr.message))) {
      throw new Error('events')
    }

    const { error: delErr } = await db.auth.admin.deleteUser(userId)
    if (delErr) throw new Error('auth_delete')

    return res.status(200).json({ ok: true })
  } catch (e) {
    // Nur den Schritt loggen, keine Nutzerdaten
    console.error('account delete failed at step:', e instanceof Error ? e.message : 'unknown')
    return res.status(500).json({ error: 'Löschen hat nicht geklappt. Bitte nochmal versuchen.' })
  }
}
