import { describe, expect, it } from 'vitest'
import {
  adaptiveTdee,
  bedtimeSpread,
  buildInsights,
  dailyLoad,
  fitnessAge,
  intensityMinutes,
  loadByDay,
  loadRatio,
  mergeIntake,
  pairedDiff,
  readinessOn,
  sleepByWeekday,
  sleepDebt,
  stepsTrend,
  topInsights,
  vitalTrend,
  vo2Trend,
  watchTdee,
  weeklyIntensity,
} from './insights'
import { shiftDate } from './day'
import type { HealthActivity, HealthDaily, HealthSleep } from '../types'

const TODAY = '2026-11-02' // Montag

const act = (p: Partial<HealthActivity>): HealthActivity => ({
  id: Math.random().toString(),
  user_id: 'u',
  source_id: Math.random().toString(),
  source: null,
  type: 'run',
  title: null,
  started_at: `${TODAY}T07:00:00Z`,
  duration_s: 3600,
  distance_m: 10000,
  kcal: 600,
  avg_hr: 150,
  max_hr: 170,
  elevation_m: null,
  route: null,
  ...p,
})

const day = (date: string, p: Partial<HealthDaily> = {}): HealthDaily => ({
  user_id: 'u',
  date,
  steps: null,
  active_kcal: null,
  resting_hr: null,
  hrv_ms: null,
  vo2max: null,
  ...p,
})

const night = (date: string, asleep: number, bed = '23:00', p: Partial<HealthSleep> = {}): HealthSleep => {
  const [h, m] = bed.split(':').map(Number)
  // Einschlafen am Vorabend (bzw. nach Mitternacht am selben Tag)
  const startDate = h >= 12 ? shiftDate(date, -1) : date
  return {
    user_id: 'u',
    date,
    start_at: `${startDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`,
    end_at: `${date}T07:00:00`,
    asleep_min: asleep,
    deep_min: null,
    rem_min: null,
    light_min: null,
    awake_min: null,
    source: null,
    ...p,
  }
}

/** n Tage rückwärts ab heute (inkl. heute), älteste zuerst */
const lastDays = (n: number, end = TODAY) => Array.from({ length: n }, (_, i) => shiftDate(end, -(n - 1 - i)))

describe('Belastung (ACWR)', () => {
  it('Tagesbelastung aus Ausdauer und Kraftsätzen', () => {
    const m = dailyLoad(
      [act({ started_at: '2026-11-01T08:00:00Z', duration_s: 3600, avg_hr: null })],
      ['2026-11-01', '2026-11-01', '2026-10-31'],
    )
    // 60 min × 0,65² × 1,5 ≈ 38 + 2 × 2,5
    expect(m.get('2026-11-01')).toBe(38 + 5)
    expect(m.get('2026-10-31')).toBe(2.5)
  })

  it('zu wenig Verlauf → nichts', () => {
    const load = new Map(lastDays(10).map((d) => [d, 50]))
    expect(loadRatio(load, TODAY)).toBeNull()
    expect(loadRatio(new Map(), TODAY)).toBeNull()
  })

  it('gleichmäßig → grüner Bereich', () => {
    const load = new Map(
      lastDays(28)
        .filter((_, i) => i % 2 === 0)
        .map((d) => [d, 50]),
    )
    const r = loadRatio(load, TODAY)!
    expect(r.ratio).toBeGreaterThanOrEqual(0.8)
    expect(r.ratio).toBeLessThanOrEqual(1.3)
    expect(r.status).toBe('ok')
  })

  it('plötzlich viel mehr → steigt zu schnell', () => {
    const load = new Map<string, number>()
    lastDays(28).forEach((d, i) => i % 3 === 0 && load.set(d, 30))
    lastDays(7).forEach((d) => load.set(d, 100))
    const r = loadRatio(load, TODAY)!
    expect(r.ratio).toBeGreaterThan(1.5)
    expect(r.status).toBe('high')
  })

  it('letzte Woche Pause → Form baut ab', () => {
    const load = new Map<string, number>()
    lastDays(28)
      .slice(0, 21)
      .forEach((d, i) => i % 2 === 0 && load.set(d, 60))
    const r = loadRatio(load, TODAY)!
    expect(r.ratio).toBe(0)
    expect(r.status).toBe('low')
  })
})

