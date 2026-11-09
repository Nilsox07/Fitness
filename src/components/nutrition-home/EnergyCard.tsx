// Kalorienbedarf des Tages aus der Aktivität: Grundumsatz · Alltag (Schritte) · Training · Verdauung als Balken.
// Darunter der Schalter „Ziel nach Aktivität“ (sonst festes Ziel aus dem Profil + Trainings-Bonus).

import type { CSSProperties } from 'react'
import { Flame } from 'lucide-react'
import { useKcalTarget } from '../../hooks/useKcalTarget'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { GOAL_ADJUST, hasBody } from '../../lib/energy'
import { InfoTip } from '../ui/InfoTip'

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')

export function EnergyCard({ date, isToday, style }: { date: string; isToday: boolean; style?: CSSProperties }) {
  const { needOn, targetOn, watchTotalOn, mode } = useKcalTarget()
  const { prefs, save } = useUserPrefs()
  const { data: settings } = useNutritionSettings()
  const need = needOn(date)
  if (!need || !hasBody(settings)) return null
  const watch = watchTotalOn(date)
  const target = targetOn(date)
  const adjust = GOAL_ADJUST[settings.goal]
  const parts = [
    { label: 'Grundumsatz', v: need.bmr, cls: 'bg-brand' },
    {
      label: 'Alltag',
      note: need.steps != null ? `${fmt(need.steps)} Schritte` : 'aus deiner Einstellung',
      v: need.everyday,
      cls: 'bg-brand/60',
    },
    { label: 'Training', v: need.training, cls: 'bg-brand/35' },
    { label: 'Verdauung', v: need.digestion, cls: 'bg-sand-dark' },
  ].filter((p) => p.v > 0)
  const total = parts.reduce((s, p) => s + p.v, 0) || 1
  const on = prefs.kcalTargetMode === 'activity'

  return (
    <section className="card space-y-3" style={style}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Flame size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-cocoa-muted">Kalorienbedarf {isToday ? 'heute' : 'an dem Tag'}</p>
          <p className="tabular text-2xl font-bold leading-tight">≈ {fmt(need.total)} kcal</p>
        </div>
        {watch != null && (
          <div className="text-right">
            <p className="text-[11px] text-cocoa-muted">Laut Uhr</p>
            <p className="tabular text-sm font-semibold">{fmt(watch)}</p>
          </div>
        )}
      </div>

      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Aufteilung des Bedarfs">
        {parts.map((p) => (
          <div key={p.label} className={`h-full ${p.cls}`} style={{ width: `${(p.v / total) * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex min-w-0 items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded ${p.cls}`} />
            <span className="min-w-0 flex-1 truncate text-cocoa-light">
              {p.label}
              {'note' in p && p.note && <span className="text-xs text-cocoa-muted"> · {p.note}</span>}
            </span>
            <span className="tabular shrink-0 font-semibold">{fmt(p.v)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-sand-dark/40 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ziel nach Aktivität</p>
          <p className="text-xs text-cocoa-light">
            {mode === 'activity'
              ? `${isToday ? 'Heute' : 'Ziel'} ${fmt(target)} kcal · Training halb${adjust ? `, ${adjust > 0 ? '+' : '−'}${Math.abs(adjust)} fürs Ziel` : ''}`
              : `Aus: festes Ziel ${fmt(target)} kcal`}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Ziel nach Aktivität"
          onClick={() => void save({ kcalTargetMode: on ? 'fixed' : 'activity' })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-success' : 'bg-sand-dark'}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
          />
        </button>
      </div>
      <InfoTip
        className="text-[11px] text-cocoa-muted"
        info={`Grundumsatz nach Mifflin-St Jeor aus deinen Körperdaten. Alltag aus ${
          need.source === 'steps'
            ? `deinen Schritten (über 4.000 Schritte zählen extra${isToday ? ', heute mind. dein Ø der letzten Tage' : ''})`
            : 'deiner Alltags-Einstellung (mit Schritten von Handy oder Uhr wird es genauer)'
        }. Training aus deinen Sätzen bzw. der Uhr. Verdauung ≈ 10 %. Im Modus „nach Aktivität“ zählt Training nur zur Hälfte – so isst du Trainings-Kalorien nie ganz zurück.`}
      >
        So wird gerechnet
      </InfoTip>
    </section>
  )
}
