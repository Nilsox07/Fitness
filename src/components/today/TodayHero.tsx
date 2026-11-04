import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, MessageSquare, Plus, ScanBarcode, Search } from 'lucide-react'
import { BuddyLine, HeroWithBuddy } from '../home/HeroBuddy'
import { useHeroBuddy } from '../home/useHeroBuddy'
import { useBriefing } from '../buddy/useBriefing'
import { enter } from '../home/motion'
import { HeroPill } from '../health/ui'
import { PlusBadge } from '../premium/PlusBadge'
import { useToday } from '../../hooks/useToday'
import { useAddFoodEntry, useAllFoodEntries } from '../../hooks/useNutrition'
import { useAiGate } from '../../hooks/usePremium'
import { usePrefs } from '../../lib/prefs'
import { localDate } from '../../lib/day'
import { recentFoods, repeatEntry } from '../../lib/recentFoods'
import { currentMeal } from '../recipes/recipeUtils'
import { fmtInt } from '../../lib/nutritionHome'
import { haptic } from '../../lib/native'
import { MEAL_LABEL } from '../../types'

/**
 * Kopf von „Heute“: Buddy sitzt auf der großen Karte, sein Spruch (bzw. das Tagesbriefing) oben.
 * Darunter die wichtigsten Zahlen und – mit Ernährung – Essen direkt hier eintragen.
 */
export function TodayHero() {
  const t = useToday()
  const navigate = useNavigate()
  const { showNutrition, hasWatch } = usePrefs()
  const gate = useAiGate()
  const brief = useBriefing()
  const tipBuddy = useHeroBuddy('today')

  // Spruch: Tagesbriefing (Plus: nach Antippen; kostenlos: fester Text), sonst der Seiten-Tipp
  const hasBrief = !!brief.text
  const buddy = {
    ...tipBuddy,
    mood: brief.busy ? ('focus' as const) : tipBuddy.mood,
    line: brief.busy ? 'Ich schau mir deinen Tag an …' : hasBrief ? brief.text! : tipBuddy.line,
    onLine:
      !hasBrief && (brief.aiOn || brief.locked)
        ? () => void brief.load()
        : brief.locked && hasBrief
          ? () => void brief.load()
          : tipBuddy.onLine,
  }

  const pills: { value: string; label: string }[] = []
  if (hasWatch && t.readiness) pills.push({ value: String(t.readiness.score), label: 'Tagesform' })
  if (showNutrition && t.kcalTarget > 0) {
    const left = t.kcalTarget - t.kcalEaten
    pills.push({ value: fmtInt(Math.abs(left)), label: left >= 0 ? 'kcal übrig' : 'kcal drüber' })
  }
  pills.push({ value: `${t.weekDone}/${t.weekGoal}`, label: 'Trainings' })
  if (pills.length < 3)
    pills.push({ value: String(t.streakWeeks), label: t.streakWeeks === 1 ? 'Woche Serie' : 'Wochen Serie' })

  return (
    <div style={enter(1)}>
      <HeroWithBuddy buddy={buddy}>
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            <BuddyLine line={buddy.line} tone="dark" onClick={buddy.onLine} long />
            {!hasBrief && brief.locked && (
              <p className="-mt-2 mb-3 flex items-center gap-1.5 text-[11px] text-bg/60 dark:text-cocoa-light">
                Tippen für dein Tagesbriefing <PlusBadge onDark />
              </p>
            )}
            <div className={`grid gap-2 ${pills.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {pills.slice(0, 3).map((p) => (
                <HeroPill key={p.label} value={p.value} label={p.label} />
              ))}
            </div>
            {showNutrition && (
              <QuickFood aiLocked={gate.locked} aiOn={gate.enabled} onOpen={(m) => navigate(`/nutrition?add=${m}`)} />
            )}
          </div>
        </section>
      </HeroWithBuddy>
    </div>
  )
}

/** Essen eintragen, ohne erst in den Ernährungs-Tab zu wechseln: Wege + „Nochmal“ mit einem Tipp. */
function QuickFood({ aiOn, aiLocked, onOpen }: { aiOn: boolean; aiLocked: boolean; onOpen: (mode: string) => void }) {
  const { data: all } = useAllFoodEntries()
  const add = useAddFoodEntry()
  const day = localDate()
  const meal = currentMeal()
  const recent = useMemo(() => recentFoods(all ?? [], meal, day).slice(0, 2), [all, meal, day])
  const [done, setDone] = useState<Record<string, boolean>>({})

  const ways = [
    ...(aiOn
      ? [
          { id: 'photo', label: 'Foto', Icon: Camera },
          { id: 'aitext', label: 'Sagen', Icon: MessageSquare },
        ]
      : []),
    { id: 'scan', label: 'Scannen', Icon: ScanBarcode },
    { id: 'search', label: 'Suchen', Icon: Search },
  ]

  return (
    <div className="mt-4 border-t border-white/10 pt-3 dark:border-sand-dark/40">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
        {MEAL_LABEL[meal]} eintragen
      </p>
      <div className={`grid gap-2 ${ways.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {ways.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className="relative flex flex-col items-center gap-1 rounded-2xl bg-bg/10 py-2.5 text-xs font-semibold transition active:scale-95 dark:bg-white/5"
          >
            <Icon size={19} className="text-brand" />
            {label}
            {aiLocked && (id === 'photo' || id === 'aitext') && (
              <span className="absolute right-1 top-1">
                <PlusBadge onDark />
              </span>
            )}
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {recent.map(({ entry: e }) => (
            <button
              key={e.id}
              type="button"
              disabled={add.isPending}
              onClick={() => {
                add.mutate(repeatEntry(e, day, meal))
                void haptic('success')
                setDone((d) => ({ ...d, [e.id]: true }))
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-bg/10 py-2 pl-3 pr-2 text-left transition active:scale-[0.99] disabled:opacity-60 dark:bg-white/5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{e.name}</span>
                <span className="tabular block text-[11px] text-bg/60 dark:text-cocoa-light">
                  Nochmal · {fmtInt(e.kcal)} kcal
                </span>
              </span>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  done[e.id] ? 'bg-success text-white' : 'bg-brand text-on-brand'
                }`}
              >
                {done[e.id] ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
