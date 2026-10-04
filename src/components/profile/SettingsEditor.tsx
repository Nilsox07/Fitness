import { useState, type ReactNode } from 'react'
import { Check, ChevronRight, Minus, Plus } from 'lucide-react'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { usePrefs } from '../../lib/prefs'
import { getRestSeconds, setRestSeconds } from '../../lib/workoutSession'
import { definesDays, describeSchedule, weeklyGoal } from '../../lib/schedule'
import {
  DEFAULT_KCAL_BONUS,
  DEFAULT_MEAL_SPLIT,
  mealSplitSum,
  type MealSplit,
} from '../../lib/userPrefs'
import { DAY_CUTOFF_H } from '../../lib/day'
import { fmtLiters } from '../../lib/nutritionHome'
import { MEALS, MEAL_LABEL } from '../../types'

const REST_DEFAULT = 120

function fmtRest(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** „Meine Einstellungen": Wochenziel, Kalorien-Bonus, Mahlzeiten, Pause, Tageswechsel. */
export function SettingsEditor({ onOpenRhythm, onOpenGoal }: { onOpenRhythm: () => void; onOpenGoal?: () => void }) {
  const { ready } = useUserPrefs()
  if (!ready) return <div className="h-64 animate-pulse rounded-2xl bg-sand" aria-hidden />
  return <SettingsEditorInner onOpenRhythm={onOpenRhythm} onOpenGoal={onOpenGoal} />
}

function SettingsEditorInner({ onOpenRhythm, onOpenGoal }: { onOpenRhythm: () => void; onOpenGoal?: () => void }) {
  const { prefs, save, source } = useUserPrefs()
  const { showNutrition } = usePrefs()
  const { data: nutrition } = useNutritionSettings()

  const flexible = !definesDays(prefs.schedule)
  const [perWeek, setPerWeek] = useState(weeklyGoal(prefs.schedule))
  const [bonus, setBonus] = useState(prefs.kcalBonus)
  const [split, setSplit] = useState<MealSplit>(prefs.mealSplit)
  const [rest, setRest] = useState(getRestSeconds())
  const [cutoff, setCutoff] = useState(prefs.dayCutoff)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const sum = mealSplitSum(split)
  const splitOk = sum === 100
  const dirty =
    (flexible && perWeek !== weeklyGoal(prefs.schedule)) ||
    bonus !== prefs.kcalBonus ||
    MEALS.some((m) => split[m] !== prefs.mealSplit[m]) ||
    rest !== getRestSeconds() ||
    cutoff !== prefs.dayCutoff

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    setSaved(false)
    set(v)
  }

  async function submit() {
    if (!splitOk) return
    setBusy(true)
    try {
      setRestSeconds(rest)
      await save({
        kcalBonus: bonus,
        mealSplit: split,
        dayCutoff: cutoff,
        // Wochenziel nur übernehmen, wenn geändert (sonst bleibt „kein Rhythmus“ bestehen)
        ...(flexible && perWeek !== weeklyGoal(prefs.schedule) ? { schedule: { type: 'flexible' as const, perWeek } } : {}),
      })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Training">
        {flexible ? (
          <Line
            label="Wochenziel"
            hint="Trainings pro Woche"
            trailing={
              <Counter
                value={perWeek}
                min={1}
                max={7}
                label="Wochenziel"
                format={(v) => `${v}×`}
                onChange={change(setPerWeek)}
              />
            }
          />
        ) : (
          <button type="button" className="w-full text-left active:bg-sand/60" onClick={onOpenRhythm}>
            <Line
              label="Wochenziel"
              hint={`Aus deinem Rhythmus · ${describeSchedule(prefs.schedule)}`}
              trailing={
                <span className="flex shrink-0 items-center gap-1 text-sm text-cocoa-light">
                  <span className="tabular font-semibold text-cocoa">{weeklyGoal(prefs.schedule)}×</span>
                  <ChevronRight size={18} className="text-cocoa-muted" />
                </span>
              }
            />
          </button>
        )}
        <Line
          label="Standard-Pause"
          hint="Pausentimer zwischen Sätzen · nur auf diesem Gerät"
          trailing={
            <Counter
              value={rest}
              min={30}
              max={600}
              step={15}
              label="Standard-Pause"
              format={fmtRest}
              onChange={change(setRest)}
            />
          }
        />
        <Line
          label="Tageswechsel"
          hint="Bis dahin zählt ein spätes Training noch zum Vortag."
          trailing={
            <Counter
              value={cutoff}
              min={0}
              max={6}
              label="Tageswechsel"
              format={(v) => `${String(v).padStart(2, '0')}:00`}
              onChange={change(setCutoff)}
            />
          }
        />
      </Section>

      {showNutrition && (
        <Section title="Ernährung">
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="font-medium">Bonus an Trainingstagen</div>
                <div className="text-xs text-cocoa-light">Zusätzliche kcal, wenn du trainiert hast.</div>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold">+{bonus} kcal</span>
            </div>
            <input
              type="range"
              min={0}
              max={600}
              step={25}
              value={bonus}
              onChange={(e) => change(setBonus)(Number(e.target.value))}
              aria-label="Kalorien-Bonus an Trainingstagen"
              className="w-full accent-[rgb(var(--c-ruby))]"
            />
            <div className="flex justify-between text-[11px] text-cocoa-muted">
              <span>0</span>
              <span>Standard {DEFAULT_KCAL_BONUS}</span>
              <span>600</span>
            </div>
          </div>

          <div className="space-y-2 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="font-medium">Mahlzeiten-Aufteilung</div>
                <div className="text-xs text-cocoa-light">Empfehlung je Mahlzeit, in % vom Tagesziel.</div>
              </div>
              <span
                className={`tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  splitOk ? 'bg-success/15 text-success' : 'bg-brand/10 text-brand'
                }`}
                aria-live="polite"
              >
                Summe {sum} %
              </span>
            </div>
            <div className="divide-y divide-sand-dark/40">
              {MEALS.map((m) => (
                <div key={m} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm">{MEAL_LABEL[m]}</span>
                  <Counter
                    value={split[m]}
                    min={0}
                    max={100}
                    step={5}
                    label={MEAL_LABEL[m]}
                    format={(v) => `${v} %`}
                    onChange={(v) => change(setSplit)({ ...split, [m]: v })}
                  />
                </div>
              ))}
            </div>
            {!splitOk && (
              <p className="text-xs text-brand">
                Die Anteile müssen zusammen 100 % ergeben ({sum > 100 ? `${sum - 100} % zu viel` : `${100 - sum} % fehlen`}).
              </p>
            )}
            {MEALS.some((m) => split[m] !== DEFAULT_MEAL_SPLIT[m]) && (
              <button
                type="button"
                className="text-xs font-semibold text-brand"
                onClick={() => change(setSplit)(DEFAULT_MEAL_SPLIT)}
              >
                Auf 25 / 35 / 30 / 10 zurücksetzen
              </button>
            )}
          </div>

          {onOpenGoal && (
            <button type="button" className="w-full text-left active:bg-sand/60" onClick={onOpenGoal}>
              <Line
                label="Wasserziel"
                hint="In „Ziel & Körperdaten“"
                trailing={
                  <span className="flex shrink-0 items-center gap-1 text-sm text-cocoa-light">
                    {nutrition?.water_target_ml ? `${fmtLiters(nutrition.water_target_ml)} l` : null}
                    <ChevronRight size={18} className="text-cocoa-muted" />
                  </span>
                }
              />
            </button>
          )}
        </Section>
      )}

      <div className="space-y-2">
        <button className="btn-primary w-full gap-2 py-3" onClick={submit} disabled={busy || !splitOk || !dirty || saved}>
          {saved ? (
            <>
              <Check size={18} strokeWidth={2.5} />
              Gespeichert
            </>
          ) : busy ? (
            '…'
          ) : (
            'Speichern'
          )}
        </button>
        {source === 'local' && (
          <p className="text-center text-xs text-cocoa-muted">Wird vorerst nur auf diesem Gerät gespeichert.</p>
        )}
        <p className="text-center text-[11px] text-cocoa-muted">
          Standard: 250 kcal · 25/35/30/10 % · {fmtRest(REST_DEFAULT)} Pause · {String(DAY_CUTOFF_H).padStart(2, '0')}:00 Uhr
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h2>
      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">{children}</div>
    </section>
  )
}

function Line({ label, hint, trailing }: { label: string; hint?: string; trailing: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs text-cocoa-light">{hint}</div>}
      </div>
      {trailing}
    </div>
  )
}

function Counter({
  value,
  min,
  max,
  step = 1,
  label,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  label: string
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  const btn =
    'grid h-8 w-8 place-items-center rounded-full text-cocoa transition active:bg-sand-dark disabled:opacity-30'
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-sand p-0.5">
      <button
        type="button"
        className={btn}
        aria-label={`${label} verringern`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus size={15} />
      </button>
      <span className="tabular min-w-[3.25rem] text-center text-sm font-semibold" aria-live="polite">
        {format(value)}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`${label} erhöhen`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
