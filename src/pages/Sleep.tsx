import { BedDouble, Footprints, Gauge, HeartPulse } from 'lucide-react'
import { enter } from '../components/home/motion'
import { useHealthDaily, useHealthSleep } from '../hooks/useHealth'
import { useToday } from '../hooks/useToday'
import { hoursText, sleepStats } from '../lib/health'
import { localDate, shiftDate } from '../lib/day'

const NEED_MIN = 480

/** Fortschritt → Schlaf & Erholung: Tagesform erklärt, Schlaf der letzten 14 Nächte, Puls & HRV. */
export default function Sleep() {
  const t = useToday()
  const { data: nights = [] } = useHealthSleep(30)
  const { data: daily = [] } = useHealthDaily(30)
  const today = localDate()
  const days = Array.from({ length: 14 }, (_, i) => shiftDate(today, i - 13))
  const byDate = new Map(nights.map((n) => [n.date, n]))
  const stats = sleepStats(nights.filter((n) => n.date > shiftDate(today, -14)))
  const r = t.readiness
  const color = !r ? '#94a3b8' : r.level === 'hoch' ? '#22c55e' : r.level === 'mittel' ? '#f2b705' : '#ef4444'
  const last7 = daily.filter((d) => d.date > shiftDate(today, -7))
  const avg = (k: 'resting_hr' | 'hrv_ms' | 'steps') => {
    const v = last7.map((d) => d[k]).filter((x): x is number => x != null)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight" style={enter(0)}>
        Schlaf & Erholung
      </h1>

      <section className="card space-y-3" style={enter(1)}>
        <div className="flex items-center gap-2 text-sm font-semibold text-cocoa-light">
          <Gauge size={16} style={{ color }} /> Tagesform heute
        </div>
        {r ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-5xl font-black" style={{ color }}>
                {r.score}
              </span>
              <span className="text-sm font-semibold capitalize">{r.level}</span>
            </div>
            <p className="text-sm">{r.advice}</p>
            <ul className="space-y-1.5">
              {r.factors.map((f) => (
                <li key={f.label} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 font-semibold">{f.label}</span>
                  <span className="min-w-0 flex-1 text-cocoa-light">{f.text}</span>
                  <span className={`tabular text-xs font-bold ${f.effect >= 0 ? 'text-success' : 'text-red-500'}`}>
                    {f.effect > 0 ? '+' : ''}
                    {f.effect}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-cocoa-muted">
              Aus Schlaf, HRV und Ruhepuls deiner Uhr, deiner Belastung von gestern – und deiner Ernährung.
            </p>
          </>
        ) : (
          <p className="text-sm text-cocoa-light">
            Sobald deine Uhr eine Nacht aufgezeichnet hat, siehst du hier deine Tagesform.
          </p>
        )}
      </section>

      <section className="card space-y-3" style={enter(2)}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-cocoa-light">
            <BedDouble size={16} className="text-indigo-500" /> Schlaf · 14 Nächte
          </span>
          {stats && <span className="tabular text-sm font-bold">Ø {hoursText(stats.avgMin)}</span>}
        </div>
        <div className="relative flex h-32 items-end gap-1">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-indigo-500/40"
            style={{ bottom: `${(NEED_MIN / 600) * 112 + 14}px` }}
          />
          {days.map((d) => {
            const n = byDate.get(d)
            const h = n ? Math.min(112, (n.asleep_min / 600) * 112) : 3
            const deep = n?.deep_min ? Math.min(h, (n.deep_min / 600) * 112) : 0
            return (
              <div
                key={d}
                className="flex flex-1 flex-col items-center gap-1"
                title={n ? hoursText(n.asleep_min) : 'keine Daten'}
              >
                <div className="relative w-full overflow-hidden rounded-md bg-indigo-500/35" style={{ height: h }}>
                  {deep > 0 && <div className="absolute inset-x-0 bottom-0 bg-indigo-600" style={{ height: deep }} />}
                </div>
                <span className="text-[9px] text-cocoa-muted">{Number(d.slice(8))}</span>
              </div>
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
      </section>

      <section className="grid grid-cols-3 gap-3" style={enter(3)}>
        {(
          [
            ['Ruhepuls', avg('resting_hr'), 'bpm', HeartPulse, 'text-red-500'],
            ['HRV', avg('hrv_ms'), 'ms', Gauge, 'text-emerald-500'],
            ['Schritte', avg('steps'), '/Tag', Footprints, 'text-sky-500'],
          ] as const
        ).map(([label, v, unit, Icon, tone]) => (
          <div key={label} className="card space-y-1">
            <Icon size={16} className={tone} />
            <div className="tabular text-lg font-black leading-tight">
              {v != null ? v.toLocaleString('de-DE') : '–'}
            </div>
            <div className="text-[11px] text-cocoa-muted">
              Ø {label} {unit}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
