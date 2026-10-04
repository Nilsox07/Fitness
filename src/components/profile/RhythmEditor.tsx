import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, ChevronDown, Minus, Moon, Plus, Trash2 } from 'lucide-react'
import { usePlans } from '../../hooks/usePlans'
import { useTrainingRhythm, useUserPrefs } from '../../hooks/usePrefsSync'
import { trainingDay } from '../../lib/day'
import {
  WEEKDAY_SHORT,
  makeAnchor,
  rotationPosition,
  sanitizeSchedule,
  upcoming,
  weeklyGoal,
  type RotationAnchor,
  type Schedule,
  type ScheduleStep,
  type ScheduleType,
} from '../../lib/schedule'
import { PremiumSheet } from '../ui/PremiumSheet'
import { SEG_TRACK, segBtn } from './ui'

const TYPES: { v: ScheduleType; label: string; hint: string }[] = [
  { v: 'weekdays', label: 'Wochentage', hint: 'Feste Tage, z. B. Mo Push · Mi Pull · Fr Beine.' },
  {
    v: 'rotation',
    label: 'Reihenfolge',
    hint: 'Eine Schleife, z. B. Push → Pull → Beine → Ruhetag. Das nächste Training richtet sich nach deinem letzten — verpasste Tage verschieben nichts.',
  },
  { v: 'flexible', label: 'Flexibel', hint: 'Nur ein Wochenziel — die App schlägt den passenden Plan vor.' },
]

const WEEKDAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

type PickTarget = { kind: 'weekday'; i: number } | { kind: 'step'; i: number } | { kind: 'add' }

/** Editor für den Trainingsrhythmus (Profil → Trainingsrhythmus). */
export function RhythmEditor() {
  const { ready } = useUserPrefs()
  const { data: plans } = usePlans()
  // Entwürfe erst anlegen, wenn Einstellungen und Pläne geladen sind
  if (!ready || plans === undefined) {
    return <div className="h-64 animate-pulse rounded-2xl bg-sand" aria-hidden />
  }
  return <RhythmEditorInner />
}

