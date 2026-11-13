import { describe, expect, it } from 'vitest'
import { splitHeadline } from './headline'

describe('Buddy-Überschrift', () => {
  it('erster Satz als Überschrift, Rest getrennt', () => {
    const r = splitHeadline('Solide 69 Punkte. Oberkörper A wie geplant, Technik vor Gewicht. Noch 140 g Eiweiß offen.')
    expect(r.head).toBe('Solide 69 Punkte.')
    expect(r.rest).toBe('Oberkörper A wie geplant, Technik vor Gewicht. Noch 140 g Eiweiß offen.')
  })

  it('kurzer Text bleibt ganz', () => {
    expect(splitHeadline('Feste Schlafenszeit = besserer Tiefschlaf.')).toEqual({
      head: 'Feste Schlafenszeit = besserer Tiefschlaf.',
      rest: '',
    })
  })

  it('zu langer erster Satz: am Gedankenstrich oder an einem Wort gekürzt', () => {
    const r = splitHeadline(
      'Solide 69 Punkte – Oberkörper A wie geplant, Technik vor Gewicht und dann noch viel mehr Text danach.',
    )
    expect(r.head).toBe('Solide 69 Punkte')
    expect(r.rest.startsWith('Oberkörper A')).toBe(true)
    const long = splitHeadline('a '.repeat(80) + 'Ende.')
    expect(long.head.length).toBeLessThanOrEqual(82)
    expect(long.head.endsWith('…')).toBe(true)
  })

  it('„z. B.“ beendet den Satz nicht', () => {
    expect(splitHeadline('Iss etwas Eiweiß, z. B. Quark. Danach Training.').head).toBe('Iss etwas Eiweiß, z. B. Quark.')
  })
})
