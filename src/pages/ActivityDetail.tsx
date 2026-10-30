import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, Flame, Gauge, HeartPulse, Mountain, Timer, Zap } from 'lucide-react'
import { enter } from '../components/home/motion'
import { MetricCard, SeriesChart, ZoneBars } from '../components/health/Charts'
import { Hero, HeroPill, Stat, ruby } from '../components/health/ui'
import { SectionLabel } from '../components/progress/ProgressHeader'
import { useHealthActivities } from '../hooks/useHealth'
import { useNutritionSettings } from '../hooks/useNutrition'
import {
  ACTIVITY_LABEL,
  ZONES,
  durationText,
  elevationProfile,
  estimateMaxHr,
  hrZone,
  kmSplits,
  kmText,
  loadLabel,
  mmss,
  paceText,
  recoveryHours,
  routePath,
  trimp,
  zoneTimes,
} from '../lib/health'

const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${mmss(s % 3600).padStart(5, '0')}` : mmss(s))

/** Eine Aktivität im Detail: Strecke, Puls & Zonen, Tempo, Höhe, Kilometer, Belastung. */
export default function ActivityDetail() {
  const { id } = useParams()
  const { data: list = [], isLoading } = useHealthActivities(365)
  const { data: settings } = useNutritionSettings()
  const a = list.find((x) => x.id === id)
  const maxHr = estimateMaxHr(settings?.age, list)

  const derived = useMemo(() => {
    if (!a) return null
    const splits = kmSplits(a.route, a.hr_series)
    return {
      zones: zoneTimes(a.hr_series, maxHr),
      load: trimp(a, maxHr),
      splits,
      elevation: elevationProfile(a.route),
      route: routePath(a.route, 340, 210, 12),
    }
  }, [a, maxHr])

  if (isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-sand" />
  if (!a || !derived) return <p className="card text-sm text-cocoa-light">Aktivität nicht gefunden.</p>

  const isRide = a.type === 'ride' || a.type === 'row'
  const isSwim = a.type === 'swim'
  const stats: { label: string; value: string | null; icon: ReactNode }[] = [
    { label: 'Distanz', value: a.distance_m ? kmText(a.distance_m) : null, icon: <Activity size={14} /> },
    { label: 'Dauer', value: durationText(a.duration_s), icon: <Timer size={14} /> },
    { label: isRide ? 'Ø Tempo' : 'Ø Pace', value: paceText(a), icon: <Gauge size={14} /> },
    { label: 'Ø Puls', value: a.avg_hr ? `${a.avg_hr} bpm` : null, icon: <HeartPulse size={14} /> },
    { label: 'Max. Puls', value: a.max_hr ? `${a.max_hr} bpm` : null, icon: <HeartPulse size={14} /> },
    { label: 'Kalorien', value: a.kcal ? `${Math.round(a.kcal)} kcal` : null, icon: <Flame size={14} /> },
    {
      label: 'Höhenmeter',
      value: a.elevation_m ? `${Math.round(a.elevation_m)} m` : null,
      icon: <Mountain size={14} />,
    },
    {
      label: 'Höchsttempo',
      value: a.max_speed ? `${(a.max_speed * 3.6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km/h` : null,
      icon: <Gauge size={14} />,
    },
    { label: 'Schritte', value: a.steps ? a.steps.toLocaleString('de-DE') : null, icon: <Activity size={14} /> },
    {
      label: isRide ? 'Ø Trittfrequenz' : 'Ø Schrittfrequenz',
      value: a.avg_cadence ? `${a.avg_cadence} ${isRide ? 'U/min' : 'spm'}` : null,
      icon: <Activity size={14} />,
    },
    { label: 'Ø Leistung', value: a.avg_power ? `${Math.round(a.avg_power)} W` : null, icon: <Zap size={14} /> },
    { label: 'Max. Leistung', value: a.max_power ? `${Math.round(a.max_power)} W` : null, icon: <Zap size={14} /> },
  ].filter((s) => s.value)

  // Tempo: Laufen als min/km (kleiner = schneller → oben), Rad als km/h
  const speed = (a.speed_series ?? []).filter(([, v]) => v > 0.3)
  const paceData: [number, number][] = isRide
    ? speed.map(([t, v]) => [t, v * 3.6])
    : speed.map(([t, v]) => [t, Math.min(1200, 1000 / v)])
  const zoneColor = (bpm: number) => ZONES[(hrZone(bpm, maxHr) ?? 1) - 1].color
  const mainZone = derived.zones.indexOf(Math.max(...derived.zones)) + 1
  const fastest = derived.splits.filter((s) => s.meters >= 1000).reduce((m, s) => Math.min(m, s.seconds), Infinity)

  const top = new Set(['Distanz', 'Dauer', 'Ø Pace', 'Ø Tempo', 'Ø Puls'])
  const rest = stats.filter((x) => !top.has(x.label))
  const dateText = new Date(a.started_at).toLocaleString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-5">
      <header style={enter(0)}>
        <h1 className="text-[28px] font-bold leading-tight">{a.title || ACTIVITY_LABEL[a.type]}</h1>
        <p className="text-sm text-cocoa-light">
          {dateText}
          {a.source && ` · ${a.source}`}
        </p>
      </header>

      <Hero
        overline={ACTIVITY_LABEL[a.type]}
        value={a.distance_m ? kmText(a.distance_m).replace(' km', '') : durationText(a.duration_s)}
        unit={a.distance_m ? 'km' : undefined}
      >
        {derived.route && (
          <svg viewBox="0 0 340 210" className="mt-3 w-full">
            <path
              d={derived.route}
              fill="none"
              style={{ stroke: ruby() }}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {a.distance_m ? <HeroPill value={durationText(a.duration_s)} label="Dauer" /> : null}
          {paceText(a) && (
            <HeroPill
              value={paceText(a)!.replace(/ (\/km|km\/h|\/100 m)$/, '')}
              label={isRide ? 'Ø km/h' : isSwim ? 'Ø /100 m' : 'Ø Pace /km'}
            />
          )}
          {a.avg_hr && <HeroPill value={a.avg_hr} label="Ø Puls" />}
          {!a.distance_m && a.kcal ? <HeroPill value={Math.round(a.kcal)} label="kcal" /> : null}
        </div>
      </Hero>

      {rest.length > 0 && (
        <section style={enter(2)}>
          <SectionLabel>Details</SectionLabel>
          <div className="card grid grid-cols-2 gap-2">
            {rest.map((x) => (
              <Stat key={x.label} value={x.value} label={x.label} />
            ))}
          </div>
        </section>
      )}

      <MetricCard title="Belastung" value={derived.load} sub={loadLabel(derived.load)}>
        <p className="text-sm text-cocoa-light">
          Empfohlene Erholung: ca. <b>{recoveryHours(derived.load)} Stunden</b> bis zur nächsten harten Einheit.
          {a.hr_series && mainZone > 0 && ` Meistens in Zone ${mainZone} (${ZONES[mainZone - 1].info}).`}
        </p>
      </MetricCard>

      {a.hr_series && a.hr_series.length > 1 && (
        <MetricCard
          title="Puls"
          value={a.avg_hr ? `Ø ${a.avg_hr}` : undefined}
          sub={a.max_hr ? `max. ${a.max_hr} bpm` : undefined}
        >
          <SeriesChart data={a.hr_series} colorFor={zoneColor} height={130} xLabel={fmtTime} />
          <h3 className="pt-1 text-xs font-semibold text-cocoa-muted">Zeit in Pulszonen (Max-Puls {maxHr})</h3>
          <ZoneBars times={derived.zones} />
        </MetricCard>
      )}

      {paceData.length > 1 && !isSwim && (
        <MetricCard title={isRide ? 'Geschwindigkeit' : 'Pace'} value={paceText(a) ?? undefined}>
          <SeriesChart
            data={paceData}
            color={ruby()}
            height={120}
            invert={!isRide}
            xLabel={fmtTime}
            yLabel={(y) => (isRide ? `${Math.round(y)}` : mmss(y))}
          />
        </MetricCard>
      )}

      {derived.elevation.length > 1 && (
        <MetricCard
          title="Höhenprofil"
          value={a.elevation_m ? `${Math.round(a.elevation_m)} m` : undefined}
          sub="bergauf"
        >
          <SeriesChart
            data={derived.elevation}
            color={ruby(0.8)}
            height={100}
            xLabel={(x) => `${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`}
            yLabel={(y) => `${Math.round(y)} m`}
          />
        </MetricCard>
      )}

      {a.power_series && a.power_series.length > 1 && (
        <MetricCard title="Leistung" value={`Ø ${Math.round(a.avg_power ?? 0)} W`}>
          <SeriesChart
            data={a.power_series}
            color={ruby(0.8)}
            height={110}
            xLabel={fmtTime}
            yLabel={(y) => `${Math.round(y)}`}
          />
        </MetricCard>
      )}

      {derived.splits.length > 0 && (
        <MetricCard title="Kilometer">
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3rem] gap-x-2 gap-y-1 text-sm">
            <span className="text-[11px] text-cocoa-muted">km</span>
            <span className="text-[11px] text-cocoa-muted">{isRide ? 'Zeit' : 'Pace'}</span>
            <span className="text-right text-[11px] text-cocoa-muted">Puls</span>
            <span className="text-right text-[11px] text-cocoa-muted">Höhe</span>
            {derived.splits.map((s) => {
              const pace = s.seconds / (s.meters / 1000)
              const best = s.seconds === fastest
              return (
                <div key={s.km} className="contents">
                  <span className="tabular font-semibold">{s.meters < 1000 ? `+${s.meters} m` : s.km}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular w-12 shrink-0">{isRide ? fmtTime(s.seconds) : mmss(pace)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-dark/40">
                      <span
                        className={`block h-full rounded-full ${best ? 'bg-brand' : 'bg-brand/40'}`}
                        style={{ width: `${Math.min(100, ((fastest === Infinity ? pace : fastest) / pace) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="tabular text-right text-cocoa-light">{s.hr ?? '–'}</span>
                  <span className="tabular text-right text-cocoa-light">
                    {s.elevation != null ? `${s.elevation > 0 ? '+' : ''}${s.elevation}` : '–'}
                  </span>
                </div>
              )
            })}
          </div>
        </MetricCard>
      )}

      {derived.splits.length === 0 && a.laps && a.laps.length > 1 && (
        <MetricCard title="Runden">
          {a.laps.map((l, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>Runde {i + 1}</span>
              <span className="tabular text-cocoa-light">
                {fmtTime(l.end_s - l.start_s)}
                {l.length_m ? ` · ${kmText(l.length_m)}` : ''}
              </span>
            </div>
          ))}
        </MetricCard>
      )}
    </div>
  )
}
