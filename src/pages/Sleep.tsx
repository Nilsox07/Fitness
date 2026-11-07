import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { enter } from '../components/home/motion'
import { ProgressHeader, SectionLabel } from '../components/progress/ProgressHeader'
import { Group, GroupRow, Hero, IconBox, Stat } from '../components/health/ui'
import { Hypnogram, MetricCard, RangeBar, SeriesChart, StatusChip } from '../components/health/Charts'
import { FactorChips, ReadinessFactors } from '../components/health/ReadinessFactors'
import { WeekPicker } from '../components/ui/WeekPicker'
import { InfoTip } from '../components/ui/InfoTip'
import { useHealthActivities, useHealthDaily, useHealthSleep } from '../hooks/useHealth'
import { useAllSets } from '../hooks/useWorkouts'
import { useToday } from '../hooks/useToday'
import { STAGE, hoursText, missingReadinessInputs, sleepScore, sleepStats } from '../lib/health'
import { loadByDay, readinessOn } from '../lib/insights'
import { dayLabel, localDate, shiftDate } from '../lib/day'
import { useUserPrefs } from '../hooks/usePrefsSync'
import { useSleepPlan } from '../hooks/useRecovery'
import { SleepPlanCard } from '../components/health/SleepPlanCard'
import { NotebookPen } from 'lucide-react'