describe('VO₂max & Fitnessalter', () => {
  it('Fitnessalter aus der Normtabelle', () => {
    expect(fitnessAge(49, 'm', 40)).toBe(35)
    expect(fitnessAge(47, 'm', 30)).toBe(45)
    expect(fitnessAge(40, 'f', 50)).toBe(35)
    // sehr fit → nicht jünger als 20, sehr unfit → nicht älter als 80
    expect(fitnessAge(70, 'm', 40)).toBe(20)
    expect(fitnessAge(12, 'f', 40)).toBe(80)
    // dazwischen interpoliert
    expect(fitnessAge(48, 'm', 40)).toBe(40)
  })

  it('ohne Geschlecht oder Alter kein Fitnessalter', () => {
    expect(fitnessAge(45, null, 40)).toBeNull()
    expect(fitnessAge(45, 'm', null)).toBeNull()
    expect(fitnessAge(45, 'x', 40)).toBeNull()
  })

  it('Trend über ca. 90 Tage', () => {
    const d = [
      day(shiftDate(TODAY, -95), { vo2max: 44 }),
      day(shiftDate(TODAY, -40), { vo2max: 45 }),
      day(TODAY, { vo2max: 46.5 }),
    ]
    const t = vo2Trend(d, TODAY)!
    expect(t.latest).toBe(46.5)
    expect(t.delta).toBe(2.5)
  })

  it('ohne alten Wert kein Trend, zu alter letzter Wert → nichts', () => {
    expect(vo2Trend([day(TODAY, { vo2max: 40 })], TODAY)!.delta).toBeNull()
    expect(vo2Trend([day(shiftDate(TODAY, -70), { vo2max: 40 })], TODAY)).toBeNull()
    expect(vo2Trend([day(TODAY)], TODAY)).toBeNull()
  })
})

describe('Ruhepuls & HRV', () => {
  const series = (key: 'resting_hr' | 'hrv_ms', recent: number, base: number) =>
    lastDays(90).map((d, i) => day(d, { [key]: i >= 60 ? recent : base }))

  it('sinkender Ruhepuls', () => {
    const t = vitalTrend(series('resting_hr', 55, 58), 'resting_hr', TODAY)!
    expect(t.diff).toBe(-3)
  })

  it('steigende HRV in Prozent', () => {
    const t = vitalTrend(series('hrv_ms', 66, 60), 'hrv_ms', TODAY)!
    expect(Math.round(t.pct)).toBe(10)
  })

  it('zu wenige Werte → nichts', () => {
    const d = lastDays(90).map((x, i) => day(x, { resting_hr: i % 10 === 0 ? 60 : null }))
    expect(vitalTrend(d, 'resting_hr', TODAY)).toBeNull()
  })
})

