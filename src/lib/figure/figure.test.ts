import { describe, expect, it } from 'vitest'
import { FIGURES, figureForLibraryId, figureForName, getFigure } from './catalog'
import { renderFigure } from './render'
import { LEN, dist3, isTarget, sampleFigure, solvePose, type Skeleton } from './rig'

import libraryJson from '../../../public/exercise-library.json'
import { PREFERRED } from '../quickWorkout'

const lib = libraryJson as { exercises: { id: string; name_de: string }[] }
const libIds = new Set(lib.exercises.map((e) => e.id))

function segLens(sk: Skeleton) {
  return [
    dist3(sk.armNear.root, sk.armNear.mid),
    dist3(sk.armNear.mid, sk.armNear.end),
    dist3(sk.armFar.root, sk.armFar.mid),
    dist3(sk.armFar.mid, sk.armFar.end),
    dist3(sk.legNear.root, sk.legNear.mid),
    dist3(sk.legNear.mid, sk.legNear.end),
    dist3(sk.legFar.root, sk.legFar.mid),
    dist3(sk.legFar.mid, sk.legFar.end),
    dist3(sk.hip, sk.waist),
    dist3(sk.waist, sk.spineTop),
  ]
}
const EXPECTED = [LEN.upperArm, LEN.forearm, LEN.upperArm, LEN.forearm, LEN.thigh, LEN.shin, LEN.thigh, LEN.shin, LEN.lowerTorso, LEN.upperTorso]

describe('Figuren-Rig', () => {
  it('hält alle Segmentlängen in jedem interpolierten Frame konstant', () => {
    for (const e of FIGURES) {
      for (let i = 0; i <= 60; i++) {
        const sk = solvePose(sampleFigure(e.figure, i / 60).pose)
        segLens(sk).forEach((l, k) => expect(l, `${e.id} t=${i / 60} seg ${k}`).toBeCloseTo(EXPECTED[k], 6))
      }
    }
  })

  it('Gliedmaßen wechseln zwischen Posen nicht die Art (Winkel ↔ Ziel)', () => {
    for (const e of FIGURES) {
      const poses = Object.values(e.figure.poses)
      for (const key of ['arm', 'armFar', 'leg', 'legFar'] as const) {
        const kinds = new Set(poses.map((p) => (p[key] ? isTarget(p[key]!) : 'none')))
        expect(kinds.size, `${e.id}.${key}`).toBe(1)
      }
    }
  })

  it('Zeitachsen sind gültig und geschlossen', () => {
    for (const e of FIGURES) {
      const tl = e.figure.timeline
      expect(tl[0].at, e.id).toBe(0)
      expect(tl[tl.length - 1].at, e.id).toBe(1)
      expect(tl[0].pose, e.id).toBe(tl[tl.length - 1].pose)
      for (let i = 1; i < tl.length; i++) expect(tl[i].at).toBeGreaterThanOrEqual(tl[i - 1].at)
      for (const k of tl) expect(e.figure.poses[k.pose], `${e.id}: ${k.pose}`).toBeDefined()
      if (e.figure.peak) expect(e.figure.poses[e.figure.peak], e.id).toBeDefined()
    }
  })

  it('erzielt erreichbare Zielpunkte (keine überdehnten Arme/Beine)', () => {
    for (const e of FIGURES) {
      for (const [name, p] of Object.entries(e.figure.poses)) {
        const sk = solvePose(p)
        const check = (spec: typeof p.arm | undefined, end: number[], what: string) => {
          if (!spec || !isTarget(spec)) return
          const dx = end[0] - spec.to[0]
          const dy = end[1] - spec.to[1]
          expect(Math.hypot(dx, dy), `${e.id}/${name} ${what}`).toBeLessThan(6)
        }
        check(p.arm, sk.armNear.end, 'arm')
        check(p.leg, sk.legNear.end, 'leg')
        check(p.armFar ?? p.arm, sk.armFar.end, 'armFar')
        check(p.legFar ?? p.leg, sk.legFar.end, 'legFar')
      }
    }
  })

  it('rendert ohne NaN', () => {
    for (const e of FIGURES) {
      for (const t of [0, 0.3, 0.5, 0.8]) {
        const svg = renderFigure(e.figure, sampleFigure(e.figure, t), e)
        expect(svg, e.id).not.toMatch(/NaN|undefined|Infinity/)
      }
    }
  })
})