const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Fortschritt → Schlaf & Erholung: Tag wählen, Tagesform mit Einflüssen, die Nacht im Detail, Verlauf. */
export default function Sleep() {
  const heroBuddy = useHeroBuddy('sleep')
  const navigate = useNavigate()
  const NEED_MIN = useUserPrefs().prefs.sleepGoalMin
  const plan = useSleepPlan()
  const t = useToday()
  const { data: nights = [], isLoading } = useHealthSleep(30)
  const { data: daily = [] } = useHealthDaily(30)
  const { data: activities } = useHealthActivities(30)
  const { data: allSets } = useAllSets()
  const [params, setParams] = useSearchParams()
  const today = localDate()
  const minDate = shiftDate(today, -29)
  const pick = params.get('d')
  const selDate = pick && pick <= today && pick >= minDate ? pick : today
  const isToday = selDate === today
  const setDay = (d: string) => setParams(d === today ? {} : { d }, { replace: true })

  const byDate = useMemo(() => new Map(nights.map((n) => [n.date, n])), [nights])
  const night = byDate.get(selDate) ?? null
  const score = night ? sleepScore(night, NEED_MIN) : null
  const stats = sleepStats(nights.filter((n) => n.date > shiftDate(today, -14)))
  const dayOf = daily.find((d) => d.date === selDate)

  // Heute: volle Tagesform (mit Ernährung & Zyklus). Frühere Tage: aus Uhr- und Trainingsdaten nachgerechnet.
  const load = useMemo(
    () =>
      loadByDay(
        activities ?? [],
        (allSets ?? []).filter((s) => s.set_type !== 'warmup' && (s.reps ?? 0) > 0).map((s) => s.date),
      ),
    [activities, allSets],
  )
  const r = isToday ? t.readiness : readinessOn(selDate, daily, night, load, NEED_MIN)
  const missingIn = t.caps ? missingReadinessInputs(t.caps) : []

  const days = Array.from({ length: 14 }, (_, i) => shiftDate(today, i - 13))
  const MAX_MIN = 600
  const BAR_H = 96

  return (
    <div className="space-y-4">
      <ProgressHeader title="Schlaf" subtitle="Von deiner Uhr" />

      {/* Tag wählen – wie in Ernährung: Ring = Schlaf im Verhältnis zum Ziel */}
      <div style={enter(1)}>
        <WeekPicker
          date={selDate}
          today={today}
          minDate={minDate}
          onChange={setDay}
          progressFor={(d) => {
            const n = byDate.get(d)
            return n ? Math.min(1, n.asleep_min / NEED_MIN) : null
          }}
          describe={(d) => {
            const n = byDate.get(d)
            return n ? `${hoursText(n.asleep_min)} Schlaf` : null
          }}
        />
      </div>

      {/* Tagesform – Zahl, Balken und die stärksten Einflüsse */}
      <Hero
        buddy={heroBuddy}
        index={2}
        overline={`Tagesform · ${isToday ? 'heute' : dayLabel(selDate, today)}`}
        value={r ? r.score : '–'}
        unit={r ? '/ 100' : undefined}
        right={
          r && (
            <span className="rounded-full bg-bg/10 px-2 py-0.5 text-xs font-semibold capitalize text-bg/80 dark:bg-white/5 dark:text-cocoa-light">
              {r.level}
            </span>
          )
        }
      >
        <p className="mt-2 text-sm font-semibold leading-snug">
          {r
            ? isToday
              ? r.advice
              : 'So erholt warst du an diesem Morgen.'
            : t.caps?.known && !t.caps.has.sleep && !t.caps.has.hrv && !t.caps.has.restingHr
              ? 'Deine Uhr liefert dafür keine Werte.'
              : isToday
                ? 'Noch keine Nacht aufgezeichnet.'
                : 'Für diesen Tag fehlen Werte deiner Uhr.'}
        </p>
        {r && (
          <>
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-bg/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-brand" style={{ width: `${r.score}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-bg/55 dark:text-cocoa-muted" aria-hidden>
              <span>niedrig</span>
              <span>mittel</span>
              <span>hoch</span>
            </div>
            <FactorChips r={r} />
          </>
        )}
      </Hero>

      {isToday && plan && (
        <section style={enter(3)}>
          <SectionLabel>Heute Nacht</SectionLabel>
          <SleepPlanCard plan={plan} />
        </section>
      )}

      {r && r.factors.length > 0 && (
        <section style={enter(3)}>
          <SectionLabel>Was deine Tagesform beeinflusst</SectionLabel>
          <ReadinessFactors r={r} />
          {(!isToday || missingIn.length > 0) && (
            <InfoTip
              className="mt-2 px-1 text-[11px] text-cocoa-muted"
              info={[
                !isToday &&
                  'Für frühere Tage zählen nur Uhr- und Trainingswerte – Essen, Trinken und Zyklus nur heute.',
                missingIn.length > 0 &&
                  `Nicht von deiner Uhr gemessen: ${missingIn.join(', ')} – die Tagesform nutzt die übrigen Werte.`,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isToday ? 'Nicht alle Werte gemessen' : 'Nachgerechnet aus deiner Uhr'}
            </InfoTip>
          )}
        </section>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sand" />
      ) : !night || !score ? (
        <p className="card text-sm text-cocoa-light">
          {t.caps?.known && !t.caps.has.sleep
            ? 'Deine Uhr gibt keinen Schlaf an Health Connect weiter. Manche Uhren können das nur mit ihrer eigenen App – dort ggf. „Mit Health Connect teilen“ für Schlaf einschalten.'
            : 'Keine Schlafdaten für diese Nacht.'}
        </p>
      ) : (
        <>
          <section style={enter(4)}>
            <SectionLabel
              right={
                <span className="text-xs text-cocoa-muted">
                  {clock(night.start_at)} – {clock(night.end_at)}
                </span>
              }
            >
              Nacht ·{' '}
              {new Date(night.date + 'T00:00:00').toLocaleDateString('de-DE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </SectionLabel>
            <div className="card space-y-3">
              <div className="flex items-end gap-4">
                <div>
                  <div className="tabular text-4xl font-bold">{hoursText(night.asleep_min)}</div>
                  <div className="text-xs text-cocoa-light">
                    geschlafen{night.in_bed_min ? ` · ${hoursText(night.in_bed_min)} im Bett` : ''}
                  </div>
                </div>
                {score.detailed && (
                  <div className="ml-auto text-right">
                    <div className="tabular text-3xl font-bold text-brand">{score.score}</div>
                    <div className="text-xs font-semibold text-cocoa-light">{score.label}</div>
                  </div>
                )}
              </div>
              {!score.detailed && (
                <p className="rounded-xl bg-sand-light px-3 py-2 text-xs text-cocoa-light dark:bg-sand">
                  Deine Uhr liefert keine Schlafphasen – du siehst nur Dauer und Zeiten.
                </p>
              )}
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
                      <div key={code} className="min-w-0 rounded-xl bg-sand-light p-2 dark:bg-sand">
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </div>
                        <div className="tabular text-sm font-bold">{min != null ? hoursText(min) : '–'}</div>
                        {code !== 1 && pct != null && (
                          <>
                            <RangeBar
                              className="mt-1"
                              range={{ value: pct, min: 0, max: 70, lo: st.normal[0], hi: st.normal[1] }}
                            />
                            <div className="tabular mt-0.5 text-[10px] leading-tight text-cocoa-muted">
                              <span className="font-semibold text-cocoa-light">{pct} %</span>
                              <span className="block">
                                {st.normal[0]}–{st.normal[1]} %
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <ul className="divide-y divide-sand-dark/40">
                {score.parts.map((p) => (
                  <li key={p.label} className="py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.label}</span>
                      <span className="tabular font-semibold">{p.value}</span>
                      <StatusChip status={p.status} />
                    </div>
                    {p.range && <RangeBar className="mt-1.5" range={p.range} status={p.status} />}
                    <span className="mt-0.5 block text-[11px] text-cocoa-muted">{p.hint}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-1.5 text-[10px] text-cocoa-muted">
                <span className="inline-block h-1.5 w-3 rounded-full bg-sand-dark" aria-hidden />
                Zielbereich
              </p>
            </div>
          </section>

          {(night.hr_avg || night.hrv_avg || night.spo2_avg || night.resp_rate || night.skin_temp_delta != null) && (
            <MetricCard title="Körper in der Nacht">
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
                    <Stat key={l} value={v} label={l} />
                  ))}
              </div>
              {night.hr_series && night.hr_series.length > 1 && (
                <>
                  <h3 className="pt-1 text-xs font-semibold text-cocoa-muted">Puls in der Nacht</h3>
                  <SeriesChart
                    data={night.hr_series}
                    height={110}
                    unit="bpm"
                    label="Puls in der Nacht"
                    xLabel={(m) => clock(new Date(new Date(night.start_at).getTime() + m * 60000).toISOString())}
                  />
                </>
              )}
              {night.spo2_min != null && night.spo2_min < 90 && (
                <p className="rounded-xl bg-gold/20 px-3 py-2 text-xs">
                  Sauerstoff fiel nachts auf {night.spo2_min.toLocaleString('de-DE')} %. Wiederholt sich das, lass es
                  ärztlich abklären.
                </p>
              )}
            </MetricCard>
          )}
        </>
      )}

      {/* 14 Nächte – Balken antippen wählt die Nacht */}
      {nights.length > 0 && (
        <MetricCard
          title="Letzte 14 Nächte"
          right={stats && <span className="tabular text-sm font-bold">Ø {hoursText(stats.avgMin)}</span>}
        >
          <div className="relative pl-7">
            {/* y-Achse: 4 h / 8 h (Ziel) */}
            {[240, NEED_MIN].map((m) => (
              <span
                key={m}
                className="tabular absolute left-0 text-[9px] text-cocoa-muted"
                style={{ bottom: (m / MAX_MIN) * BAR_H + 14 - 5 }}
              >
                {Math.round(m / 60)} h
              </span>
            ))}
            <div className="relative flex items-end gap-1" style={{ height: BAR_H + 18 }}>
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-cocoa-muted/50"
                style={{ bottom: (NEED_MIN / MAX_MIN) * BAR_H + 14 }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-sand-dark/50"
                style={{ bottom: (240 / MAX_MIN) * BAR_H + 14 }}
              />
              {days.map((d) => {
                const n = byDate.get(d)
                const h = n ? Math.min(BAR_H, (n.asleep_min / MAX_MIN) * BAR_H) : 3
                const deep = n?.deep_min ? Math.min(h, (n.deep_min / MAX_MIN) * BAR_H) : 0
                const on = d === selDate
                return (
                  <button
                    key={d}
                    onClick={() => setDay(d)}
                    className="flex flex-1 flex-col items-center gap-1"
                    aria-label={
                      n ? `${dayLabel(d, today)}: ${hoursText(n.asleep_min)}` : `${dayLabel(d, today)}: keine Daten`
                    }
                    aria-pressed={on}
                  >
                    <div
                      className={`relative w-full overflow-hidden rounded-md ${on ? 'bg-brand/60 ring-2 ring-brand/40' : 'bg-brand/25'}`}
                      style={{ height: h }}
                    >
                      {deep > 0 && <div className="absolute inset-x-0 bottom-0 bg-brand" style={{ height: deep }} />}
                    </div>
                    <span className={`tabular text-[9px] ${on ? 'font-bold text-cocoa' : 'text-cocoa-muted'}`}>
                      {Number(d.slice(8))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-cocoa-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand/25" /> Schlaf
            </span>
            {nights.some((n) => n.deep_min) && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-brand" /> Tiefschlaf
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-dashed border-cocoa-muted" /> Ziel {hoursText(NEED_MIN)}
            </span>
          </div>
          {stats && (
            <p className="text-xs text-cocoa-light">
              {stats.bedtimeSpreadMin <= 30
                ? 'Du gehst sehr regelmäßig ins Bett 👍'
                : `Deine Einschlafzeit schwankt um ±${stats.bedtimeSpreadMin} min – regelmäßiger schlafen hilft der Erholung.`}
            </p>
          )}
        </MetricCard>
      )}

      <Group>
        <GroupRow
          leading={
            <IconBox>
              <NotebookPen size={18} />
            </IconBox>
          }
          title="Journal"
          sub="Was deinen Schlaf beeinflusst"
          onClick={() => navigate('/journal')}
        />
      </Group>
    </div>
  )
}