describe('Schlaf', () => {
  it('Schlafschuld der letzten 7 Nächte', () => {
    const s = lastDays(7).map((d) => night(d, 420))
    expect(sleepDebt(s, TODAY)!.debtMin).toBe(7 * 60)
    // lange Nächte gleichen aus
    const s2 = lastDays(7).map((d, i) => night(d, i % 2 ? 420 : 540))
    expect(sleepDebt(s2, TODAY)!.debtMin).toBe(-60)
    // anderer Bedarf
    expect(sleepDebt(s, TODAY, 420)!.debtMin).toBe(0)
  })

  it('zu wenige Nächte → nichts', () => {
    expect(
      sleepDebt(
        lastDays(4).map((d) => night(d, 400)),
        TODAY,
      ),
    ).toBeNull()
  })

  it('Regelmäßigkeit der Schlafenszeit (auch über Mitternacht)', () => {
    const steady = lastDays(10).map((d, i) => night(d, 450, i % 2 ? '23:40' : '0:20'))
    const r = bedtimeSpread(steady, TODAY)!
    expect(r.spreadMin).toBe(20)
    expect(r.avgBed).toBe('0:00')
    const wild = lastDays(10).map((d, i) => night(d, 450, i % 2 ? '21:30' : '1:30'))
    expect(bedtimeSpread(wild, TODAY)!.spreadMin).toBeGreaterThanOrEqual(60)
    expect(
      bedtimeSpread(
        lastDays(5).map((d) => night(d, 450)),
        TODAY,
      ),
    ).toBeNull()
  })

  it('beste und schlechteste Nacht nach Wochentag', () => {
    // Nacht auf Samstag lang, auf Dienstag kurz
    const s = lastDays(56).map((d) => {
      const wd = new Date(d + 'T12:00:00Z').getUTCDay()
      return night(d, wd === 6 ? 540 : wd === 2 ? 360 : 450)
    })
    const r = sleepByWeekday(s, TODAY)!
    expect(r.best.day).toBe('Samstag')
    expect(r.worst.day).toBe('Dienstag')
    expect(r.best.avgMin - r.worst.avgMin).toBe(180)
  })

  it('kein Unterschied → nichts', () => {
    expect(
      sleepByWeekday(
        lastDays(56).map((d) => night(d, 450)),
        TODAY,
      ),
    ).toBeNull()
  })
})

describe('Aktivität', () => {
  it('Intensitätsminuten aus dem Puls-Verlauf (intensiv zählt doppelt)', () => {
    // 10 min locker (110), 20 min moderat (130), 10 min intensiv (160) bei Max 190
    const series: [number, number][] = []
    for (let t = 0; t <= 2400; t += 60) series.push([t, t <= 600 ? 110 : t <= 1800 ? 130 : 160])
    const m = intensityMinutes(act({ duration_s: 2400, hr_series: series }), 190)
    // Übergänge zählen mit dem Mittelwert beider Punkte
    expect(m.vigorous).toBe(9)
    expect(m.moderate).toBe(20)
    expect(m.total).toBe(38)
  })

  it('ohne Verlauf: Durchschnittspuls, ohne Puls: Sportart', () => {
    expect(intensityMinutes(act({ duration_s: 1800, avg_hr: 125 }), 190).moderate).toBe(30)
    expect(intensityMinutes(act({ duration_s: 1800, avg_hr: 100 }), 190).total).toBe(0)
    expect(intensityMinutes(act({ duration_s: 1800, avg_hr: null, type: 'walk' }), 190).total).toBe(30)
    expect(intensityMinutes(act({ duration_s: 1800, avg_hr: null, type: 'run' }), 190).total).toBe(60)
  })

  it('Woche summiert nur die letzten 7 Tage', () => {
    const list = [
      act({ started_at: `${TODAY}T07:00:00Z`, duration_s: 1800, avg_hr: 125 }),
      act({ started_at: `${shiftDate(TODAY, -6)}T07:00:00Z`, duration_s: 1800, avg_hr: 125 }),
      act({ started_at: `${shiftDate(TODAY, -7)}T07:00:00Z`, duration_s: 1800, avg_hr: 125 }),
    ]
    expect(weeklyIntensity(list, TODAY, 190).total).toBe(60)
  })

  it('Schritte-Trend der letzten Woche gegen 3 Wochen davor', () => {
    const d = lastDays(29).map((x, i) => day(x, { steps: i >= 21 ? 11000 : 10000 }))
    const t = stepsTrend(d, TODAY)!
    expect(t.recent).toBe(11000)
    expect(t.before).toBe(10000)
    expect(t.pct).toBe(10)
    expect(
      stepsTrend(
        lastDays(8).map((x) => day(x, { steps: 5000 })),
        TODAY,
      ),
    ).toBeNull()
  })
})

