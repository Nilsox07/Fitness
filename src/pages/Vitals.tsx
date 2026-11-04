import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { MetricCard, SeriesChart, StatusChip, TrendChart } from '../components/health/Charts'
import { Hero, HeroPill, Stat } from '../components/health/ui'
import { useHealthDaily } from '../hooks/useHealth'
import { useNutritionSettings } from '../hooks/useNutrition'
import { bpCategory, personalNormal, vo2Category, type FactorStatus } from '../lib/health'
import { localDate } from '../lib/day'
import type { HealthDaily } from '../types'

type NumKey = {
  [K in keyof HealthDaily]-?: NonNullable<HealthDaily[K]> extends number ? K : never
}[keyof HealthDaily]

const de = (v: number, d = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: d })

/** Fortschritt → Herz & Körper: Puls, HRV, Sauerstoff, Atmung, VO₂max, Aktivität und Körperwerte. */
export default function Vitals() {
  const heroBuddy = useHeroBuddy('vitals')
  const { data: daily = [], isLoading } = useHealthDaily(60)
  const { data: settings } = useNutritionSettings()
  const asc = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1))
  const td = daily.find((d) => d.date === localDate())

  const series = (k: NumKey, days = 30): [string, number][] =>
    asc
      .slice(-days)
      .filter((d) => d[k] != null)
      .map((d) => [d.date, d[k] as number])
  const latest = (k: NumKey) => {
    const s = series(k, 60)
    return s.length ? s[s.length - 1][1] : null
  }

  const rhr = series('resting_hr')
  const hrv = series('hrv_ms')
  const rhrN = personalNormal(rhr.map((x) => x[1]))
  const hrvN = personalNormal(hrv.map((x) => x[1]))
  const rhrNow = latest('resting_hr')
  const hrvNow = latest('hrv_ms')
  const vo2 = latest('vo2max')
  const bpS = latest('bp_sys')
  const bpD = latest('bp_dia')
  const week = asc.slice(-7)
  const sum = (k: NumKey) => week.reduce((s, d) => s + ((d[k] as number | null) ?? 0), 0)
  const hourly = (td?.hr_hourly ?? [])
    .map((v, h) => [h, v] as [number, number | null])
    .filter((x): x is [number, number] => x[1] != null)

  const rhrStatus: FactorStatus | null =
    rhrN && rhrNow != null ? (rhrNow > rhrN.hi + 2 ? 'schwach' : rhrNow <= rhrN.mean ? 'gut' : 'normal') : null
  const hrvStatus: FactorStatus | null =
    hrvN && hrvNow != null ? (hrvNow < hrvN.lo ? 'schwach' : hrvNow >= hrvN.mean ? 'gut' : 'normal') : null

  const v = (k: NumKey) => latest(k)
  const body: { label: string; value: string; chip?: FactorStatus }[] = []
  if (v('weight_kg') != null) body.push({ label: 'Gewicht', value: `${de(v('weight_kg')!)} kg` })
  if (v('body_fat_pct') != null) body.push({ label: 'Körperfett', value: `${de(v('body_fat_pct')!)} %` })
  if (bpS != null && bpD != null) {
    const c = bpCategory(bpS, bpD)
    body.push({ label: `Blutdruck · ${c.label}`, value: `${bpS}/${bpD}`, chip: c.status })
  }
  if (v('glucose_mmol') != null) body.push({ label: 'Blutzucker', value: `${de(v('glucose_mmol')!)} mmol/l` })
  if (v('body_temp_c') != null) body.push({ label: 'Körpertemperatur', value: `${de(v('body_temp_c')!)} °C` })
  if (v('spo2') != null) body.push({ label: 'Sauerstoff · normal 95–100 %', value: `${de(v('spo2')!)} %` })
  if (v('resp_rate') != null) body.push({ label: 'Atemfrequenz pro Minute', value: de(v('resp_rate')!) })

  const activity = (
    [
      ['Schritte', sum('steps'), ''],
      ['Strecke', Math.round(sum('distance_m') / 100) / 10, ' km'],
      ['Etagen', sum('floors'), ''],
      ['Aktive kcal', sum('active_kcal'), ''],
    ] as const
  ).filter(([, x]) => x > 0)

  if (isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-sand" />

  return (
    <div className="space-y-5">
      <ProgressHeader title="Herz & Körper" subtitle="Von deiner Uhr" />
      {daily.length === 0 && <p className="card text-sm text-cocoa-light">Noch keine Werte von deiner Uhr.</p>}

      {(hourly.length > 1 || rhrNow != null) && (
        <Hero
          buddy={heroBuddy}
          overline="Puls · heute"
          value={td?.hr_avg ?? rhrNow ?? '–'}
          unit={td?.hr_avg ? 'bpm Ø' : 'bpm Ruhe'}
        >
          {hourly.length > 1 && (
            <div className="mt-3">
              <SeriesChart data={hourly} height={90} dark xLabel={(h) => `${h} Uhr`} />
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {rhrNow != null && <HeroPill value={rhrNow} label="Ruhepuls" />}
            {hrvNow != null && <HeroPill value={Math.round(hrvNow)} label="HRV (ms)" />}
            {td?.hr_max != null && <HeroPill value={td.hr_max} label="Maximum" />}
          </div>
        </Hero>
      )}

      {rhr.length > 0 && (
        <MetricCard
          title="Ruhepuls · 30 Tage"
          value={`${rhrNow} bpm`}
          sub={rhrN ? `Schnitt ${Math.round(rhrN.mean)}` : undefined}
          right={rhrStatus && <StatusChip status={rhrStatus} />}
        >
          <TrendChart points={rhr} normal={rhrN} unit="bpm" />
          <p className="text-[11px] text-cocoa-muted">
            Sinkt er über Wochen, wird dein Herz fitter. Plötzlich höher: Erholung, Stress oder Infekt.
          </p>
        </MetricCard>
      )}

      {hrv.length > 0 && (
        <MetricCard
          title="Erholung (HRV) · 30 Tage"
          value={`${Math.round(hrvNow ?? 0)} ms`}
          sub={hrvN ? `Schnitt ${Math.round(hrvN.mean)} ms` : undefined}
          right={hrvStatus && <StatusChip status={hrvStatus} />}
        >
          <TrendChart points={hrv} normal={hrvN} unit="ms" />
          <p className="text-[11px] text-cocoa-muted">
            Höher als dein Schnitt = gut erholt. Wichtig ist dein eigener Verlauf – Werte anderer Menschen sind nicht
            vergleichbar.
          </p>
        </MetricCard>
      )}

      {vo2 != null && (
        <MetricCard
          title="VO₂max · Ausdauer-Fitness"
          value={de(vo2)}
          sub={`ml/kg/min · ${vo2Category(vo2, settings?.age, settings?.sex)}`}
        >
          {series('vo2max', 60).length > 1 && <TrendChart points={series('vo2max', 60)} unit="" decimals={1} />}
        </MetricCard>
      )}

      {week.length > 0 && activity.length > 0 && (
        <section style={enter(5)}>
          <SectionLabel>Aktivität · letzte 7 Tage</SectionLabel>
          <div className="card space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {activity.map(([l, x, u]) => (
                <Stat
                  key={l}
                  value={`${x.toLocaleString('de-DE')}${u}`}
                  label={`${l} · Ø ${Math.round(x / week.length).toLocaleString('de-DE')}/Tag`}
                />
              ))}
            </div>
            {week.some((d) => d.steps) && (
              <div className="flex h-16 items-end gap-1.5">
                {week.map((d, i) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-md ${i === week.length - 1 ? 'bg-brand' : 'bg-brand/35'}`}
                      style={{ height: `${Math.max(3, Math.min(48, ((d.steps ?? 0) / 12000) * 48))}px` }}
                    />
                    <span className="text-[9px] text-cocoa-muted">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {body.length > 0 && (
        <section style={enter(6)}>
          <SectionLabel>Körperwerte</SectionLabel>
          <div className="card space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {body.map((b) => (
                <div key={b.label} className="min-w-0 rounded-xl bg-sand-light px-3 py-2.5 dark:bg-sand">
                  <div className="flex items-center gap-1.5">
                    <span className="tabular truncate text-base font-bold">{b.value}</span>
                    {b.chip && <StatusChip status={b.chip} />}
                  </div>
                  <div className="truncate text-[11px] text-cocoa-muted">{b.label}</div>
                </div>
              ))}
            </div>
            {series('weight_kg', 60).length > 1 && (
              <TrendChart points={series('weight_kg', 60)} unit="kg" decimals={1} />
            )}
          </div>
        </section>
      )}

      <p className="px-1 text-[11px] text-cocoa-muted">Keine medizinische Diagnose.</p>
    </div>
  )
}
