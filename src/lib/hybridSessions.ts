// Hybrid-Einheiten: Laufen + Stationen im Wechsel (Wettkampf-Stil wie bei HYROX, auch als Gym- oder Zuhause-Variante).
// Zeit läuft durch, „Weiter“ nimmt die Zwischenzeit je Abschnitt. Ergebnisse in profiles.prefs.hybridRuns.
// Reine Logik – getestet in hybridSessions.test.ts.

export type PartKind = 'run' | 'station'

export interface Part {
  kind: PartKind
  name: string
  /** Vorgabe, z. B. „1 km“, „50 m“, „100 Wdh.“ */
  target: string
}

export interface HybridTemplate {
  id: string
  name: string
  sub: string
  /** grobe Dauer in Minuten */
  minutes: number
  equipment: 'gym' | 'hyrox' | 'none'
  parts: Part[]
}

export interface HybridRun {
  template: string
  date: string
  /** Gesamtzeit in Sekunden */
  total: number
  /** Zeit je Abschnitt in Sekunden (gleiche Reihenfolge wie die Vorlage) */
  splits: number[]
}

const run = (target: string, name = 'Laufen'): Part => ({ kind: 'run', name, target })
const st = (name: string, target: string): Part => ({ kind: 'station', name, target })

/** Abwechselnd Lauf + Station */
const alternate = (runTarget: string, stations: Part[]): Part[] => stations.flatMap((s) => [run(runTarget), s])

export const HYBRID_TEMPLATES: HybridTemplate[] = [
  {
    id: 'race-full',
    name: 'Wettkampf-Simulation',
    sub: '8 × 1 km Lauf + 8 Stationen (Format wie HYROX)',
    minutes: 90,
    equipment: 'hyrox',
    parts: alternate('1 km', [
      st('SkiErg', '1000 m'),
      st('Schlitten schieben', '50 m'),
      st('Schlitten ziehen', '50 m'),
      st('Burpee-Weitsprünge', '80 m'),
      st('Rudern', '1000 m'),
      st('Farmer’s Carry', '200 m'),
      st('Sandsack-Ausfallschritte', '100 m'),
      st('Wall Balls', '100 Wdh.'),
    ]),
  },
  {
    id: 'race-half',
    name: 'Halbe Simulation',
    sub: '8 × 500 m Lauf + halbe Stationen',
    minutes: 45,
    equipment: 'hyrox',
    parts: alternate('500 m', [
      st('SkiErg', '500 m'),
      st('Schlitten schieben', '25 m'),
      st('Schlitten ziehen', '25 m'),
      st('Burpee-Weitsprünge', '40 m'),
      st('Rudern', '500 m'),
      st('Farmer’s Carry', '100 m'),
      st('Sandsack-Ausfallschritte', '50 m'),
      st('Wall Balls', '50 Wdh.'),
    ]),
  },
  {
    id: 'gym-hybrid',
    name: 'Gym-Hybrid',
    sub: 'Laufband + Geräte, die jedes Gym hat',
    minutes: 40,
    equipment: 'gym',
    parts: alternate('800 m', [
      st('Rudern', '500 m'),
      st('Kettlebell-Swings', '30 Wdh.'),
      st('Ausfallschritte mit Kurzhanteln', '30 Schritte'),
      st('Thrusters (Kurzhanteln)', '20 Wdh.'),
      st('Farmer’s Carry', '100 m'),
      st('Burpees', '15 Wdh.'),
    ]),
  },
  {
    id: 'engine',
    name: 'Engine-Intervalle',
    sub: '5 Runden: 400 m + Burpees + Swings',
    minutes: 25,
    equipment: 'gym',
    parts: Array.from({ length: 5 }, () => [
      run('400 m'),
      st('Burpees', '12 Wdh.'),
      st('Kettlebell-Swings', '20 Wdh.'),
    ]).flat(),
  },
  {
    id: 'home',
    name: 'Zuhause & draußen',
    sub: 'Ohne Geräte: Laufen + Körpergewicht',
    minutes: 30,
    equipment: 'none',
    parts: Array.from({ length: 5 }, () => [
      run('400 m'),
      st('Kniebeugen', '20 Wdh.'),
      st('Liegestütze', '12 Wdh.'),
      st('Ausfallschritte', '20 Wdh.'),
    ]).flat(),
  },
]

export const templateById = (id: string) => HYBRID_TEMPLATES.find((t) => t.id === id) ?? null

/** 75 → „1:15“, 3725 → „1:02:05“ */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Zwischenzeiten aus Zeitstempeln (ms): Start + Ende jedes Abschnitts. Pausen werden abgezogen. */
export function splitsFrom(start: number, marks: readonly number[], pausedMs: readonly number[] = []): number[] {
  return marks.map((m, i) => Math.max(0, (m - (i ? marks[i - 1] : start) - (pausedMs[i] ?? 0)) / 1000))
}

export interface RunSummary {
  total: number
  runTime: number
  stationTime: number
  slowest: { name: string; sec: number } | null
}

export function summarize(t: HybridTemplate, splits: readonly number[]): RunSummary {
  let runTime = 0
  let stationTime = 0
  let slowest: RunSummary['slowest'] = null
  splits.forEach((sec, i) => {
    const p = t.parts[i]
    if (!p) return
    if (p.kind === 'run') runTime += sec
    else {
      stationTime += sec
      if (!slowest || sec > slowest.sec) slowest = { name: p.name, sec }
    }
  })
  return { total: runTime + stationTime, runTime, stationTime, slowest }
}

/** Bestzeit einer Vorlage (nur vollständige Läufe). */
export function bestRun(runs: readonly HybridRun[], template: HybridTemplate): HybridRun | null {
  const full = runs.filter((r) => r.template === template.id && r.splits.length === template.parts.length)
  return full.reduce<HybridRun | null>((b, r) => (!b || r.total < b.total ? r : b), null)
}

/** Gespeicherte Läufe prüfen (aus profiles.prefs), neueste zuletzt, höchstens 40. */
export function normalizeRuns(v: unknown): HybridRun[] {
  if (!Array.isArray(v)) return []
  return v
    .filter(
      (r): r is HybridRun =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as HybridRun).template === 'string' &&
        typeof (r as HybridRun).date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test((r as HybridRun).date) &&
        Number.isFinite((r as HybridRun).total) &&
        Array.isArray((r as HybridRun).splits),
    )
    .map((r) => ({
      template: r.template.slice(0, 30),
      date: r.date,
      total: Math.max(0, Math.round(r.total)),
      splits: r.splits
        .filter((x) => Number.isFinite(x))
        .map((x) => Math.max(0, Math.round(x)))
        .slice(0, 60),
    }))
    .slice(-40)
}
