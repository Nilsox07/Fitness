// Heute Nacht: Schlafbedarf (Grundbedarf + Belastung + Schlafschuld) und wann du ins Bett solltest.
// Grundbedarf und Aufstehzeit lassen sich direkt hier anpassen.

import { useState } from 'react'
import { Minus, Moon, Plus, SlidersHorizontal } from 'lucide-react'
import type { SleepPlan } from '../../hooks/useRecovery'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { hoursText } from '../../lib/health'
import { STRAIN_LABEL } from '../../lib/sleepNeed'
import { InfoTip } from '../ui/InfoTip'

const pad = (t: string) => (t.length === 4 ? `0${t}` : t)

export function SleepPlanCard({ plan }: { plan: SleepPlan }) {
  const { prefs, save } = useUserPrefs()
  const [edit, setEdit] = useState(false)
  const parts: [string, number][] = [
    ['Grundbedarf', plan.baseMin],
    [STRAIN_LABEL[plan.strain], plan.strainMin],
    ['Schlafschuld nachholen', plan.paybackMin],
  ]
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Moon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-cocoa-muted">Ins Bett um</p>
          <p className="tabular text-3xl font-bold leading-tight">{plan.bedAt}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-cocoa-muted">Schlafbedarf</p>
          <p className="tabular text-xl font-bold">{hoursText(plan.needMin)}</p>
        </div>
      </div>

      <ul className="space-y-1 text-sm">
        {parts
          .filter(([, m], i) => i === 0 || m > 0)
          .map(([label, m], i) => (
            <li key={label} className="flex justify-between gap-2">
              <span className="text-cocoa-light">{label}</span>
              <span className="tabular font-semibold">{i === 0 ? hoursText(m) : `+ ${m} min`}</span>
            </li>
          ))}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-sand-dark/40 pt-2">
        <InfoTip
          className="text-[11px] text-cocoa-muted"
          info={`Aufstehen um ${plan.wake}${plan.wakeAuto ? ' (wie meist in den letzten Nächten)' : ''}. Nach Training braucht der Körper mehr Erholung, und ein Teil der Schlafschuld (max. 1 h pro Nacht) lässt sich nachholen. Eingerechnet ist auch die Zeit, in der du im Bett wach liegst (${hoursText(plan.inBedMin)} im Bett).`}
        >
          Aufstehen {plan.wake}
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
