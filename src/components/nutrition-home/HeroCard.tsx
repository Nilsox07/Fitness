import { useState, type CSSProperties } from 'react'
import { ChevronDown, Target } from 'lucide-react'
import { useCountUp } from '../food/useCountUp'
import { TRAINING_BONUS } from '../../lib/dayTarget'
import { fmtInt } from '../../lib/nutritionHome'
import type { Nutrients } from '../../lib/nutrition'
import { Ring } from './Ring'
import { MyBuddy } from '../buddy/MyBuddy'

type Targets = { kcal: number; protein: number; carbs: number; fat: number }

/** Großer Kalorienring + Makro-Balken + aufklappbare Mikronährwerte. */
export function HeroCard({
  totals,
  targets,
  trained,
  bonus = TRAINING_BONUS,
  onSetup,
  style,
}: {
  totals: Nutrients
  /** kcal = 0 → noch kein Ziel gesetzt */
  targets: Targets
  trained: boolean
  /** Trainingsbonus aus den Einstellungen (Standard 250) */
  bonus?: number
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
        <MyBuddy size={76} mood="hungry" className="-my-1" />
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
    <section
      className="relative space-y-4 overflow-hidden rounded-3xl bg-cocoa p-4 pt-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      {/* dezenter Brand-Schimmer wie beim Training */}
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-2">
        <Side label="Gegessen" value={fmtInt(eatenAnim)} />
        <Ring
          size={168}
          stroke={12}
          progress={eatenAnim / targets.kcal}
          transition={false}
          trackClass="stroke-bg/15 dark:stroke-sand-dark/45"
        >
          <div className="flex flex-col items-center leading-none">
            <span className={`tabular text-[2.5rem] font-bold tracking-tight ${over ? 'text-gold' : ''}`}>
              {fmtInt(leftAnim)}
            </span>
            <span className={`mt-1.5 text-xs font-medium ${over ? 'text-gold' : 'text-bg/60 dark:text-cocoa-light'}`}>
              kcal {over ? 'drüber' : 'übrig'}
            </span>
          </div>
        </Ring>
        <Side
          label="Ziel"
          value={fmtInt(targets.kcal)}
          hint={trained && bonus > 0 ? `inkl. Training +${bonus}` : undefined}
        />
      </div>

      <div className="relative grid grid-cols-3 gap-3">
        <Macro label="Eiweiß" value={totals.protein} target={targets.protein} bar="bg-brand" successWhenDone />
        <Macro label="Kohlenhydrate" value={totals.carbs} target={targets.carbs} bar="bg-gold" />
        <Macro label="Fett" value={totals.fat} target={targets.fat} bar="bg-bg/70 dark:bg-cocoa-light" />
      </div>

      <div className="relative border-t border-bg/10 pt-2 dark:border-sand-dark/40">
        <button
          className="flex w-full items-center justify-between py-1 text-sm text-bg/60 dark:text-cocoa-light"
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
          <div className="anim-fade tabular mt-2 grid grid-cols-4 gap-2 rounded-xl bg-bg/10 p-2 text-center text-[11px] text-bg/60 dark:bg-white/5 dark:text-cocoa-light">
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
      <span className="tabular text-lg font-semibold">{value}</span>
      <span className="text-[11px] text-bg/60 dark:text-cocoa-light">{label}</span>
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
      <div className="truncate text-xs font-medium">{label}</div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg/15 dark:bg-sand-dark/45">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${done ? 'bg-success' : bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="tabular mt-1 text-[11px] text-bg/60 dark:text-cocoa-light">
        <span className="font-semibold text-bg dark:text-cocoa">{Math.round(value)}</span>
        {target > 0 ? ` / ${Math.round(target)} g` : ' g'}
      </div>
    </div>
  )
}

function Micro({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold text-bg dark:text-cocoa">{String(value).replace('.', ',')} g</div>
      {label}
    </div>
  )
}