describe('Energie: tatsächlicher Verbrauch', () => {
  /** 28 Tage gleich viel gegessen, Gewicht linear */
  const setup = (kcal: number, kgPerDay: number, logEvery = 1, weighEvery = 2) => {
    const days = lastDays(28, shiftDate(TODAY, -1))
    const intake = new Map(days.filter((_, i) => i % logEvery === 0).map((d) => [d, kcal]))
    const weights = days
      .filter((_, i) => i % weighEvery === 0)
      .map((d, i) => ({ date: d, kg: 80 + kgPerDay * i * weighEvery }))
    return { intake, weights }
  }

  it('stabiles Gewicht → Verbrauch = Zufuhr', () => {
    const { intake, weights } = setup(2500, 0)
    const r = adaptiveTdee(intake, weights, TODAY)!
    expect(r.tdee).toBe(2500)
    expect(r.weightChangeKg).toBe(0)
    expect(r.confidence).toBe('hoch')
  })

  it('Abnahme von 0,5 kg/Woche → Verbrauch höher als Zufuhr', () => {
    const { intake, weights } = setup(2000, -0.5 / 7)
    const r = adaptiveTdee(intake, weights, TODAY)!
    // 0,5 kg × 7700 / 7 = 550 kcal/Tag
    expect(r.tdee).toBe(2550)
    expect(r.perWeekKg).toBe(-0.5)
  })

  it('Zunahme → Verbrauch niedriger', () => {
    const { intake, weights } = setup(3000, 0.2 / 7)
    expect(adaptiveTdee(intake, weights, TODAY)!.tdee).toBe(2780)
  })

  it('zu wenig erfasst, zu wenige Wiegungen oder zu kurz → nichts', () => {
    const a = setup(2500, 0, 4)
    expect(adaptiveTdee(a.intake, a.weights, TODAY)).toBeNull()
    const b = setup(2500, 0, 1, 10)
    expect(adaptiveTdee(b.intake, b.weights, TODAY)).toBeNull()
    const c = setup(2500, 0)
    expect(adaptiveTdee(c.intake, c.weights.slice(-5), TODAY)).toBeNull()
  })

  it('unvollständige Tage (< 800 kcal) zählen nicht', () => {
    const { intake, weights } = setup(2500, 0)
    const days = [...intake.keys()]
    days.slice(0, 5).forEach((d) => intake.set(d, 300))
    expect(adaptiveTdee(intake, weights, TODAY)!.tdee).toBe(2500)
  })

  it('Health-Connect-Essen nur an Tagen ohne App-Einträge (nie doppelt)', () => {
    const m = mergeIntake(
      [
        { date: '2026-11-01', kcal: 800 },
        { date: '2026-11-01', kcal: 1200 },
      ],
      [day('2026-11-01', { nutrition_kcal: 2500 }), day('2026-10-31', { nutrition_kcal: 2100 }), day('2026-10-30')],
    )
    expect(m.get('2026-11-01')).toBe(2000)
    expect(m.get('2026-10-31')).toBe(2100)
    expect(m.has('2026-10-30')).toBe(false)
  })

  it('Verbrauch laut Uhr', () => {
    const d = lastDays(15).map((x) => day(x, { total_kcal: 2800 }))
    expect(watchTdee(d, TODAY)).toBe(2800)
    expect(watchTdee(d.slice(-5), TODAY)).toBeNull()
  })
})

describe('Zusammenhänge', () => {
  it('Vergleich zweier Tagesgruppen', () => {
    const pairs = [
      ...Array.from({ length: 4 }, () => ({ flag: true, value: 50 })),
      ...Array.from({ length: 8 }, () => ({ flag: false, value: 70 })),
      { flag: null, value: 99 },
    ]
    const r = pairedDiff(pairs)!
    expect(r.diff).toBe(-20)
    expect(r.n).toBe(12)
  })

  it('zu wenige Tage oder eine Gruppe zu klein → nichts', () => {
    expect(pairedDiff([{ flag: true, value: 1 }])).toBeNull()
    expect(
      pairedDiff([
        ...Array.from({ length: 2 }, () => ({ flag: true, value: 50 })),
        ...Array.from({ length: 10 }, () => ({ flag: false, value: 70 })),
      ]),
    ).toBeNull()
  })
})

