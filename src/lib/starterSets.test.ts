import libraryRaw from '../../public/exercise-library.json?raw'
import { describe, expect, it } from 'vitest'
import type { LibraryExercise } from './exerciseLibrary'
import { STARTER_TEMPLATES, planStarter, starterExercises } from './starterSets'

const list = (JSON.parse(libraryRaw) as { exercises: LibraryExercise[] }).exercises

describe('Standard-Übungen', () => {
  it('alle Vorlagen-Übungen existieren in der Bibliothek, 8–15 Übungen je Vorlage', () => {
    const ids = new Set(list.map((e) => e.id))
    for (const t of STARTER_TEMPLATES) {
      const exs = starterExercises(t)
      expect(exs.length, t.id).toBeGreaterThanOrEqual(8)
      expect(exs.length, t.id).toBeLessThanOrEqual(15)
      for (const e of exs) expect(ids.has(e.lib), e.lib).toBe(true)
    }
  })

  it('legt ohne vorhandene Übungen alles neu an', () => {
    const t = STARTER_TEMPLATES.find((x) => x.id === 'ppl')!
    const p = planStarter(t, [], [], list)
    expect(p.create).toHaveLength(starterExercises(t).length)
    expect(p.existing.size).toBe(0)
    expect(p.plans.map((x) => x.name)).toEqual(['Push', 'Pull', 'Beine'])
    expect(p.plans.every((x) => !x.exists && x.libs.length === 5)).toBe(true)
    const bench = p.create.find((c) => c.lib === 'Barbell_Bench_Press_-_Medium_Grip')!
    expect(bench.input).toMatchObject({ name: 'Bankdrücken', muscle_group: 'Brust', target_rep_min: 6, target_rep_max: 10 })
  })

  it('ist idempotent: vorhandene Namen, Verknüpfungen und Pläne werden übersprungen', () => {
    const t = STARTER_TEMPLATES.find((x) => x.id === 'ppl')!
    const mine = [
      { id: 'a', name: 'bankdrücken' },
      { id: 'b', name: 'Mein Latzug' },
      { id: 'c', name: 'Kniebeuge (Langhantel)' },
    ]
    const p = planStarter(t, mine, ['push'], list, { b: 'Wide-Grip_Lat_Pulldown' })
    expect(p.existing.get('Barbell_Bench_Press_-_Medium_Grip')).toBe('a')
    expect(p.existing.get('Wide-Grip_Lat_Pulldown')).toBe('b')
    expect(p.existing.get('Barbell_Squat')).toBe('c')
    expect(p.create.map((c) => c.lib)).not.toContain('Barbell_Bench_Press_-_Medium_Grip')
    expect(p.plans.find((x) => x.name === 'Push')!.exists).toBe(true)
    expect(p.plans.find((x) => x.name === 'Pull')!.exists).toBe(false)

    // Zweiter Durchlauf mit allen angelegten Übungen → nichts Neues
    const all = [...mine, ...p.create.map((c, i) => ({ id: `n${i}`, name: c.input.name }))]
    expect(planStarter(t, all, ['Push', 'Pull', 'Beine'], list, { b: 'Wide-Grip_Lat_Pulldown' }).create).toHaveLength(0)
  })
})
