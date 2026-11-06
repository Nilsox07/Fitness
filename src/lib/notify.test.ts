import { describe, expect, it } from 'vitest'
import {
  NOTIFY_DEFAULTS,
  dueKinds,
  fastingDue,
  inWindow,
  localNow,
  message,
  moduleAllows,
  normalizeNotify,
} from '../../api/_notify.js'
import { NOTIFY_ITEMS } from './notify'

describe('Erinnerungen (Server-Logik)', () => {
  it('Standardwerte und Bereinigung', () => {
    const n = normalizeNotify({
      lunch: { on: false, time: '12:15' },
      weigh: { days: [9, 2, 2] },
      water: { time: 'quatsch' },
    })
    expect(n.lunch).toEqual({ on: false, time: '12:15' })
    expect(n.weigh.days).toEqual([2])
    expect(n.water.time).toBe('16:00')
    expect(n.dinner).toEqual(NOTIFY_DEFAULTS.dinner)
  })
  it('ausgeblendete Module: keine Erinnerungen dazu', () => {
    expect(moduleAllows('lunch', { nutrition: false })).toBe(false)
    expect(moduleAllows('supp:x:08:00', { nutrition: false })).toBe(false)
    expect(moduleAllows('fasting_open', { nutrition: false })).toBe(false)
    expect(moduleAllows('workout', { nutrition: false, social: false })).toBe(true)
    expect(moduleAllows('social', { social: false })).toBe(false)
    expect(moduleAllows('lunch', undefined)).toBe(true)
  })
  it('Links führen zur passenden Seite', () => {
    expect(message('weigh')?.url).toBe('/body')
    expect(message('review')?.url).toBe('/profile?s=review')
    expect(message('protein', { missing: 30 })?.url).toBe('/nutrition')
  })
  it('Client kennt dieselben Arten wie der Server', () => {
    expect(NOTIFY_ITEMS.map((i) => i.kind).sort()).toEqual(Object.keys(NOTIFY_DEFAULTS).sort())
  })
  it('lokale Zeit je Zeitzone', () => {
    const l = localNow('Europe/Berlin', new Date('2026-10-12T11:40:00Z')) // Montag, 13:40 MESZ
    expect(l).toEqual({ date: '2026-10-12', min: 13 * 60 + 40, weekday: 0 })
    expect(localNow('Kaputt/Zone', new Date('2026-10-12T11:40:00Z')).min).toBe(13 * 60 + 40)
  })
  it('Zeitfenster von 30 Minuten, auch über Mitternacht', () => {
    expect(inWindow(13 * 60 + 40, 13 * 60 + 30)).toBe(true)
    expect(inWindow(14 * 60, 13 * 60 + 30)).toBe(false)
    expect(inWindow(5, 23 * 60 + 50)).toBe(true)
  })
  it('fällige Arten nach Uhrzeit und Wochentag', () => {
    const n = normalizeNotify({})
    expect(dueKinds(n, { date: '2026-10-12', min: 13 * 60 + 35, weekday: 0 })).toEqual(['lunch'])
    expect(dueKinds(n, { date: '2026-10-12', min: 9 * 60 + 5, weekday: 0 })).toEqual(['review'])
    expect(dueKinds(n, { date: '2026-10-13', min: 9 * 60 + 5, weekday: 1 })).toEqual([])
    const w = normalizeNotify({ weigh: { on: true } })
    expect(dueKinds(w, { date: '2026-10-12', min: 8 * 60, weekday: 0 })).toContain('weigh')
    expect(dueKinds(w, { date: '2026-10-14', min: 8 * 60, weekday: 2 })).not.toContain('weigh')
  })
  it('Fastenfenster öffnet und schließt', () => {
    expect(fastingDue('16:8', '12:00', { min: 12 * 60 + 10 })).toBe('open')
    expect(fastingDue('16:8', '12:00', { min: 19 * 60 + 35 })).toBe('close')
    expect(fastingDue('none', '12:00', { min: 12 * 60 })).toBeNull()
  })
  it('Texte', () => {
    expect(message('protein', { missing: 40 })?.title).toContain('40 g')
    expect(message('water', { drankL: '0,8', targetL: '2,5' })?.title).toContain('0,8 von 2,5 l')
    expect(message('streak', { danger: false, days: 4 }, 0)?.title).toContain('4 Tage')
    expect((message('water', { drankL: '0,8', targetL: '2,5' }) as { actions?: unknown[] } | null)?.actions).toHaveLength(2)
    expect(message('workout', { plan: 'Push' })?.url).toBe('/')
    expect(message('quatsch')).toBeNull()
  })
})