describe('buildInsights', () => {
  it('ohne Daten keine Karten', () => {
    expect(buildInsights({ today: TODAY, hasWatch: true })).toEqual([])
    expect(buildInsights({ today: TODAY, hasWatch: false })).toEqual([])
  })

  it('ohne Uhr nur Energie – auch wenn Uhr-Daten im Cache sind', () => {
    const days = lastDays(28, shiftDate(TODAY, -1))
    const list = buildInsights({
      today: TODAY,
      hasWatch: false,
      sleep: lastDays(7).map((d) => night(d, 300)),
      daily: lastDays(15).map((x) => day(x, { total_kcal: 2800, nutrition_kcal: 2000 })),
      food: days.map((d) => ({ date: d, kcal: 2200 })),
      weights: days.filter((_, i) => i % 2 === 0).map((d) => ({ date: d, kg: 75 })),
    })
    expect(list.map((x) => x.id)).toEqual(['tdee'])
    expect(list[0].title).toBe('Dein Verbrauch: ca. 2.200 kcal')
    expect(list[0].info).not.toContain('Uhr schätzt')
  })

  it('mit Uhr: Schlafschuld, Fitnessalter, Uhr-Verbrauch; Hinweise zuerst', () => {
    const list = buildInsights({
      today: TODAY,
      hasWatch: true,
      sex: 'm',
      age: 40,
      sleep: lastDays(7).map((d) => night(d, 360)),
      daily: [...lastDays(15).map((x) => day(x, { total_kcal: 2800 })), day(TODAY, { vo2max: 49 })],
    })
    const ids = list.map((x) => x.id)
    expect(ids).toContain('sleep-debt')
    expect(ids).toContain('fitness-age')
    expect(ids).toContain('tdee-watch')
    expect(list[0].id).toBe('sleep-debt')
    expect(list[0].tone).toBe('hint')
    const fa = list.find((x) => x.id === 'fitness-age')!
    expect(fa.title).toBe('Fitnessalter ca. 35')
    expect(fa.value).toBe('5 Jahre jünger als du')
    // eine Zeile: kurze Texte
    for (const x of list) {
      expect(x.title.length).toBeLessThanOrEqual(40)
      expect(x.value.length).toBeLessThanOrEqual(48)
    }
  })

  it('kurze Nächte senken Tagesform und HRV', () => {
    const dates = lastDays(30)
    const short = (i: number) => i % 3 === 0
    const list = buildInsights({
      today: TODAY,
      hasWatch: true,
      sleep: dates.map((d, i) => night(d, short(i) ? 320 : 470)),
      daily: dates.map((d, i) => day(d, { hrv_ms: short(i) ? 45 : 60, resting_hr: short(i) ? 60 : 55 })),
    })
    const r = list.find((x) => x.id === 'sleep-readiness')
    expect(r).toBeTruthy()
    expect(r!.value).toMatch(/Nach < 6 h Schlaf Ø \d+ Punkte weniger/)
    const h = list.find((x) => x.id === 'sleep-hrv')!
    expect(h.value).toBe('Nach < 6 h Schlaf Ø 25 % niedriger')
  })

  it('Übersicht zeigt höchstens 3, wichtigste zuerst', () => {
    const list = buildInsights({
      today: TODAY,
      hasWatch: true,
      sex: 'f',
      age: 30,
      sleep: lastDays(14).map((d, i) => night(d, 330, i % 2 ? '21:00' : '1:30')),
      daily: [
        ...lastDays(29).map((x, i) => day(x, { steps: i >= 21 ? 5000 : 9000, total_kcal: 2300 })),
        day(TODAY, { vo2max: 36 }),
      ],
      activities: [act({})],
    })
    const top = topInsights(list)
    expect(top).toHaveLength(3)
    expect(top[0].priority).toBeGreaterThanOrEqual(top[1].priority)
    expect(top.every((x) => x.tone === 'hint')).toBe(true)
  })
})