function RhythmEditorInner() {
  const navigate = useNavigate()
  const { prefs, save, source } = useUserPrefs()
  const { data: plans } = usePlans()
  const today = trainingDay()
  const { history } = useTrainingRhythm(today)

  const planList = useMemo(() => plans ?? [], [plans])
  const planIds = useMemo(() => new Set(planList.map((p) => p.id)), [planList])
  const nameOf = (id: string | null) => (id ? (planList.find((p) => p.id === id)?.name ?? 'Plan') : 'Ruhetag')

  // Entwürfe je Typ — ein Wechsel des Typs verwirft nichts, bis gespeichert wird.
  const initial = plans ? sanitizeSchedule(prefs.schedule, planIds) : prefs.schedule
  const [type, setType] = useState<ScheduleType>(initial?.type ?? 'weekdays')
  const [days, setDays] = useState<ScheduleStep[]>(
    initial?.type === 'weekdays' ? initial.days : [null, null, null, null, null, null, null],
  )
  const [steps, setSteps] = useState<ScheduleStep[]>(() => {
    if (initial?.type === 'rotation') return initial.steps
    const firstPlans = planList.slice(0, 3).map((p) => p.id)
    return firstPlans.length ? [...firstPlans, null] : []
  })
  const [anchor, setAnchor] = useState<RotationAnchor | null>(
    initial?.type === 'rotation' ? (initial.anchor ?? null) : null,
  )
  const [perWeek, setPerWeek] = useState(initial?.type === 'flexible' ? initial.perWeek : weeklyGoal(initial))
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const draft: Schedule =
    type === 'weekdays'
      ? { type, days }
      : type === 'rotation'
        ? { type, steps, anchor }
        : { type, perWeek }
  const goal = weeklyGoal(draft)
  const preview = upcoming(draft, history, today, 7)
  const position = type === 'rotation' ? rotationPosition(draft, history, today) : null
  const hasTraining = type === 'flexible' || (type === 'weekdays' ? days.some(Boolean) : steps.some(Boolean))

  const touch = () => setSaved(false)

  function choose(id: ScheduleStep) {
    if (!pick) return
    touch()
    if (pick.kind === 'weekday') setDays(days.map((d, i) => (i === pick.i ? id : d)))
    else if (pick.kind === 'step') setSteps(steps.map((s, i) => (i === pick.i ? id : s)))
    else setSteps([...steps, id])
    setPick(null)
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    touch()
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next)
    // Der gesetzte Stand wandert mit seinem Schritt
    if (anchor && (anchor.stepIndex === i || anchor.stepIndex === j)) {
      setAnchor({ ...anchor, stepIndex: anchor.stepIndex === i ? j : i })
    }
  }

  function remove(i: number) {
    touch()
    setSteps(steps.filter((_, k) => k !== i))
    if (anchor) {
      const left = steps.length - 1
      if (left <= 0) setAnchor(null)
      else setAnchor({ ...anchor, stepIndex: Math.min(left - 1, anchor.stepIndex > i ? anchor.stepIndex - 1 : anchor.stepIndex) })
    }
  }

  function setPosition(i: number) {
    touch()
    setAnchor(makeAnchor(i, history, today))
  }

  async function submit() {
    setBusy(true)
    try {
      await save({ schedule: draft })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  const noPlans = plans !== undefined && planList.length === 0

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl bg-cream p-4">
        <div className={`${SEG_TRACK} grid-cols-3`} role="radiogroup" aria-label="Art des Rhythmus">
          {TYPES.map((t) => (
            <button
              key={t.v}
              type="button"
              role="radio"
              aria-checked={type === t.v}
              onClick={() => {
                touch()
                setType(t.v)
              }}
              className={segBtn(type === t.v, 'text-xs')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-cocoa-light">{TYPES.find((t) => t.v === type)!.hint}</p>
        {noPlans && type !== 'flexible' && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-sand px-3 py-2.5 text-sm">
            <span className="text-cocoa-light">Du hast noch keine Pläne.</span>
            <button className="shrink-0 font-semibold text-brand" onClick={() => navigate('/plans')}>
              Plan anlegen
            </button>
          </div>
        )}
      </div>

      {/* ---- Wochentage ---- */}
      {type === 'weekdays' && (
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {days.map((id, i) => (
            <div key={i} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
              <span className="w-24 shrink-0 font-medium">{WEEKDAY_LONG[i]}</span>
              <PlanChip id={id} name={nameOf(id)} onClick={() => setPick({ kind: 'weekday', i })} label={WEEKDAY_LONG[i]} />
            </div>
          ))}
        </div>
      )}

      {/* ---- Reihenfolge ---- */}
      {type === 'rotation' && (
        <>
          <div className="space-y-1.5">
            <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Schleife</h2>
            <div className="overflow-hidden rounded-2xl bg-cream">
              {steps.length === 0 && (
                <p className="px-4 py-4 text-sm text-cocoa-light">Füge den ersten Schritt hinzu.</p>
              )}
              <ol className="divide-y divide-sand-dark/40">
                {steps.map((id, i) => (
                  <li key={i} className="flex min-h-[52px] items-center gap-2 py-2 pl-4 pr-2">
                    <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand text-[11px] font-bold text-cocoa-light">
                      {i + 1}
                    </span>
                    <PlanChip id={id} name={nameOf(id)} onClick={() => setPick({ kind: 'step', i })} label={`Schritt ${i + 1}`} />
                    <div className="flex shrink-0 items-center">
                      <IconBtn label={`Schritt ${i + 1} nach oben`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp size={16} />
                      </IconBtn>
                      <IconBtn
                        label={`Schritt ${i + 1} nach unten`}
                        disabled={i === steps.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={16} />
                      </IconBtn>
                      <IconBtn label={`Schritt ${i + 1} entfernen`} onClick={() => remove(i)}>
                        <Trash2 size={16} />
                      </IconBtn>
                    </div>
                  </li>
                ))}
              </ol>
              {steps.length < 14 && (
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center gap-2 border-t border-sand-dark/40 px-4 text-sm font-semibold text-brand active:bg-sand/60"
                  onClick={() => setPick({ kind: 'add' })}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Schritt hinzufügen
                </button>
              )}
            </div>
            <p className="px-4 text-xs text-cocoa-muted">Danach geht es wieder von vorne los.</p>
          </div>

          {steps.some(Boolean) && (
            <div className="space-y-2 rounded-2xl bg-cream p-4">
              <div className="font-semibold">Wo stehe ich gerade?</div>
              <p className="text-xs text-cocoa-light">
                Was ist als Nächstes dran? Normalerweise erkennt die App das an deinem letzten Training —
                hier kannst du es korrigieren.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {steps.map((id, i) => {
                  const active = position === i
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPosition(i)}
                      className={`flex max-w-full items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        active ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
                      }`}
                    >
                      <span className="tabular text-xs opacity-70">{i + 1}.</span>
                      <span className="truncate">{nameOf(id)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Flexibel ---- */}
      {type === 'flexible' && (
        <div className="flex min-h-[3.5rem] items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
          <div>
            <div className="font-medium">Trainings pro Woche</div>
            <div className="text-xs text-cocoa-light">Dein Wochenziel</div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-sand p-1">
            <IconBtn
              label="Weniger"
              disabled={perWeek <= 1}
              onClick={() => {
                touch()
                setPerWeek(Math.max(1, perWeek - 1))
              }}
            >
              <Minus size={16} />
            </IconBtn>
            <span className="tabular w-8 text-center text-lg font-bold">{perWeek}</span>
            <IconBtn
              label="Mehr"
              disabled={perWeek >= 7}
              onClick={() => {
                touch()
                setPerWeek(Math.min(7, perWeek + 1))
              }}
            >
              <Plus size={16} />
            </IconBtn>
          </div>
        </div>
      )}

      {/* ---- Vorschau ---- */}
      <div className="space-y-2.5 rounded-2xl bg-cream p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold">Nächste 7 Tage</div>
          {hasTraining && (
            <div className="text-xs text-cocoa-light">
              Wochenziel <span className="tabular font-semibold text-cocoa">{goal}×</span>
            </div>
          )}
        </div>
        {type === 'flexible' ? (
          <p className="text-sm text-cocoa-light">
            Keine festen Tage — du trainierst, wann es passt. Die App schlägt jeweils den Plan vor, der am
            längsten nicht dran war.
          </p>
        ) : !hasTraining ? (
          <p className="text-sm text-cocoa-light">Wähle mindestens einen Trainingstag.</p>
        ) : (
          <ul className="grid grid-cols-7 gap-1" aria-label="Vorschau der nächsten 7 Tage">
            {preview.map((d, k) => {
              const train = d.plan.kind === 'train'
              const name = d.plan.kind === 'train' ? nameOf(d.plan.planId) : 'Ruhe'
              return (
                <li
                  key={d.date}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 ${
                    train ? 'bg-brand/10' : 'bg-sand/70'
                  }`}
                  aria-label={`${k === 0 ? 'Heute' : WEEKDAY_LONG[d.weekday]}: ${d.plan.kind === 'train' ? name : 'Ruhetag'}`}
                >
                  <span className={`text-[11px] font-medium ${k === 0 ? 'text-brand' : 'text-cocoa-muted'}`}>
                    {k === 0 ? 'Heute' : WEEKDAY_SHORT[d.weekday]}
                  </span>
                  {train ? (
                    <span className="w-full truncate text-center text-[11px] font-semibold text-cocoa">{name}</span>
                  ) : (
                    <Moon size={13} className="my-px text-cocoa-muted" aria-hidden />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button className="btn-primary w-full gap-2 py-3" onClick={submit} disabled={busy || !hasTraining || saved}>
        {saved ? (
          <>
            <Check size={18} strokeWidth={2.5} />
            Gespeichert
          </>
        ) : busy ? (
          '…'
        ) : (
          'Rhythmus speichern'
        )}
      </button>
      {source === 'local' && (
        <p className="text-center text-xs text-cocoa-muted">Wird vorerst nur auf diesem Gerät gespeichert.</p>
      )}

      {pick && (
        <PremiumSheet
          bodyClassName="space-y-2"
          title={
            pick.kind === 'weekday'
              ? WEEKDAY_LONG[pick.i]
              : pick.kind === 'step'
                ? `Schritt ${pick.i + 1}`
                : 'Schritt hinzufügen'
          }
          onClose={() => setPick(null)}
        >
          <div className="space-y-2">
            {[null, ...planList.map((p) => p.id)].map((id) => {
              const current =
                pick.kind === 'weekday' ? days[pick.i] : pick.kind === 'step' ? steps[pick.i] : undefined
              const active = current !== undefined && current === id
              return (
                <button
                  key={id ?? 'rest'}
                  type="button"
                  onClick={() => choose(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                    active ? 'bg-brand/10 ring-1 ring-brand/30' : 'bg-cream'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      id ? 'bg-brand/15 text-brand' : 'bg-sand text-cocoa-light'
                    }`}
                  >
                    {id ? <span className="text-sm font-bold">{nameOf(id).slice(0, 1)}</span> : <Moon size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(id)}</span>
                  {active && <Check size={18} className="shrink-0 text-brand" />}
                </button>
              )
            })}
          </div>
        </PremiumSheet>
      )}
    </div>
  )
}

function PlanChip({ id, name, onClick, label }: { id: string | null; name: string; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${name} — ändern`}
      className={`flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
        id ? 'bg-brand/10 text-brand' : 'bg-sand text-cocoa-light'
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {!id && <Moon size={14} className="shrink-0" />}
        <span className="truncate">{name}</span>
      </span>
      <ChevronDown size={14} className="shrink-0 opacity-70" />
    </button>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-cocoa-light transition active:bg-sand disabled:opacity-30"
    >
      {children}
    </button>
  )
}
