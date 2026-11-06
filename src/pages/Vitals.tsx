import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { MetricCard, RangeBar, SeriesChart, StatusChip, TrendChart } from '../components/health/Charts'
import { Hero, HeroPill, Stat } from '../components/health/ui'
import { useHealthDaily } from '../hooks/useHealth'
import { useNutritionSettings } from '../hooks/useNutrition'
import { bpCategory, personalNormal, vo2Category, type FactorStatus, type ScaleRange } from '../lib/health'
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
  // Skala mit üblichem Normalbereich (Richtwerte für Erwachsene in Ruhe) – nur zur Einordnung
  const body: { label: string; value: string; chip?: FactorStatus; range?: ScaleRange }[] = []
  if (v('weight_kg') != null) body.push({ label: 'Gewicht', value: `${de(v('weight_kg')!)} kg` })
  if (v('body_fat_pct') != null) body.push({ label: 'Körperfett', value: `${de(v('body_fat_pct')!)} %` })
  if (bpS != null && bpD != null) {
    const c = bpCategory(bpS, bpD)
    body.push({
      label: `Blutdruck · ${c.label}`,
      value: `${bpS}/${bpD}`,
      chip: c.status,
      range: { value: bpS, min: 90, max: 180, lo: 90, hi: 130 },
    })
  }
  if (v('glucose_mmol') != null)
    body.push({
      label: 'Blutzucker · mmol/l',
      value: de(v('glucose_mmol')!),
      range: { value: v('glucose_mmol')!, min: 3, max: 10, lo: 3.9, hi: 7.8 },
    })
  if (v('body_temp_c') != null)
    body.push({
      label: 'Körpertemperatur',
      value: `${de(v('body_temp_c')!)} °C`,
      range: { value: v('body_temp_c')!, min: 35.5, max: 38.5, lo: 36.1, hi: 37.4 },
    })
  if (v('spo2') != null)
    body.push({
      label: 'Sauerstoff · normal 95–100 %',
      value: `${de(v('spo2')!)} %`,
      range: { value: v('spo2')!, min: 85, max: 100, lo: 95, hi: 100 },
    })
  if (v('resp_rate') != null)
    body.push({
      label: 'Atemzüge pro Minute',
      value: de(v('resp_rate')!),
      range: { value: v('resp_rate')!, min: 6, max: 26, lo: 12, hi: 20 },
    })

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
              <SeriesChart data={hourly} height={90} dark unit="bpm" label="Puls heute" xLabel={(h) => `${h} Uhr`} />
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
              <div>
                <h3 className="mb-1 text-xs font-semibold text-cocoa-muted">Schritte pro Tag</h3>
                <div className="relative flex items-end gap-1.5" style={{ height: 76 }}>
                  {(() => {
                    const top = Math.max(10000, ...week.map((d) => d.steps ?? 0))
                    return (
                      <>
                        <div
                          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-cocoa-muted/50"
                          style={{ bottom: (10000 / top) * 48 + 16 }}
                        />
                        {week.map((d, i) => (
                          <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
                            <span className="tabular text-[9px] font-semibold text-cocoa-light">
                              {d.steps ? `${de(d.steps / 1000, 1)}k` : ''}
                            </span>
                            <div
                              className={`w-full rounded-md ${i === week.length - 1 ? 'bg-brand' : 'bg-brand/35'}`}
                              style={{ height: `${Math.max(3, ((d.steps ?? 0) / top) * 48)}px` }}
                            />
                            <span className="text-[9px] text-cocoa-muted">
                              {new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
                            </span>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-cocoa-muted">
                  <span className="w-3 border-t border-dashed border-cocoa-muted" aria-hidden />
                  10.000 Schritte
                </p>
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
                  {b.range && <RangeBar className="mt-1.5" range={b.range} status={b.chip} />}
                </div>
              ))}
            </div>
            {body.some((b) => b.range) && (
              <p className="flex items-center gap-1.5 text-[10px] text-cocoa-muted">
                <span className="inline-block h-1.5 w-3 rounded-full bg-sand-dark" aria-hidden />
                üblicher Bereich in Ruhe
              </p>
            )}
            {series('weight_kg', 60).length > 1 && (
              <>
                <h3 className="pt-1 text-xs font-semibold text-cocoa-muted">Gewicht · 60 Tage</h3>
                <TrendChart points={series('weight_kg', 60)} unit="kg" decimals={1} />
              </>
            )}
          </div>
        </section>
      )}

      <p className="px-1 text-[11px] text-cocoa-muted">Keine medizinische Diagnose.</p>
    </div>
  )
}
