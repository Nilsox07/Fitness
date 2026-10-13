import { describe, expect, it } from 'vitest'
import { LIMITS, TOPIC_GUARD, envList, quotaError, sanitizeRequest } from '../../api/_aiguard.js'

describe('KI-Schutz', () => {
  it('stellt die Themen-Grenze immer voran', () => {
    expect(sanitizeRequest({ prompt: 'Hi' }).req?.system).toBe(TOPIC_GUARD)
    const r = sanitizeRequest({ prompt: 'Hi', system: 'Du bist Coach.' }).req!
    expect(r.system.startsWith(TOPIC_GUARD)).toBe(true)
    expect(r.system.endsWith('Du bist Coach.')).toBe(true)
  })

  it('lehnt fehlende oder zu große Anfragen ab', () => {
    expect(sanitizeRequest({}).error).toBeTruthy()
    expect(sanitizeRequest({ prompt: 'x'.repeat(LIMITS.promptChars + 1) }).error).toBeTruthy()
    expect(sanitizeRequest({ prompt: 'x', images: ['a', 'b', 'c', 'd', 'e'] }).error).toBeTruthy()
    expect(sanitizeRequest({ prompt: 'x', image: 'y'.repeat(LIMITS.imageChars + 1) }).error).toBeTruthy()
  })

  it('begrenzt Temperatur und Tokens', () => {
    const r = sanitizeRequest({ prompt: 'x', temperature: 9, maxTokens: 1e6, json: 'ja' }).req!
    expect(r.temperature).toBe(1.2)
    expect(r.maxTokens).toBe(LIMITS.maxTokens)
    expect(r.json).toBe(false)
  })

  it('Limits pro Minute und Tag, Ausnahme für Unbegrenzte', () => {
    expect(quotaError({ lastMinute: 0, today: 0, unlimited: false })).toBeNull()
    expect(quotaError({ lastMinute: LIMITS.perMinute, today: 1, unlimited: false })).toMatch(/Minute/)
    expect(quotaError({ lastMinute: 0, today: LIMITS.perDay, unlimited: false })).toMatch(/Tageslimit/)
    expect(quotaError({ lastMinute: 99, today: 999, unlimited: true })).toBeNull()
    expect(envList(' A@x.de, b@y.de ,')).toEqual(['a@x.de', 'b@y.de'])
  })
})
