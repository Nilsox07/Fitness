import { describe, expect, it } from 'vitest'
import { effectiveSecondary, secondaryFromName } from './warmMuscles'

describe('Mitarbeitende Muskeln', () => {
  it('Ziehen wärmt Bizeps/Unterarme, Rudern auch die Schulter', () => {
    expect(secondaryFromName('Breites Rudern (Maschine)', 'Rücken').sort()).toEqual([
      'Bizeps',
      'Schultern',
      'Unterarme',
    ])
    expect(secondaryFromName('Latzug', 'Rücken')).toContain('Bizeps')
    expect(secondaryFromName('Lat Pulldown', 'Rücken')).toContain('Bizeps')
  })

  it('Drücken wärmt Trizeps, Brustdrücken auch die Schulter', () => {
    expect(secondaryFromName('Bankdrücken', 'Brust').sort()).toEqual(['Schultern', 'Trizeps'])
    expect(secondaryFromName('Schulterdrücken (Maschine)', 'Schultern')).toEqual(['Trizeps'])
    expect(secondaryFromName('Dips', 'Brust')).toContain('Trizeps')
  })

  it('Beine und Hüfte', () => {
    expect(secondaryFromName('Beinpresse', 'Beine')).toEqual(['Gesäß'])
    expect(secondaryFromName('Rumänisches Kreuzheben', 'Beinbeuger').sort()).toEqual(['Gesäß', 'Rücken'])
    expect(secondaryFromName('Hip Thrust', 'Gesäß')).toEqual(['Beinbeuger'])
  })

  it('Isolation ohne Mitläufer – Seitheben ist kein Latzug', () => {
    expect(secondaryFromName('Seitheben lateral', 'Schultern')).toEqual([])
    expect(secondaryFromName('Beinstrecker', 'Beine')).toEqual([])
    expect(secondaryFromName('Trizepsdrücken am Kabel', 'Trizeps')).toEqual([])
    expect(secondaryFromName('Bizeps Curl', 'Bizeps')).toEqual(['Unterarme'])
  })

  it('eingetragene Muskeln vor Bibliothek vor Name', () => {
    const ex = { name: 'Rudern', muscle_group: 'Rücken' as const }
    expect(effectiveSecondary({ ...ex, secondary_muscles: ['Schultern'] }, ['Bizeps'])).toEqual(['Schultern'])
    expect(effectiveSecondary({ ...ex, secondary_muscles: [] }, ['Bizeps', 'Rücken'])).toEqual(['Bizeps'])
    expect(effectiveSecondary({ ...ex, secondary_muscles: null }, null)).toContain('Bizeps')
  })
})
