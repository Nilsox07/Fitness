import { describe, expect, it } from 'vitest'
import { FEEDBACK_MAX_CHARS, SCREENSHOT_MAX_CHARS, canSendFeedback, cleanRoute, feedbackMeta } from './feedback'

describe('Feedback', () => {
  it('Route ohne Query und ohne IDs', () => {
    expect(cleanRoute('/nutrition?add=photo')).toBe('/nutrition')
    expect(cleanRoute('/cardio/0b5c2a1e-1234-4abc-9def-0123456789ab')).toBe('/cardio/:id')
    expect(cleanRoute('')).toBe('/')
  })
  it('Meta-Daten kurz', () => {
    expect(feedbackMeta({ version: '2.0', platform: 'android', pathname: '/profile?s=x', lang: 'de-DE' })).toEqual({
      version: '2.0',
      platform: 'android',
      route: '/profile',
      lang: 'de-DE',
    })
  })
  it('Senden nur mit Text und kleinem Bild', () => {
    expect(canSendFeedback('  ', null)).toBe(false)
    expect(canSendFeedback('Tolle App', null)).toBe(true)
    expect(canSendFeedback('x'.repeat(FEEDBACK_MAX_CHARS + 1), null)).toBe(false)
    expect(canSendFeedback('Bild', 'x'.repeat(SCREENSHOT_MAX_CHARS + 1))).toBe(false)
  })
})