describe('buildInsights: Belastung & Aktivität', () => {
  it('Belastung steigt zu schnell + WHO-Minuten', () => {
    const activities: HealthActivity[] = []
    lastDays(28).forEach((d, i) => {
      if (i % 4 === 0) activities.push(act({ started_at: `${d}T07:00:00Z`, duration_s: 1800, avg_hr: 120 }))
    })
    lastDays(5).forEach((d) => activities.push(act({ started_at: `${d}T18:00:00Z`, duration_s: 3600, avg_hr: 160 })))
    const list = buildInsights({ today: TODAY, hasWatch: true, activities })
    const load = list.find((x) => x.id === 'load')!
    expect(load.title).toBe('Belastung steigt zu schnell')
    expect(load.tone).toBe('hint')
    const im = list.find((x) => x.id === 'intensity')!
    expect(im.title).toBe('WHO-Ziel erreicht')
    expect(im.tone).toBe('good')
  })

  it('Uhr-Karten verschwinden ohne Uhr-Bereich', () => {
    const activities = lastDays(28).map((d) => act({ started_at: `${d}T07:00:00Z` }))
    expect(buildInsights({ today: TODAY, hasWatch: false, activities })).toEqual([])
  })
})

describe('buildInsights: Fitnessalter-Grenze', () => {
  it('sehr fit → „unter 20“ statt einer falschen Jahreszahl', () => {
    const list = buildInsights({ today: TODAY, hasWatch: true, sex: 'm', age: 45, daily: [day(TODAY, { vo2max: 62 })] })
    const fa = list.find((x) => x.id === 'fitness-age')!
    expect(fa.title).toBe('Fitnessalter unter 20')
    expect(fa.value).toBe('Top-Wert für dein Alter')
    expect(fa.tone).toBe('good')
  })
})

describe('Tagesform für frühere Tage', () => {
  it('Belastung je Tag: Ausdauer-Load und Kraftsätze', () => {
    const m = loadByDay(
      [act({ started_at: '2026-11-01T08:00:00Z', duration_s: 3600, avg_hr: 150 })],
      ['2026-11-01', '2026-11-01', '2026-10-31'],
    )
    expect(m.get('2026-11-01')!.sets).toBe(2)
    expect(m.get('2026-11-01')!.cardio).toBeGreaterThan(0)
    expect(m.get('2026-10-31')).toEqual({ cardio: 0, sets: 1 })
  })

  it('rechnet aus Schlaf, HRV und Belastung der Vortage – ohne Uhr-Werte null', () => {
    const daily = lastDays(15).map((d) => day(d, { hrv_ms: 60, resting_hr: 55 }))
    const n = night(TODAY, 300)
    const load = new Map([[shiftDate(TODAY, -1), { cardio: 0, sets: 30 }]])
    const r = readinessOn(TODAY, daily, n, load)!
    expect(r.factors.map((f) => f.key)).toEqual(expect.arrayContaining(['sleep', 'hrv', 'rhr', 'strength']))
    expect(r.factors.find((f) => f.key === 'sleep')!.range!.value).toBe(5)
    expect(readinessOn('2026-01-01', [], null, new Map())).toBeNull()
  })
})

describe('Erkenntnisse mit Grafik', () => {
  it('Schlafschuld zeigt Ø-Schlaf gegen den Bedarf, Belastung die Skala mit Idealbereich', () => {
    const sleep = lastDays(7).map((d) => night(d, 360))
    const debt = buildInsights({ today: TODAY, hasWatch: true, sleep }).find((x) => x.id === 'sleep-debt')!
    expect(debt.viz).toEqual({ kind: 'meter', value: 6, max: 10, lo: 8 })
  })
})

describe('ohne Uhr', () => {
  it('Belastung aus Kraftsätzen auch ohne Uhr', () => {
    const today = '2026-11-07'
    const dates: string[] = []
    for (let d = 0; d < 28; d++) {
      const day = new Date(Date.parse(today + 'T12:00:00Z') - d * 86400000).toISOString().slice(0, 10)
      if (d % 2 === 0) for (let k = 0; k < (d < 7 ? 30 : 12); k++) dates.push(day)
    }
    const out = buildInsights({ today, hasWatch: false, strengthSetDates: dates })
    expect(out.some((x) => x.id.startsWith('load'))).toBe(true)
  })
})
