import libraryRaw from '../../public/exercise-library.json?raw'
import { describe, expect, it } from 'vitest'
import {
  findLibraryMatch,
  libraryMuscles,
  libraryToExerciseInput,
  normalize,
  repRangeFor,
  searchLibrary,
  type LibraryExercise,
} from './exerciseLibrary'
import { MUSCLE_GROUPS } from '../types'

function ex(p: Partial<LibraryExercise> & { id: string; name_de: string }): LibraryExercise {
  return {
    name_en: p.id.replace(/_/g, ' '),
    muscle: 'Brust',
    secondary: [],
    equipment: 'Langhantel',
    level: 'Anfänger',
    mechanic: 'Grundübung',
    category: 'Kraft',
    images: [`${p.id}/0.jpg`, `${p.id}/1.jpg`],
    steps_de: ['Schritt'],
    home: false,
    ...p,
  }
}

const LIST: LibraryExercise[] = [
  ex({ id: 'Barbell_Bench_Press_-_Medium_Grip', name_de: 'Bankdrücken (Langhantel)', name_en: 'Barbell Bench Press - Medium Grip', secondary: ['Trizeps', 'Schultern'] }),
  ex({ id: 'Dumbbell_Bench_Press', name_de: 'Kurzhantel-Bankdrücken', name_en: 'Dumbbell Bench Press', equipment: 'Kurzhantel', home: true }),
  ex({ id: 'Pushups', name_de: 'Liegestütze', name_en: 'Pushups', equipment: 'Körpergewicht', home: true }),
  ex({ id: 'Barbell_Squat', name_de: 'Kniebeuge (Langhantel)', name_en: 'Barbell Squat', muscle: 'Beine' }),
  ex({ id: 'Bodyweight_Squat', name_de: 'Kniebeuge (Körpergewicht)', name_en: 'Bodyweight Squat', muscle: 'Beine', equipment: 'Körpergewicht', home: true }),
  ex({ id: 'Wide-Grip_Lat_Pulldown', name_de: 'Latzug breit zur Brust', name_en: 'Wide-Grip Lat Pulldown', muscle: 'Rücken', equipment: 'Kabelzug' }),
  ex({ id: 'Dumbbell_Bicep_Curl', name_de: 'Bizepscurls mit Kurzhanteln', name_en: 'Dumbbell Bicep Curl', muscle: 'Bizeps', equipment: 'Kurzhantel', mechanic: 'Isolation', home: true }),
  ex({ id: 'One-Arm_Dumbbell_Row', name_de: 'Einarmiges Kurzhantelrudern', name_en: 'One-Arm Dumbbell Row', muscle: 'Rücken', secondary: ['Bizeps'], equipment: 'Kurzhantel', home: true }),
]

describe('normalize', () => {
  it('vereinheitlicht Umlaute, ß und Satzzeichen', () => {
    expect(normalize('Bankdrücken (Langhantel)')).toBe('bankdrucken langhantel')
    expect(normalize('Kurzhantel-Rudern')).toBe('kurzhantel rudern')
    expect(normalize('Gesäß')).toBe('gesass')
    expect(normalize('  ÜBUNG  ')).toBe('ubung')
  })
})

describe('searchLibrary', () => {
  it('liefert ohne Filter alles', () => {
    expect(searchLibrary(LIST)).toHaveLength(LIST.length)
  })

  it('findet deutsche Namen ohne Umlaute und englische Namen', () => {
    expect(searchLibrary(LIST, { query: 'bankdrucken' }).map((e) => e.id)).toEqual([
      'Barbell_Bench_Press_-_Medium_Grip',
      'Dumbbell_Bench_Press',
    ])
    expect(searchLibrary(LIST, { query: 'lat pulldown' })[0].id).toBe('Wide-Grip_Lat_Pulldown')
  })

  it('sortiert Treffer am Namensanfang zuerst', () => {
    const r = searchLibrary(LIST, { query: 'Bank' })
    expect(r[0].id).toBe('Barbell_Bench_Press_-_Medium_Grip')
  })

  it('verlangt alle Suchwörter (auch über Muskel/Equipment)', () => {
    expect(searchLibrary(LIST, { query: 'kniebeuge körpergewicht' }).map((e) => e.id)).toEqual(['Bodyweight_Squat'])
    expect(searchLibrary(LIST, { query: 'rudern bizeps' }).map((e) => e.id)).toEqual(['One-Arm_Dumbbell_Row'])
  })

  it('filtert nach Muskel, Equipment und Zuhause', () => {
    expect(searchLibrary(LIST, { muscle: 'Beine' }).map((e) => e.id).sort()).toEqual(['Barbell_Squat', 'Bodyweight_Squat'])
    expect(searchLibrary(LIST, { equipment: 'Kurzhantel' })).toHaveLength(3)
    expect(searchLibrary(LIST, { home: true }).every((e) => e.home)).toBe(true)
    expect(searchLibrary(LIST, { muscle: 'Beine', home: true }).map((e) => e.id)).toEqual(['Bodyweight_Squat'])
  })
})

