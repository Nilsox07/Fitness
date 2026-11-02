import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANALYTICS_SALT,
  flush,
  foodMethod,
  hashUserId,
  hintFoodMethod,
  initTracking,
  sanitizeProps,
  shouldLogAppOpen,
  stopTracking,
  track,
  validEventName,
} from './track'
import {
  ANALYTICS_SALT as SERVER_SALT,
  USER_BUCKETS,
  analyticsHashInput,
  isUuid,
  storagePaths,
} from '../../api/_account.js'

const UID = '0b5c2a1e-1234-4abc-9def-0123456789ab'

describe('Nutzungs-Statistik', () => {
  afterEach(() => stopTracking())

  it('Hash wie auf dem Server (Konto löschen findet die Ereignisse)', async () => {
    expect(ANALYTICS_SALT).toBe(SERVER_SALT)
    const server = createHash('sha256').update(analyticsHashInput(UID)).digest('hex')
    expect(await hashUserId(UID)).toBe(server)
    expect(server).toHaveLength(64)
  })

  it('nur kleine, flache Merkmale', () => {
    expect(sanitizeProps({ method: 'photo', n: 2.345, ok: true })).toEqual({ method: 'photo', n: 2.35, ok: true })
    expect(sanitizeProps({ nested: { a: 1 }, 'bad key': 'x', empty: '' })).toEqual({})
    expect(sanitizeProps({ t: 'x'.repeat(100) }).t).toHaveLength(40)
    expect(Object.keys(sanitizeProps({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }))).toHaveLength(6)
    expect(sanitizeProps(null)).toEqual({})
  })

  it('Ereignisnamen', () => {
    expect(validEventName('food_logged')).toBe(true)
    expect(validEventName('Food Logged')).toBe(false)
    expect(validEventName('')).toBe(false)
  })

  it('app_open einmal pro Tag', () => {
    expect(shouldLogAppOpen(null, '2026-11-02')).toBe(true)
    expect(shouldLogAppOpen('2026-11-02', '2026-11-02')).toBe(false)
    expect(shouldLogAppOpen('2026-11-01', '2026-11-02')).toBe(true)
  })

  it('Eingabeart beim Essen', () => {
    const later = Date.now() + 20 * 60 * 1000
    hintFoodMethod('photo')
    expect(foodMethod(false)).toBe('photo')
    expect(foodMethod(true)).toBe('photo')
    expect(foodMethod(false, later)).toBe('manual')
    expect(foodMethod(true, later)).toBe('barcode')
  })

  it('ohne Einwilligung wird nichts gesendet, mit Einwilligung gebündelt', async () => {
    const send = vi.fn(async (_rows: unknown[]) => {})
    initTracking({ enabled: false, hash: 'h'.repeat(64), send })
    track('app_open')
    await flush()
    expect(send).not.toHaveBeenCalled()

    stopTracking()
    track('workout_started')
    track('food_logged', { method: 'search' })
    initTracking({ enabled: true, hash: 'h'.repeat(64), send, version: '2.0', platform: 'android' })
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toEqual([
      { user_hash: 'h'.repeat(64), name: 'workout_started', props: {}, app_version: '2.0', platform: 'android' },
      {
        user_hash: 'h'.repeat(64),
        name: 'food_logged',
        props: { method: 'search' },
        app_version: '2.0',
        platform: 'android',
      },
    ])
  })

  it('Sendefehler werden verschluckt', async () => {
    initTracking({ enabled: true, hash: 'h'.repeat(64), send: async () => Promise.reject(new Error('offline')) })
    track('search_used')
    await expect(flush()).resolves.toBeUndefined()
  })
})

describe('Konto löschen (Server-Logik)', () => {
  it('Körperfotos-Bucket ist dabei', () => {
    expect(USER_BUCKETS).toContain('body-photos')
  })
  it('nur Dateien im eigenen Ordner', () => {
    expect(isUuid(UID)).toBe(true)
    expect(isUuid('../x')).toBe(false)
    expect(
      storagePaths(UID, [
        { name: '2026-11-01-abc.jpg', id: '1' },
        { name: 'unterordner', id: null },
        { name: '../fremd.jpg', id: '2' },
        { name: '', id: '3' },
      ]),
    ).toEqual([`${UID}/2026-11-01-abc.jpg`])
    expect(storagePaths('kein-uuid', [{ name: 'a.jpg', id: '1' }])).toEqual([])
    expect(storagePaths(UID, null)).toEqual([])
  })
})
