#!/usr/bin/env node
/**
 * Baut die eingebaute Übungsbibliothek (public/exercise-library.json) aus der
 * Open-Source-Datenbank „free-exercise-db" (Unlicense / Public Domain):
 *   https://github.com/yuhonas/free-exercise-db
 *
 * Deutsche Namen und Kurz-Anleitungen kommen aus der handgepflegten Datei
 * scripts/exercise-de.json ({ "<id>": { "name": "...", "steps": ["..."] } }).
 * Übungen ohne Übersetzung werden übersprungen (und im Log gemeldet).
 *
 * Aufruf:
 *   node scripts/build-exercise-library.mjs                # lädt die JSON aus dem Netz
 *   node scripts/build-exercise-library.mjs --input ex.json # nutzt eine lokale Kopie
 *
 * Das Ergebnis wird committet und zur Laufzeit lazy geladen (nicht gebundelt).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DE_FILE = resolve(ROOT, 'scripts/exercise-de.json')
const OUT_FILE = resolve(ROOT, 'public/exercise-library.json')

/** Behaltene Kategorien (Dehnen, Cardio, Olympia-Gewichtheben, Strongman fallen raus). */
const CATEGORY = {
  strength: 'Kraft',
  plyometrics: 'Plyometrie',
  powerlifting: 'Powerlifting',
}

/** free-exercise-db-Muskeln → MUSCLE_GROUPS aus src/types.ts. */
const MUSCLE = {
  abdominals: 'Bauch',
  hamstrings: 'Beinbeuger',
  adductors: 'Beine',
  abductors: 'Gesäß',
  quadriceps: 'Beine',
  biceps: 'Bizeps',
  shoulders: 'Schultern',
  chest: 'Brust',
  'middle back': 'Rücken',
  lats: 'Rücken',
  'lower back': 'Rücken',
  traps: 'Rücken',
  calves: 'Waden',
  glutes: 'Gesäß',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  neck: 'Sonstige',
}

const EQUIPMENT = {
  'body only': 'Körpergewicht',
  dumbbell: 'Kurzhantel',
  barbell: 'Langhantel',
  'e-z curl bar': 'SZ-Stange',
  cable: 'Kabelzug',
  machine: 'Maschine',
  kettlebells: 'Kettlebell',
  bands: 'Band',
  'medicine ball': 'Medizinball',
  'exercise ball': 'Gymnastikball',
  'foam roll': 'Faszienrolle',
  other: 'Sonstiges',
}

/** Equipment, das typischerweise zu Hause verfügbar ist. */
const HOME_EQUIPMENT = new Set(['body only', 'bands', 'dumbbell', 'kettlebells', 'exercise ball', 'medicine ball'])

const LEVEL = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', expert: 'Profi' }
const MECHANIC = { compound: 'Grundübung', isolation: 'Isolation' }

async function loadSource() {
  const i = process.argv.indexOf('--input')
  if (i !== -1 && process.argv[i + 1]) {
    return JSON.parse(await readFile(resolve(process.argv[i + 1]), 'utf8'))
  }
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status} ${res.statusText}`)
  return res.json()
}

function mapMuscles(list) {
  const out = []
  for (const m of list ?? []) {
    const g = MUSCLE[m]
    if (!g) throw new Error(`Unbekannter Muskel: ${m}`)
    if (!out.includes(g)) out.push(g)
  }
  return out
}

async function main() {
  const source = await loadSource()
  const de = JSON.parse(await readFile(DE_FILE, 'utf8'))

  const kept = source.filter((e) => CATEGORY[e.category])
  const missing = []
  const library = []

  for (const e of kept) {
    const t = de[e.id]
    if (!t?.name || !Array.isArray(t.steps) || t.steps.length === 0) {
      missing.push(e.id)
      continue
    }
    const [muscle = 'Sonstige', ...rest] = mapMuscles(e.primaryMuscles)
    const secondary = [...rest, ...mapMuscles(e.secondaryMuscles)].filter(
      (m, i, a) => m !== muscle && m !== 'Sonstige' && a.indexOf(m) === i,
    )
    const equipmentKey = e.equipment ?? 'body only'
    library.push({
      id: e.id,
      name_de: t.name,
      name_en: e.name,
      muscle,
      secondary,
      equipment: EQUIPMENT[equipmentKey] ?? 'Sonstiges',
      level: LEVEL[e.level] ?? 'Anfänger',
      mechanic: MECHANIC[e.mechanic] ?? 'Grundübung',
      category: CATEGORY[e.category],
      images: (e.images ?? []).slice(0, 2),
      steps_de: t.steps,
      home: HOME_EQUIPMENT.has(equipmentKey),
    })
  }

  library.sort((a, b) => a.name_de.localeCompare(b.name_de, 'de'))
  const json = JSON.stringify({
    version: 1,
    source: 'free-exercise-db (https://github.com/yuhonas/free-exercise-db), Public Domain (Unlicense)',
    imageBase: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
    exercises: library,
  })
  await writeFile(OUT_FILE, json + '\n')

  console.log(`Quelle: ${source.length} Übungen, behalten (Kategorie): ${kept.length}`)
  console.log(`Geschrieben: ${library.length} Übungen → ${OUT_FILE} (${(json.length / 1024).toFixed(0)} KB)`)
  if (missing.length) console.warn(`Ohne Übersetzung übersprungen (${missing.length}): ${missing.join(', ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