describe('Figuren-Katalog', () => {
  it('hat ca. 50 Übungen mit eindeutigen IDs', () => {
    expect(FIGURES.length).toBeGreaterThanOrEqual(45)
    expect(new Set(FIGURES.map((f) => f.id)).size).toBe(FIGURES.length)
  })

  it('verweist nur auf existierende Bibliotheks-IDs', () => {
    for (const e of FIGURES) for (const id of e.libraryIds) expect(libIds.has(id), `${e.id}: ${id}`).toBe(true)
  })

  it('findet Figuren über Bibliotheks-ID', () => {
    expect(figureForLibraryId('Barbell_Bench_Press_-_Medium_Grip')?.id).toBe('bench-press')
    expect(figureForLibraryId('Pushups')?.id).toBe('push-up')
    expect(figureForLibraryId('Barbell_Squat')?.id).toBe('back-squat')
    expect(figureForLibraryId('Plank')?.id).toBe('plank')
    expect(figureForLibraryId('Gibt_es_nicht')).toBeNull()
  })

  it('findet Figuren über deutsche Namen', () => {
    const cases: [string, string][] = [
      ['Bankdrücken', 'bench-press'],
      ['Bankdrücken (Langhantel)', 'bench-press'],
      ['Schrägbankdrücken', 'incline-press'],
      ['Kurzhantel-Bankdrücken', 'db-bench-press'],
      ['Butterfly', 'butterfly'],
      ['Fliegende', 'db-fly'],
      ['Liegestütze', 'push-up'],
      ['Dips', 'dips'],
      ['Schulterdrücken', 'db-shoulder-press'],
      ['Seitheben', 'lateral-raise'],
      ['Frontheben', 'front-raise'],
      ['Reverse Flys', 'reverse-fly'],
      ['Face Pulls', 'face-pull'],
      ['Klimmzüge', 'pull-up'],
      ['Latzug', 'lat-pulldown'],
      ['Langhantelrudern vorgebeugt', 'bent-over-row'],
      ['Kurzhantelrudern einarmig', 'one-arm-row'],
      ['Kabelrudern sitzend', 'cable-row'],
      ['Kreuzheben', 'deadlift'],
      ['Rumänisches Kreuzheben', 'romanian-deadlift'],
      ['Kniebeuge', 'back-squat'],
      ['Goblet Squat', 'goblet-squat'],
      ['Beinpresse', 'leg-press'],
      ['Ausfallschritte', 'lunge'],
      ['Bulgarian Split Squat', 'bulgarian-split-squat'],
      ['Hip Thrust', 'hip-thrust'],
      ['Glute Bridge', 'glute-bridge'],
      ['Beinstrecker', 'leg-extension'],
      ['Beinbeuger', 'leg-curl'],
      ['Wadenheben', 'calf-raise'],
      ['Bizepscurls', 'db-curl'],
      ['Langhantel Curls', 'bb-curl'],
      ['Hammercurls', 'hammer-curl'],
      ['Trizepsdrücken am Kabel', 'triceps-pushdown'],
      ['Skull Crusher', 'skull-crusher'],
      ['Overhead-Trizeps', 'overhead-triceps'],
      ['Crunches', 'crunch'],
      ['Plank', 'plank'],
      ['Seitstütz', 'side-plank'],
      ['Hängendes Beinheben', 'hanging-leg-raise'],
      ['Russian Twist', 'russian-twist'],
      ['Mountain Climbers', 'mountain-climber'],
      ['Burpees', 'burpee'],
      ['Hampelmann', 'jumping-jack'],
      ['Air Squat', 'air-squat'],
      ['Wandsitzen', 'wall-sit'],
      ['Superman', 'superman'],
      ['Jump Squats', 'jump-squat'],
      ['High Knees', 'high-knees'],
      ['  bankdrucken ', 'bench-press'],
    ]
    for (const [name, id] of cases) expect(figureForName(name)?.id, name).toBe(id)
    expect(figureForName('Unbekannte Übung')).toBeNull()
  })

  it('jeder deutsche Katalogname wird aufgelöst', () => {
    for (const e of FIGURES) expect(figureForName(e.name)?.id).toBe(e.id)
    expect(getFigure('bench-press')?.name).toBe('Bankdrücken (Langhantel)')
  })

  it('deckt die kuratierten Schnell-Workout-Übungen gut ab', () => {
    const ids = [...PREFERRED]
    const covered = ids.filter((id) => figureForLibraryId(id))
    expect(covered.length / ids.length).toBeGreaterThan(0.6)
  })
})
