// „Jetzt dran“: die (höchstens drei) Dinge, die gerade anstehen – mit Knopf direkt daneben.
// Was gerade nicht dran ist, taucht nicht auf (Logik in src/lib/nextUp.ts).

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Droplet, Dumbbell, HeartPulse, Moon, Pill, Sparkles, Utensils } from 'lucide-react'
import type { TodaySummary } from '../../hooks/useToday'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useFoodEntries } from '../../hooks/useNutrition'
import { useSetWater } from '../../hooks/useWater'
import { useJournal, useSaveJournal } from '../../hooks/useJournal'
import { useSupplementLog, useSupplements, useToggleDose } from '../../hooks/useSupplements'
import { useSleepPlan } from '../../hooks/useRecovery'
import { useManualActivities } from '../../hooks/useManualActivities'
import { usePrefs } from '../../lib/prefs'
import { dosesFor } from '../../lib/supplements'
import { weekdayIndex } from '../../lib/schedule'
import { cardioTitle } from '../../lib/onboarding'
import { sportById } from '../../lib/sports'
import { FEEL_LABEL } from '../../lib/journal'
import { nextUp, type NextItem, type NextKind } from '../../lib/nextUp'
import { FEEL_ICON } from '../journal/habitIcons'
import { haptic } from '../../lib/native'
import type { Meal } from '../../types'

const ICON: Record<NextKind, ReactNode> = {
  feel: <Sparkles size={18} />,
  workout: <Dumbbell size={18} />,
  cardio: <HeartPulse size={18} />,
  meal: <Utensils size={18} />,
  water: <Droplet size={18} />,
  supplement: <Pill size={18} />,
  bedtime: <Moon size={18} />,
}

const pill =
  'shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-on-brand transition active:scale-95'

export function NextUpCard({ t, style }: { t: TodaySummary; style?: React.CSSProperties }) {
  const navigate = useNavigate()
  const { showNutrition, hasWatch, hasHybrid } = usePrefs()
  const { prefs, save } = useUserPrefs()
  const { data: food } = useFoodEntries(t.day)
  const setWater = useSetWater()
  const { data: journal = [] } = useJournal()
  const saveJournal = useSaveJournal()
  const { data: supps = [] } = useSupplements()
  const { data: suppLog = [] } = useSupplementLog(t.day)
  const toggleDose = useToggleDose()
  const plan = useSleepPlan()
  const { data: manual = [] } = useManualActivities()

  const now = new Date()
  const hour = now.getHours()
  const hhmm = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const todayEntry = journal.find((e) => e.date === t.day)
  const session = prefs.cardioPlan?.sessions.find((s) => s.day === weekdayIndex(t.day))
  const cardioDone =
    prefs.cardioDone.includes(t.day) || manual.some((a) => a.date === t.day && sportById(a.sport).cardio)
  const due = showNutrition ? dosesFor(t.day, supps, suppLog).find((d) => !d.taken && d.slot <= hhmm) : undefined
  const logged: Partial<Record<Meal, boolean>> = {}
  for (const e of food ?? []) logged[(e.meal ?? 'snack') as Meal] = true

  const items = nextUp({
    hour,
    showNutrition,
    hasWatch,
    hasHybrid,
    trainedToday: t.trainedToday,
    restDay: t.restDay,
    nextWorkout: t.nextWorkout,
    cardioToday: session ? cardioTitle(session) : null,
    cardioDone,
    mealsLogged: logged,
    waterMl: t.waterMl,
    waterTarget: t.waterTarget,
    supplementDue: due ? { name: due.supplement.name, time: due.slot } : null,
    bedAt: plan?.bedAt ?? null,
    feelAnswered: todayEntry?.feel != null,
  })

  function action(it: NextItem): ReactNode {
    switch (it.kind) {
      case 'feel':
        return null
      case 'workout':
        return (
          <button className={pill} onClick={() => navigate('/')}>
            Start
          </button>
        )
      case 'cardio':
        return (
          <button className={pill} onClick={() => void save({ cardioDone: [...prefs.cardioDone, t.day] })}>
            Abhaken
          </button>
        )
      case 'meal':
        return (
          <button className={pill} onClick={() => navigate('/nutrition?add=menu')}>
            Eintragen
          </button>
        )
      case 'water':
        return (
          <button
            className={pill}
            onClick={() => {
              setWater.mutate({ date: t.day, ml: t.waterMl + 250 })
              void haptic('success')
            }}
          >
            +250 ml
          </button>
        )
      case 'supplement':
        return (
          <button
            className={pill}
            onClick={() =>
              due && toggleDose.mutate({ supplementId: due.supplement.id, date: t.day, slot: due.slot, taken: true })
            }
          >
            Genommen
          </button>
        )
      case 'bedtime':
        return (
          <button className="shrink-0 text-sm font-semibold text-brand" onClick={() => navigate('/sleep')}>
            Details
          </button>
        )
    }
  }

  return (
    <section className="card space-y-1" style={style}>
      <h2 className="px-0.5 pb-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Jetzt dran</h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 py-1.5 text-sm text-cocoa-light">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-success/15 text-success">
            <Check size={16} strokeWidth={3} />
          </span>
          Alles erledigt für jetzt – stark.
        </p>
      ) : (
        <ul className="divide-y divide-sand-dark/40">
          {items.map((it) => (
            <li key={it.kind} className="py-2.5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
                  {ICON[it.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{it.title}</span>
                  {it.sub && <span className="block truncate text-xs text-cocoa-light">{it.sub}</span>}
                </span>
                {action(it)}
              </div>
              {it.kind === 'feel' && (
                <div className="mt-2 grid grid-cols-5 gap-1.5 pl-[3.25rem]">
                  {[1, 2, 3, 4, 5].map((v) => {
                    const Icon = FEEL_ICON[v]
                    return (
                      <button
                        key={v}
                        aria-label={FEEL_LABEL[v]}
                        onClick={() => saveJournal.mutate({ date: t.day, tags: todayEntry?.tags ?? [], feel: v })}
                        className="flex flex-col items-center gap-0.5 rounded-xl bg-sand py-1.5 text-cocoa-light active:scale-95"
                      >
                        <Icon size={18} />
                        <span className="text-[9px] font-semibold">{FEEL_LABEL[v]}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
