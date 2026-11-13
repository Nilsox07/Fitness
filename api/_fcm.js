// Push an die Android-App über Firebase Cloud Messaging (HTTP-v1-API).
// Zugang: Dienstkonto aus Firebase (Projekteinstellungen → Dienstkonten → Schlüssel erzeugen) als
// Env-Variable FCM_SERVICE_ACCOUNT (das ganze JSON, roh oder Base64) – nur in Vercel, nie ins Git.
// Reine Teile (Dienstkonto lesen, JWT, Nachricht bauen, Wer bekommt was) sind in _fcm.test.ts getestet.

import { createSign } from 'node:crypto'

/** Dienstkonto aus der Env-Variable lesen (JSON oder Base64-JSON); unbrauchbar → null. */
export function readServiceAccount(raw) {
  if (!raw || typeof raw !== 'string') return null
  const tryParse = (s) => {
    try {
      const j = JSON.parse(s)
      return j && typeof j === 'object' ? j : null
    } catch {
      return null
    }
  }
  const text = raw.trim()
  const j = text.startsWith('{') ? tryParse(text) : tryParse(Buffer.from(text, 'base64').toString('utf8'))
  if (!j?.project_id || !j?.client_email || !j?.private_key) return null
  // In Env-Variablen landen Zeilenumbrüche oft als „\n“-Text
  return { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') }
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

/** Signiertes JWT für den Google-OAuth-Tausch (RS256, 1 h gültig). */
export function serviceJwt(sa, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64url({ alg: 'RS256', typ: 'JWT' })
  const claims = b64url({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  })
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key).toString('base64url')
  return `${head}.${claims}.${sig}`
}

let cached = null

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.email === sa.client_email && cached.exp - 60 > now) return cached.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceJwt(sa, now),
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error(`fcm_auth_${r.status}`)
  cached = { email: sa.client_email, token: j.access_token, exp: now + (Number(j.expires_in) || 3600) }
  return cached.token
}

/** FCM-Nachricht aus unserem Push-Inhalt ({ title, body, tag, url }). Daten müssen Texte sein. */
export function fcmMessage(token, payload) {
  const tag = String(payload.tag || 'fitness')
  return {
    message: {
      token,
      notification: { title: String(payload.title || 'Fitness'), body: String(payload.body || '') },
      data: { url: String(payload.url || '/today'), tag },
      android: {
        priority: 'HIGH',
        notification: { channel_id: 'reminders', tag, icon: 'ic_stat_buddy', color: '#E11D48' },
      },
    },
  }
}

/** Ist das Abo ein Android-Gerät (FCM) statt eines Browsers (Web-Push)? */
export const isFcmSub = (sub) => sub?.platform === 'android' || String(sub?.endpoint || '').startsWith('fcm:')

export const fcmToken = (sub) => String(sub.endpoint).replace(/^fcm:/, '')

/**
 * Soll der Server diesem Gerät die Erinnerung schicken? Die App plant Erinnerungen selbst
 * (localReminders) und meldet, bis wann (local_until). Solange das reicht, nur das, was das Handy
 * nicht wissen kann (Freunde, Test). Wurde die App länger nicht geöffnet, übernimmt der Server.
 */
export function serverSends(sub, kind, today) {
  if (!isFcmSub(sub)) return true
  if (kind === 'social' || kind === 'test') return true
  return !sub.local_until || sub.local_until < today
}

/** Senden; gone = Token ungültig (App deinstalliert) → Abo löschen. */
export async function sendFcm(sa, token, payload) {
  const access = await accessToken(sa)
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify(fcmMessage(token, payload)),
  })
  if (r.ok) return { ok: true, gone: false, status: 200 }
  const j = await r.json().catch(() => ({}))
  const code = j?.error?.details?.find?.((d) => d?.errorCode)?.errorCode
  // Nur eindeutig tote Tokens löschen – ein Fehler in der Nachricht darf keine Abos kosten
  const gone = r.status === 404 || code === 'UNREGISTERED'
  return { ok: false, gone, status: r.status }
}
