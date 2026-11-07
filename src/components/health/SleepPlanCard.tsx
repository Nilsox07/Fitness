// Heute Nacht: Schlafbedarf (Grundbedarf + Belastung + Schlafschuld) und wann du ins Bett solltest.
// Grundbedarf und Aufstehzeit lassen sich direkt hier anpassen.

import { useState } from 'react'
import { Minus, Moon, Plus, SlidersHorizontal, Sunrise } from 'lucide-react'
import type { SleepPlan } from '../../hooks/useRecovery'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { hoursText } from '../../lib/health'
import { STRAIN_LABEL } from '../../lib/sleepNeed'
import { InfoTip } from '../ui/InfoTip'

const pad = (t: string) => (t.length === 4 ? `0${t}` : t)
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function SleepPlanCard({ plan }: { plan: SleepPlan }) {
  const { prefs, save } = useUserPrefs()
  const [edit, setEdit] = useState(false)
  const awake = Math.max(0, plan.inBedMin - plan.needMin)
  const segs = [
    { label: 'Wach im Bett', min: awake, cls: 'bg-sand-dark', text: `${awake} min` },
    { label: 'Grundbedarf', min: plan.baseMin, cls: 'bg-brand', text: hoursText(plan.baseMin) },
    { label: STRAIN_LABEL[plan.strain], min: plan.strainMin, cls: 'bg-brand/60', text: `+ ${plan.strainMin} min` },
    { label: 'Schuld nachholen', min: plan.paybackMin, cls: 'bg-brand/30', text: `+ ${plan.paybackMin} min` },
  ].filter((x) => x.min > 0)
  const total = segs.reduce((a, x) => a + x.min, 0) || 1
  // volle Stunden zwischen Bett- und Aufstehzeit als Achse
  const bed = toMin(plan.bedAt)
  const ticks: { pos: number; label: string }[] = []
  for (let m = Math.ceil(bed / 60) * 60; m < bed + total; m += 60) {
    const h = (m / 60) % 24
    if (h % 2 === 0) ticks.push({ pos: ((m - bed) / total) * 100, label: `${h}` })
  }
  return (
    <div className="card space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-muted">
            <Moon size={13} /> Ins Bett
          </p>
          <p className="tabular text-4xl font-bold leading-none tracking-tight">{plan.bedAt}</p>
        </div>
        <div className="pb-0.5 text-center">
          <p className="tabular text-lg font-bold leading-none text-brand">{hoursText(plan.needMin)}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-cocoa-muted">Schlaf</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-xs font-semibold text-cocoa-muted">
            Aufstehen <Sunrise size={13} />
          </p>
          <p className="tabular text-4xl font-bold leading-none tracking-tight text-cocoa-light">{plan.wake}</p>
        </div>
      </div>

      {/* Die Nacht als Zeitleiste: Bettzeit → Aufstehen */}
      <div>
        <div
          className="flex h-9 gap-0.5 overflow-hidden rounded-xl"
          role="img"
          aria-label={`Ins Bett ${plan.bedAt}, aufstehen ${plan.wake}`}
        >
          {segs.map((x) => (
            <div
              key={x.label}
              className={`${x.cls} h-full first:rounded-l-xl last:rounded-r-xl`}
              style={{ width: `${(x.min / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-3.5">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="tabular absolute -translate-x-1/2 text-[10px] text-cocoa-muted"
              style={{ left: `${t.pos}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {segs.map((x) => (
          <li key={x.label} className="flex min-w-0 items-center gap-2 text-xs">
            <span className={`h-3 w-3 shrink-0 rounded ${x.cls}`} />
            <span className="min-w-0 flex-1 truncate text-cocoa-light">{x.label}</span>
            <span className="tabular shrink-0 font-semibold">{x.text}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-sand-dark/40 pt-2">
        <InfoTip
          className="text-[11px] text-cocoa-muted"
          info={`Aufstehen um ${plan.wake}${plan.wakeAuto ? ' (wie meist in den letzten Nächten)' : ''}. Nach Training braucht der Körper mehr Erholung, und ein Teil der Schlafschuld (max. 1 h pro Nacht) lässt sich nachholen. Eingerechnet ist auch die Zeit, in der du im Bett wach liegst (${hoursText(plan.inBedMin)} im Bett).`}
        >
          {plan.wakeAuto ? 'Aufstehzeit aus deinen Nächten' : 'Eigene Aufstehzeit'}
          {plan.debtMin != null && plan.debtMin > 0 && ` · Schuld ${hoursText(plan.debtMin)}`}
        </InfoTip>
        <button
          onClick={() => setEdit((e) => !e)}
          aria-expanded={edit}
          className="flex items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-cocoa-light"
        >
          <SlidersHorizontal size={13} /> Anpassen
        </button>
      </div>

      {edit && (
        <div className="space-y-3 rounded-2xl bg-sand-light p-3 dark:bg-sand">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Grundbedarf</span>
            <div className="flex items-center gap-2">
              <button
                aria-label="Weniger"
                className="grid h-9 w-9 place-items-center rounded-full bg-cream"
                onClick={() => void save({ sleepGoalMin: prefs.sleepGoalMin - 15 })}
              >
                <Minus size={16} />
              </button>
              <span className="tabular w-16 text-center font-bold">{hoursText(prefs.sleepGoalMin)}</span>
              <button
                aria-label="Mehr"
                className="grid h-9 w-9 place-items-center rounded-full bg-cream"
                onClick={() => void save({ sleepGoalMin: prefs.sleepGoalMin + 15 })}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Aufstehen</span>
            <div className="flex items-center gap-2">
              {prefs.wakeTime && (
                <button className="text-xs font-semibold text-brand" onClick={() => void save({ wakeTime: null })}>
                  Automatisch
                </button>
              )}
              <input
                type="time"
                step={300}
                aria-label="Aufstehzeit"
                value={pad(prefs.wakeTime ?? plan.wake)}
                onChange={(e) => e.target.value && void save({ wakeTime: e.target.value })}
                className="tabular w-[5.5rem] rounded-xl bg-cream px-2 py-1.5 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ruby [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          </div>
          <p className="text-[11px] text-cocoa-muted">Die meisten Erwachsenen brauchen 7–9 Stunden.</p>
        </div>
      )}
    </div>
  )
}
