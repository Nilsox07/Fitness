// Gemeinsame Helfer für die Fitbit-Endpunkte (kein eigener Endpoint wegen "_").
import { createClient } from '@supabase/supabase-js'

// In Vercel heißen die Werte oft nur VITE_… (für die App) — beide Namen akzeptieren.
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

/** Service-Role-Client; wirft eine verständliche Meldung, wenn der Schlüssel fehlt. */
export function admin() {
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Auf dem Server fehlt SUPABASE_SERVICE_ROLE_KEY (Vercel → Environment Variables).')
    err.status = 503
    throw err
  }
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function userFromToken(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data } = await anon.auth.getUser(token)
    return data?.user ?? null
  } catch {
    return null
  }
}

export function tokenFromReq(req) {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

export async function userFromAuth(req) {
  return userFromToken(tokenFromReq(req))
}

export { userFromToken }

/** Gültiges Access-Token holen; bei Ablauf per Refresh-Token erneuern. */
export async function getValidToken(userId) {
  const db = admin()
  const { data: row } = await db
    .from('fitbit_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row) return null
  if (new Date(row.expires_at).getTime() > Date.now() + 60000) return row.access_token

  const basic = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
  ).toString('base64')
  const r = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  })
  const tok = await r.json()
  if (!tok.access_token) return null
  await db.from('fitbit_tokens').upsert({
    user_id: userId,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? row.refresh_token,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    scope: tok.scope ?? row.scope,
    updated_at: new Date().toISOString(),
  })
  return tok.access_token
}
