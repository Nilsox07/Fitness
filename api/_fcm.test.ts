import { describe, expect, it } from 'vitest'
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { fcmMessage, fcmToken, isFcmSub, readServiceAccount, serverSends, serviceJwt } from './_fcm.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const sa = { project_id: 'demo', client_email: 'push@demo.iam.gserviceaccount.com', private_key: pem }

describe('FCM-Dienstkonto', () => {
  it('liest JSON, Base64 und „\\n“ im Schlüssel; Müll → null', () => {
    const raw = JSON.stringify({ ...sa, private_key: pem.replace(/\n/g, '\\n'), type: 'service_account' })
    expect(readServiceAccount(raw)?.private_key).toBe(pem)
    expect(readServiceAccount(Buffer.from(raw).toString('base64'))?.project_id).toBe('demo')
    expect(readServiceAccount('')).toBeNull()
    expect(readServiceAccount('{"project_id":"x"}')).toBeNull()
    expect(readServiceAccount('kein json')).toBeNull()
  })

  it('JWT ist mit dem Schlüssel signiert und hat Firebase-Scope', () => {
    const jwt = serviceJwt(sa, 1000)
    const [h, c, sig] = jwt.split('.')
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
    expect(claims).toMatchObject({ iss: sa.client_email, iat: 1000, exp: 4600 })
    expect(claims.scope).toContain('firebase.messaging')
    const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))
    expect(ok).toBe(true)
  })
})

describe('FCM-Nachricht', () => {
  it('Titel/Text als Benachrichtigung, Ziel-Seite als Text-Daten, Kanal „reminders“', () => {
    const m = fcmMessage('tok', { title: 'Mittag', body: 'Iss was', tag: 'fitness-lunch', url: '/nutrition' }).message
    expect(m.token).toBe('tok')
    expect(m.notification).toEqual({ title: 'Mittag', body: 'Iss was' })
    expect(m.data).toEqual({ url: '/nutrition', tag: 'fitness-lunch' })
    expect(m.android.notification.channel_id).toBe('reminders')
    expect(fcmMessage('t', {}).message.data.url).toBe('/today')
  })
})

describe('Wer bekommt was', () => {
  const web = { endpoint: 'https://push.example/abc' }
  const phone = { endpoint: 'fcm:xyz', platform: 'android', local_until: '2026-11-14' }
  it('erkennt Android-Abos und den Token', () => {
    expect(isFcmSub(web)).toBe(false)
    expect(isFcmSub(phone)).toBe(true)
    expect(fcmToken(phone)).toBe('xyz')
  })
  it('Browser bekommt alles; Handy mit eigenen Erinnerungen nur Freunde/Test', () => {
    expect(serverSends(web, 'lunch', '2026-11-13')).toBe(true)
    expect(serverSends(phone, 'lunch', '2026-11-13')).toBe(false)
    expect(serverSends(phone, 'social', '2026-11-13')).toBe(true)
    expect(serverSends(phone, 'test', '2026-11-13')).toBe(true)
  })
  it('App länger nicht geöffnet → Server übernimmt die Erinnerungen', () => {
    expect(serverSends(phone, 'lunch', '2026-11-15')).toBe(true)
    expect(serverSends({ endpoint: 'fcm:a', platform: 'android' }, 'water', '2026-11-13')).toBe(true)
  })
})
