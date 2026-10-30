import type { ReactNode } from 'react'
import { Activity, Droplet, Flame, Footprints, Gauge, HeartPulse, Scale, Thermometer, Wind } from 'lucide-react'
import { enter } from '../components/home/motion'
import { ProgressHeader } from '../components/progress/ProgressHeader'
import { MetricCard, SeriesChart, StatusChip, TrendChart } from '../components/health/Charts'
import { useHealthDaily } from '../hooks/useHealth'
import { useNutritionSettings } from '../hooks/useNutrition'
import { bpCategory, personalNormal, vo2Category } from '../lib/health'
import { localDate } from '../lib/day'
import type { HealthDaily } from '../types'

type NumKey = {
  [K in keyof HealthDaily]-?: NonNullable<HealthDaily[K]> extends number ? K : never
}[keyof HealthDaily]

/** Fortschritt → Herz & Körper: Puls, HRV, Sauerstoff, Atmung, VO₂max, Aktivität und Körperwerte. */
export default function Vitals() {
  const { data: daily = [], isLoading } = useHealthDaily(60)
  const { data: settings } = useNutritionSettings()
  const asc = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1))
  const today = localDate()
  const td = daily.find((d) => d.date === today)

  const series = (k: NumKey, days = 30): [string, number][] =>
    asc
      .slice(-days)
      .filter((d) => d[k] != null)
      .map((d) => [d.date, d[k] as number])
  const latest = (k: NumKey) => {
    const s = series(k, 60)
    return s.length ? s[s.length - 1] : null
  }
  const has = (k: NumKey) => series(k, 60).length > 0

  const rhr = series('resting_hr')
  const hrv = series('hrv_ms')
  const rhrN = personalNormal(rhr.map((x) => x[1]))
  const hrvN = personalNormal(hrv.map((x) => x[1]))
  const vo2 = latest('vo2max')
  const bpS = latest('bp_sys')
  const bpD = latest('bp_dia')
  const week = asc.slice(-7)
  const sum = (k: NumKey) => week.reduce((s, d) => s + ((d[k] as number | null) ?? 0), 0)
  const hourly = (td?.hr_hourly ?? [])
    .map((v, h) => [h, v] as [number, number | null])
    .filter((x): x is [number, number] => x[1] != null)

  if (isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-sand" />

  return (
    <div className="space-y-4">
      <ProgressHeader title="Fortschritt" subtitle="Herz & Körper · von deiner Uhr" />
      {daily.length === 0 && (
        <p className="card text-sm text-cocoa-light">
          Noch keine Werte. Sobald deine Uhr Daten an Health Connect gibt, erscheinen sie hier.
        </p>
      )}

      {(hourly.length > 1 || td?.hr_avg) && (
        <MetricCard
          icon={<HeartPulse size={16} className="text-red-500" />}
          title="Puls heute"
          value={td?.hr_avg ? `Ø ${td.hr_avg}` : undefined}
          sub={td?.hr_min && td?.hr_max ? `${td.hr_min}–${td.hr_max} bpm` : 'bpm'}
        >
          {hourly.length > 1 && <SeriesChart data={hourly} color="#ef4444" height={110} xLabel={(h) => `${h} Uhr`} />}
        </MetricCard>
      )}

      {rhr.length > 0 && (
        <MetricCard
          icon={<HeartPulse size={16} className="text-red-500" />}
          title="Ruhepuls · 30 Tage"
          value={`${rhr[rhr.length - 1][1]} bpm`}
          sub={rhrN ? `Schnitt ${Math.round(rhrN.mean)}` : undefined}
          right={
            rhrN && (
              <StatusChip
                status={
                  rhr[rhr.length - 1][1] > rhrN.hi + 2
                    ? 'schwach'
                    : rhr[rhr.length - 1][1] < rhrN.mean
                      ? 'gut'
                      : 'normal'
                }
              />
            )
          }
        >
          <TrendChart points={rhr} normal={rhrN} color="#ef4444" unit="bpm" />
          <p className="text-[11px] text-cocoa-muted">
            Sinkt er über Wochen, wird dein Herz fitter. Plötzlich höher: Erholung, Stress oder Infekt.
          </p>
        </MetricCard>
      )}

      {hrv.length > 0 && (
        <MetricCard
          icon={<Gauge size={16} className="text-emerald-500" />}
          title="Erholung (HRV) · 30 Tage"
          value={`${Math.round(hrv[hrv.length - 1][1])} ms`}
          sub={hrvN ? `Schnitt ${Math.round(hrvN.mean)} ms` : undefined}
          right={
            hrvN && (
              <StatusChip
                status={
                  hrv[hrv.length - 1][1] < hrvN.lo ? 'schwach' : hrv[hrv.length - 1][1] > hrvN.mean ? 'gut' : 'normal'
                }
              />
            )
          }
        >
          <TrendChart points={hrv} normal={hrvN} color="#10b981" unit="ms" />
          <p className="text-[11px] text-cocoa-muted">
            Höher als dein Schnitt = gut erholt. Wichtig ist dein eigener Verlauf – Werte anderer Menschen sind nicht
            vergleichbar.
          </p>
        </MetricCard>
      )}

      {vo2 && (
        <MetricCard
          icon={<Activity size={16} className="text-sky-500" />}
          title="VO₂max – deine Ausdauer-Fitness"
          value={vo2[1].toLocaleString('de-DE')}
          sub={`ml/kg/min · ${vo2Category(vo2[1], settings?.age, settings?.sex)}`}
        >
          {series('vo2max', 60).length > 1 && (
            <TrendChart points={series('vo2max', 60)} color="#0ea5e9" unit="" decimals={1} />
          )}
        </MetricCard>
      )}

      {(has('spo2') || has('resp_rate')) && (
        <section className="grid grid-cols-2 gap-3">
          {has('spo2') && (
            <SmallCard
              icon={<Droplet size={15} className="text-sky-500" />}
              title="Sauerstoff"
              value={`${latest('spo2')![1].toLocaleString('de-DE')} %`}
              hint="95–100 % normal"
            />
          )}
          {has('resp_rate') && (
            <SmallCard
              icon={<Wind size={15} className="text-teal-500" />}
              title="Atemfrequenz"
              value={`${latest('resp_rate')![1].toLocaleString('de-DE')} /min`}
              hint="im Schlaf 12–20 normal"
            />
          )}
        </section>
      )}

      {week.length > 0 && (has('steps') || has('active_kcal')) && (
        <MetricCard icon={<Footprints size={16} className="text-emerald-600" />} title="Aktivität · letzte 7 Tage">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Schritte', sum('steps'), '', Footprints],
                ['Strecke', Math.round(sum('distance_m') / 100) / 10, 'km', Activity],
                ['Etagen', sum('floors'), '', Activity],
                ['Aktive kcal', sum('active_kcal'), 'kcal', Flame],
              ] as const
            )
              .filter(([, v]) => v > 0)
              .map(([l, v, u]) => (
                <div key={l} className="rounded-xl bg-cream p-2.5">
                  <div className="tabular text-base font-bold">
                    {v.toLocaleString('de-DE')} <span className="text-xs font-normal text-cocoa-light">{u}</span>
                  </div>
                  <div className="text-[11px] text-cocoa-muted">
                    {l} · Ø {Math.round(v / week.length).toLocaleString('de-DE')}/Tag
                  </div>
                </div>
              ))}
          </div>
          {has('steps') && (
            <div className="flex h-16 items-end gap-1">
              {week.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-emerald-500/60"
                    style={{ height: `${Math.min(48, ((d.steps ?? 0) / 12000) * 48)}px` }}
                  />
                  <span className="text-[9px] text-cocoa-muted">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </MetricCard>
      )}

      {(has('weight_kg') || has('body_fat_pct') || bpS || has('glucose_mmol') || has('body_temp_c')) && (
        <MetricCard icon={<Scale size={16} className="text-brand" />} title="Körperwerte (Waage, Messgeräte)">
          <div className="grid grid-cols-2 gap-2">
            {has('weight_kg') && (
              <Cell label="Gewicht" value={`${latest('weight_kg')![1].toLocaleString('de-DE')} kg`} />
            )}
            {has('body_fat_pct') && (
              <Cell label="Körperfett" value={`${latest('body_fat_pct')![1].toLocaleString('de-DE')} %`} />
            )}
            {bpS && bpD && (
              <Cell
                label={`Blutdruck · ${bpCategory(bpS[1], bpD[1]).label}`}
                value={`${bpS[1]}/${bpD[1]}`}
                chip={<StatusChip status={bpCategory(bpS[1], bpD[1]).status} />}
              />
            )}
            {has('glucose_mmol') && (
              <Cell label="Blutzucker" value={`${latest('glucose_mmol')![1].toLocaleString('de-DE')} mmol/l`} />
            )}
            {has('body_temp_c') && (
              <Cell
                icon={<Thermometer size={13} />}
                label="Körpertemperatur"
                value={`${latest('body_temp_c')![1].toLocaleString('de-DE')} °C`}
              />
            )}
          </div>
          {series('weight_kg', 60).length > 1 && (
            <TrendChart points={series('weight_kg', 60)} color="#e11d48" unit="kg" decimals={1} />
          )}
        </MetricCard>
      )}
      <p className="px-1 text-[11px] text-cocoa-muted" style={enter(9)}>
        Keine medizinische Diagnose. Bei auffälligen Werten oder Beschwerden bitte ärztlich abklären.
      </p>
    </div>
  )
}

function SmallCard({ icon, title, value, hint }: { icon: ReactNode; title: string; value: string; hint: string }) {
  return (
    <div className="card space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-light">
        {icon} {title}
      </div>
      <div className="tabular text-xl font-black">{value}</div>
      <div className="text-[11px] text-cocoa-muted">{hint}</div>
    </div>
  )
}

function Cell({ label, value, chip, icon }: { label: string; value: string; chip?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl bg-cream p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="tabular text-base font-bold">{value}</span>
        {chip}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-cocoa-muted">
        {icon}
        {label}
      </div>
    </div>
  )
}
