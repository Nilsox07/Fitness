import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BedDouble, ChevronDown, Gauge, HeartPulse, Info } from 'lucide-react'
import { enter } from '../components/home/motion'
import { ProgressHeader } from '../components/progress/ProgressHeader'
import { Hypnogram, MetricCard, SeriesChart, StatusChip } from '../components/health/Charts'
import { useHealthDaily, useHealthSleep } from '../hooks/useHealth'
import { useToday } from '../hooks/useToday'
import { FACTOR_INFO, STAGE, hoursText, sleepScore, sleepStats, type ReadinessFactor } from '../lib/health'
import { localDate, shiftDate } from '../lib/day'

const NEED_MIN = 480
const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Fortschritt → Schlaf & Erholung: Tagesform, jede Nacht im Detail, Verlauf. */
export default function Sleep() {
  const t = useToday()
  const { data: nights = [], isLoading } = useHealthSleep(30)
  const { data: daily = [] } = useHealthDaily(30)
  const [params, setParams] = useSearchParams()
  const today = localDate()
  const sorted = [...nights].sort((a, b) => (a.date < b.date ? 1 : -1))
  const selDate = params.get('d') ?? sorted[0]?.date ?? today
  const night = sorted.find((n) => n.date === selDate) ?? null
  const score = night ? sleepScore(night, NEED_MIN) : null
  const stats = sleepStats(nights.filter((n) => n.date > shiftDate(today, -14)))
  const dayOf = daily.find((d) => d.date === selDate)
  const r = t.readiness
  const color = !r ? '#94a3b8' : r.level === 'hoch' ? '#22c55e' : r.level === 'mittel' ? '#f2b705' : '#ef4444'

  const days = Array.from({ length: 14 }, (_, i) => shiftDate(today, i - 13))
  const byDate = new Map(nights.map((n) => [n.date, n]))

  return (
    <div className="space-y-4">
      <ProgressHeader title="Fortschritt" subtitle="Schlaf & Erholung" />

      {/* Tagesform – in Worten statt Punkten */}
      <section className="card space-y-3" style={enter(1)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-cocoa-light">
          <Gauge size={16} style={{ color }} /> Tagesform heute
        </div>
        {r ? (
          <>
            <div className="flex items-center gap-3">
              <span className="tabular text-5xl font-black" style={{ color }}>
                {r.score}
              </span>
              <p className="text-sm font-semibold leading-snug">{r.advice}</p>
            </div>
            <ul className="space-y-1.5">
              {r.factors.map((f) => (
                <FactorRow key={f.key} f={f} />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-cocoa-light">
            Sobald deine Uhr eine Nacht aufgezeichnet hat, siehst du hier, wie erholt du bist.
          </p>
        )}
      </section>

      {/* Nacht auswählen */}
      {sorted.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" style={enter(2)}>
          {sorted.slice(0, 14).map((n) => {
            const on = n.date === selDate
            const d = new Date(n.date + 'T00:00:00')
            return (
              <button
                key={n.date}
                onClick={() => setParams({ d: n.date }, { replace: true })}
                className={`flex shrink-0 flex-col items-center rounded-2xl px-3 py-1.5 ${on ? 'bg-indigo-600 text-white' : 'bg-sand'}`}
              >
                <span className="text-[10px] font-semibold opacity-80">
                  {n.date === today ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' })}
                </span>
                <span className="tabular text-sm font-bold">{hoursText(n.asleep_min).replace(' h', '')}</span>
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sand" />
      ) : !night || !score ? (
        <p className="card text-sm text-cocoa-light">Für diese Nacht gibt es keine Schlafdaten.</p>
      ) : (
        <>
          <section className="card space-y-3" style={enter(3)}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-cocoa-light">
                <BedDouble size={16} className="text-indigo-500" />
                {new Date(night.date + 'T00:00:00').toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              <span className="text-xs text-cocoa-muted">
                {clock(night.start_at)} – {clock(night.end_at)}
              </span>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <div className="tabular text-4xl font-black">{hoursText(night.asleep_min)}</div>
                <div className="text-xs text-cocoa-light">
                  geschlafen{night.in_bed_min ? ` · ${hoursText(night.in_bed_min)} im Bett` : ''}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="tabular text-3xl font-black text-indigo-500">{score.score}</div>
                <div className="text-xs font-semibold text-cocoa-light">{score.label}</div>
              </div>
            </div>
            {night.stages && night.stages.length > 0 && <Hypnogram stages={night.stages} start={night.start_at} />}
            {score.pct.deep != null && (
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    [3, night.deep_min],
                    [4, night.rem_min],
                    [2, night.light_min],
                    [1, night.awake_min],
                  ] as const
                ).map(([code, min]) => {
                  const st = STAGE[code]
                  const pct = min != null && night.asleep_min ? Math.round((min / night.asleep_min) * 100) : null
                  return (
                    <div key={code} className="rounded-xl bg-cream p-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                        {st.label}
                      </div>
                      <div className="tabular text-sm font-bold">{min != null ? hoursText(min) : '–'}</div>
                      {code !== 1 && pct != null && (
                        <div className="text-[10px] text-cocoa-muted">
                          {pct} % · normal {st.normal[0]}–{st.normal[1]} %
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <ul className="divide-y divide-sand-dark/40">
              {score.parts.map((p) => (
                <li key={p.label} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.label}</span>
                    <span className="block text-[11px] text-cocoa-muted">{p.hint}</span>
                  </span>
                  <span className="tabular font-semibold">{p.value}</span>
                  <StatusChip status={p.status} />
                </li>
              ))}
            </ul>
          </section>

          {(night.hr_avg || night.hrv_avg || night.spo2_avg || night.resp_rate || night.skin_temp_delta != null) && (
            <MetricCard icon={<HeartPulse size={16} className="text-red-500" />} title="Körper in der Nacht">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['Ø Puls', night.hr_avg ? `${Math.round(night.hr_avg)} bpm` : null],
                    ['Tiefster Puls', night.hr_min ? `${night.hr_min} bpm` : null],
                    [
                      'HRV',
                      night.hrv_avg
                        ? `${Math.round(night.hrv_avg)} ms`
                        : dayOf?.hrv_ms
                          ? `${Math.round(dayOf.hrv_ms)} ms`
                          : null,
                    ],
                    ['Sauerstoff', night.spo2_avg ? `${night.spo2_avg.toLocaleString('de-DE')} %` : null],
                    ['Atmung', night.resp_rate ? `${night.resp_rate.toLocaleString('de-DE')} /min` : null],
                    [
                      'Hauttemperatur',
                      night.skin_temp_delta != null
                        ? `${night.skin_temp_delta > 0 ? '+' : ''}${night.skin_temp_delta.toLocaleString('de-DE')} °C`
                        : null,
                    ],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-cream p-2.5">
                      <div className="tabular text-sm font-bold">{v}</div>
                      <div className="text-[11px] text-cocoa-muted">{l}</div>
                    </div>
                  ))}
              </div>
              {night.hr_series && night.hr_series.length > 1 && (
                <SeriesChart
                  data={night.hr_series}
                  color="#ef4444"
                  height={100}
                  xLabel={(m) => clock(new Date(new Date(night.start_at).getTime() + m * 60000).toISOString())}
                />
              )}
              {night.spo2_min != null && night.spo2_min < 90 && (
                <p className="rounded-xl bg-gold/15 px-3 py-2 text-xs">
                  Sauerstoff fiel nachts auf {night.spo2_min.toLocaleString('de-DE')} %. Wiederholt sich das, lass es
                  ärztlich abklären.
                </p>
              )}
            </MetricCard>
          )}
        </>
      )}

      {/* 14 Nächte */}
      <MetricCard
        icon={<BedDouble size={16} className="text-indigo-500" />}
        title="Letzte 14 Nächte"
        right={stats && <span className="tabular text-sm font-bold">Ø {hoursText(stats.avgMin)}</span>}
      >
        <div className="relative flex h-28 items-end gap-1">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-indigo-500/40"
            style={{ bottom: `${(NEED_MIN / 600) * 96 + 14}px` }}
          />
          {days.map((d) => {
            const n = byDate.get(d)
            const h = n ? Math.min(96, (n.asleep_min / 600) * 96) : 3
            const deep = n?.deep_min ? Math.min(h, (n.deep_min / 600) * 96) : 0
            return (
              <button
                key={d}
                onClick={() => n && setParams({ d }, { replace: true })}
                className="flex flex-1 flex-col items-center gap-1"
                aria-label={n ? `${d}: ${hoursText(n.asleep_min)}` : `${d}: keine Daten`}
              >
                <div
                  className={`relative w-full overflow-hidden rounded-md ${d === selDate ? 'bg-indigo-500/70' : 'bg-indigo-500/35'}`}
                  style={{ height: h }}
                >
                  {deep > 0 && <div className="absolute inset-x-0 bottom-0 bg-indigo-700" style={{ height: deep }} />}
                </div>
                <span className="text-[9px] text-cocoa-muted">{Number(d.slice(8))}</span>
              </button>
            )
          })}
        </div>
        {stats && (
          <p className="text-xs text-cocoa-light">
            Gestrichelt: 8 h Ziel · dunkel: Tiefschlaf ·{' '}
            {stats.bedtimeSpreadMin <= 30
              ? 'Du gehst sehr regelmäßig ins Bett 👍'
              : `Deine Einschlafzeit schwankt um ±${stats.bedtimeSpreadMin} min – regelmäßiger schlafen hilft der Erholung.`}
          </p>
        )}
      </MetricCard>
    </div>
  )
}

/** Ein Faktor der Tagesform: Wert, Vergleich, Einschätzung – antippen für die Erklärung. */
function FactorRow({ f }: { f: ReadinessFactor }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-xl bg-cream">
      <button className="w-full space-y-0.5 px-3 py-2.5 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.label}</span>
          <StatusChip status={f.status} />
          <ChevronDown size={14} className={`shrink-0 text-cocoa-muted transition ${open ? 'rotate-180' : ''}`} />
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="tabular text-base font-bold">{f.value}</span>
          {f.normal && <span className="text-xs text-cocoa-muted">· {f.normal}</span>}
        </span>
        <span className="block text-xs text-cocoa-light">{f.text}</span>
      </button>
      {open && (
        <p className="flex gap-1.5 px-3 pb-3 text-xs leading-relaxed text-cocoa-light">
          <Info size={13} className="mt-0.5 shrink-0" />
          {FACTOR_INFO[f.key]}
        </p>
      )}
    </li>
  )
}
