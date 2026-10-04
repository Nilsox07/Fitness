import { useState, type CSSProperties } from 'react'
import { ChevronDown, Target } from 'lucide-react'
import { useCountUp } from '../food/useCountUp'
import { TRAINING_BONUS } from '../../lib/dayTarget'
import { fmtInt } from '../../lib/nutritionHome'
import type { Nutrients } from '../../lib/nutrition'
import { Ring } from './Ring'

type Targets = { kcal: number; protein: number; carbs: number; fat: number }

/** Großer Kalorienring + Makro-Balken + aufklappbare Mikronährwerte. */
export function HeroCard({
  totals,
  targets,
  trained,
  onSetup,
  style,
}: {
  totals: Nutrients
  /** kcal = 0 → noch kein Ziel gesetzt */
  targets: Targets
  trained: boolean
  onSetup: () => void
  style?: CSSProperties
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const eatenAnim = useCountUp(totals.kcal, 700)
  const hasTarget = targets.kcal > 0
  const left = targets.kcal - totals.kcal
  const leftAnim = useCountUp(Math.abs(left), 700)
  const over = left < 0

  if (!hasTarget) {
    return (
      <section className="card flex flex-col items-center gap-3 py-6 text-center" style={style}>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-sand text-brand">
          <Target size={26} />
        </div>
        <div>
          <h2 className="font-semibold">Wie viel brauchst du am Tag?</h2>
          <p className="mt-1 text-sm text-cocoa-light">
            Leg dein Ziel fest — dann siehst du hier, wie viel heute noch übrig ist.
          </p>
        </div>
        {totals.kcal > 0 && (
          <p className="tabular text-xs text-cocoa-muted">Gegessen: {fmtInt(totals.kcal)} kcal</p>
        )}
        <button className="btn-primary gap-1.5" onClick={onSetup}>
          <Target size={16} />
          Ziel festlegen
        </button>
      </section>
    )
  }

  return (
    <section className="card space-y-4 pt-5" style={style}>
      <div className="flex items-center justify-between gap-2">
        <Side label="Gegessen" value={fmtInt(eatenAnim)} />
        <Ring
          size={168}
          stroke={12}
          progress={eatenAnim / targets.kcal}
          transition={false}
          trackClass="stroke-sand-dark/45"
        >
          <div className="flex flex-col items-center leading-none">
            <span className={`tabular text-[2.5rem] font-bold tracking-tight ${over ? 'text-gold' : 'text-cocoa'}`}>
              {fmtInt(leftAnim)}
            </span>
            <span className={`mt-1.5 text-xs font-medium ${over ? 'text-gold' : 'text-cocoa-light'}`}>
              kcal {over ? 'drüber' : 'übrig'}
            </span>
          </div>
        </Ring>
        <Side
          label="Ziel"
          value={fmtInt(targets.kcal)}
          hint={trained ? `inkl. Training +${TRAINING_BONUS}` : undefined}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Macro label="Eiweiß" value={totals.protein} target={targets.protein} bar="bg-brand" successWhenDone />
        <Macro label="Kohlenhydrate" value={totals.carbs} target={targets.carbs} bar="bg-gold" />
        <Macro label="Fett" value={totals.fat} target={targets.fat} bar="bg-cocoa-light" />
      </div>

      <div className="border-t border-sand-dark/40 pt-2">
        <button
          className="flex w-full items-center justify-between py-1 text-sm text-cocoa-light"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          Mehr Nährwerte
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {moreOpen && (
          <div className="anim-fade tabular mt-2 grid grid-cols-4 gap-2 rounded-xl bg-sand-light p-2 text-center text-[11px] text-cocoa-light">
            <Micro label="Ballaststoffe" value={totals.fiber} />
            <Micro label="Zucker" value={totals.sugar} />
            <Micro label="ges. Fett" value={totals.sat_fat} />
            <Micro label="Salz" value={totals.salt} />
          </div>
        )}
      </div>
    </section>
  )
}

function Side({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex w-16 flex-col items-center text-center">
      <span className="tabular text-lg font-semibold text-cocoa">{value}</span>
      <span className="text-[11px] text-cocoa-light">{label}</span>
      {hint && <span className="mt-0.5 text-[10px] leading-tight text-brand">{hint}</span>}
    </div>
  )
}

function Macro({
  label,
  value,
  target,
  bar,
  successWhenDone = false,
}: {
  label: string
  value: number
  target: number
  bar: string
  successWhenDone?: boolean
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const done = successWhenDone && target > 0 && value >= target
  return (
    <div className="min-w-0">
      <div className="truncate text-xs font-medium text-cocoa">{label}</div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-dark/45">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${done ? 'bg-success' : bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="tabular mt-1 text-[11px] text-cocoa-light">
        <span className="font-semibold text-cocoa">{Math.round(value)}</span>
        {target > 0 ? ` / ${Math.round(target)} g` : ' g'}
      </div>
    </div>
  )
}

function Micro({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold text-cocoa">{String(value).replace('.', ',')} g</div>
      {label}
    </div>
  )
}