describe('libraryMuscles', () => {
  it('folgt der Reihenfolge von MUSCLE_GROUPS', () => {
    expect(libraryMuscles(LIST)).toEqual(['Brust', 'Rücken', 'Beine', 'Bizeps'])
  })
})

describe('findLibraryMatch', () => {
  it('nutzt zuerst die gespeicherte Verknüpfung', () => {
    expect(findLibraryMatch({ id: 'u1', name: 'Irgendwas' }, LIST, { u1: 'Pushups' })?.id).toBe('Pushups')
  })

  it('ignoriert Verknüpfungen auf unbekannte IDs', () => {
    expect(findLibraryMatch({ id: 'u1', name: 'Liegestütze' }, LIST, { u1: 'Gibt_es_nicht' })?.id).toBe('Pushups')
  })

  it('findet exakte deutsche oder englische Namen', () => {
    expect(findLibraryMatch({ id: 'u', name: 'kurzhantel-bankdrücken' }, LIST, {})?.id).toBe('Dumbbell_Bench_Press')
    expect(findLibraryMatch({ id: 'u', name: 'Barbell Squat' }, LIST, {})?.id).toBe('Barbell_Squat')
  })

  it('findet Kurznamen über Alias oder Name ohne Klammerzusatz', () => {
    expect(findLibraryMatch({ id: 'u', name: 'Bankdrücken' }, LIST, {})?.id).toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(findLibraryMatch({ id: 'u', name: 'Latzug' }, LIST, {})?.id).toBe('Wide-Grip_Lat_Pulldown')
    // „Kniebeuge" passt zu Langhantel und Körpergewicht → Langhantel bevorzugt
    expect(findLibraryMatch({ id: 'u', name: 'Kniebeuge' }, LIST, {})?.id).toBe('Barbell_Squat')
  })

  it('liefert null ohne Treffer', () => {
    expect(findLibraryMatch({ id: 'u', name: 'Meine Spezialübung' }, LIST, {})).toBeNull()
    expect(findLibraryMatch({ id: 'u', name: '' }, LIST, {})).toBeNull()
  })
})

describe('Übernahme', () => {
  it('Wiederholungsbereich: Grundübung 6–10, Isolation 10–15', () => {
    expect(repRangeFor({ mechanic: 'Grundübung' })).toEqual([6, 10])
    expect(repRangeFor({ mechanic: 'Isolation' })).toEqual([10, 15])
  })

  it('erzeugt eine passende ExerciseInput', () => {
    const bench = libraryToExerciseInput(LIST[0])
    expect(bench).toMatchObject({
      name: 'Bankdrücken (Langhantel)',
      muscle_group: 'Brust',
      secondary_muscles: ['Trizeps', 'Schultern'],
      target_rep_min: 6,
      target_rep_max: 10,
      increment: 2.5,
      unilateral: false,
    })
    const curl = libraryToExerciseInput(LIST[6])
    expect([curl.target_rep_min, curl.target_rep_max]).toEqual([10, 15])
    expect(curl.increment).toBe(1)
    expect(libraryToExerciseInput(LIST[7]).unilateral).toBe(true)
  })
})

describe('public/exercise-library.json', () => {
  const file = JSON.parse(libraryRaw) as { exercises: LibraryExercise[] }
  const list = file.exercises

  it('enthält nur gültige Muskelgruppen und deutsche Texte', () => {
    expect(list.length).toBeGreaterThan(500)
    for (const e of list) {
      expect(MUSCLE_GROUPS).toContain(e.muscle)
      for (const s of e.secondary) expect(MUSCLE_GROUPS).toContain(s)
      expect(e.name_de.length).toBeGreaterThan(0)
      expect(e.steps_de.length).toBeGreaterThan(0)
      expect(['Grundübung', 'Isolation']).toContain(e.mechanic)
    }
  })

  it('hat eindeutige IDs und deutsche Namen', () => {
    expect(new Set(list.map((e) => e.id)).size).toBe(list.length)
    expect(new Set(list.map((e) => e.name_de)).size).toBe(list.length)
  })

  it('alle Alias-Ziele existieren', () => {
    for (const name of ['Bankdrücken', 'Kreuzheben', 'Latzug', 'Klimmzüge', 'Liegestütze', 'Seitheben', 'Beinbeuger', 'Dips', 'Plank', 'Face Pulls', 'RDL', 'Hip Thrust', 'Military Press', 'Wadenheben', 'Trizepsdrücken', 'Rudern', 'Ausfallschritte', 'Crunch', 'Bizepscurls', 'Schulterdrücken', 'Beinstrecker', 'Langhantelrudern']) {
      expect(findLibraryMatch({ id: 'x', name }, list, {}), name).not.toBeNull()
    }
  })
})
