import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Activity, Flame, Gauge, HeartPulse, Mountain, Timer, Zap } from 'lucide-react'
import { enter } from '../components/home/motion'
import { MetricCard, SeriesChart, ZoneBars } from '../components/health/Charts'
import { useHealthActivities } from '../hooks/useHealth'
import { useNutritionSettings } from '../hooks/useNutrition'
import {
  ACTIVITY_EMOJI,
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

  return (
    <div className="space-y-4">
      <header style={enter(0)}>
        <h1 className="text-[26px] font-bold leading-tight">
          {ACTIVITY_EMOJI[a.type]} {a.title || ACTIVITY_LABEL[a.type]}
        </h1>
        <p className="text-sm text-cocoa-light">
          {new Date(a.started_at).toLocaleString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {a.source && ` · ${a.source}`}
        </p>
      </header>

      {derived.route && (
        <section className="card overflow-hidden p-0" style={enter(1)}>
          <svg viewBox="0 0 340 210" className="w-full bg-sand/50">
            <path
              d={derived.route}
              fill="none"
              stroke="#f97316"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2" style={enter(2)}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-cream p-3">
            <div className="tabular truncate text-[15px] font-bold">{s.value}</div>
            <div className="flex items-center gap-1 text-[11px] text-cocoa-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <MetricCard
        icon={<Gauge size={16} className="text-orange-500" />}
        title="Belastung"
        value={derived.load}
        sub={loadLabel(derived.load)}
      >
        <p className="text-sm text-cocoa-light">
          Empfohlene Erholung: ca. <b>{recoveryHours(derived.load)} Stunden</b> bis zur nächsten harten Einheit.
          {a.hr_series && mainZone > 0 && ` Meistens in Zone ${mainZone} (${ZONES[mainZone - 1].info}).`}
        </p>
      </MetricCard>

      {a.hr_series && a.hr_series.length > 1 && (
        <MetricCard
          icon={<HeartPulse size={16} className="text-red-500" />}
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
        <MetricCard
          icon={<Gauge size={16} className="text-sky-500" />}
          title={isRide ? 'Geschwindigkeit' : 'Pace'}
          value={paceText(a) ?? undefined}
        >
          <SeriesChart
            data={paceData}
            color="#0ea5e9"
            height={120}
            invert={!isRide}
            xLabel={fmtTime}
            yLabel={(y) => (isRide ? `${Math.round(y)}` : mmss(y))}
          />
        </MetricCard>
      )}

      {derived.elevation.length > 1 && (
        <MetricCard
          icon={<Mountain size={16} className="text-emerald-600" />}
          title="Höhenprofil"
          value={a.elevation_m ? `${Math.round(a.elevation_m)} m` : undefined}
          sub="bergauf"
        >
          <SeriesChart
            data={derived.elevation}
            color="#10b981"
            height={100}
            xLabel={(x) => `${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`}
            yLabel={(y) => `${Math.round(y)} m`}
          />
        </MetricCard>
      )}

      {a.power_series && a.power_series.length > 1 && (
        <MetricCard
          icon={<Zap size={16} className="text-gold" />}
          title="Leistung"
          value={`Ø ${Math.round(a.avg_power ?? 0)} W`}
        >
          <SeriesChart
            data={a.power_series}
            color="#f2b705"
            height={110}
            xLabel={fmtTime}
            yLabel={(y) => `${Math.round(y)}`}
          />
        </MetricCard>
      )}

      {derived.splits.length > 0 && (
        <MetricCard icon={<Timer size={16} className="text-brand" />} title="Kilometer">
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
                        className={`block h-full rounded-full ${best ? 'bg-brand' : 'bg-sky-500'}`}
                        style={{ width: `${Math.min(100, ((fastest === Infinity ? pace : fastest) / pace) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="tabular text-right" style={{ color: s.hr ? zoneColor(s.hr) : undefined }}>
                    {s.hr ?? '–'}
                  </span>
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
        <MetricCard icon={<Timer size={16} className="text-brand" />} title="Runden">
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
