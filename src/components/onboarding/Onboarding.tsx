import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Armchair,
  Bandage,
  Bike,
  Check,
  ChevronLeft,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Hammer,
  HeartPulse,
  House,
  Info,
  ShieldCheck,
  Sprout,
  Timer,
  Trees,
  TrendingUp,
  Trophy,
  Users,
  Utensils,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { MyBuddy } from '../buddy/MyBuddy'
import { Hero } from '../health/ui'
import type { BuddyMood } from '../../lib/buddyMood'
import { usePrefs } from '../../lib/prefs'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useCreateExercise, useExercises } from '../../hooks/useExercises'
import { nextPlanPosition, useAddPlanExercise, useCreatePlan, usePlans } from '../../hooks/usePlans'
import { useNutritionSettings, useUpsertNutritionSettings } from '../../hooks/useNutrition'
import { useLibrary } from '../library/useLibrary'
import { getLinks, normalize, setLinks } from '../../lib/exerciseLibrary'
import { planStarter } from '../../lib/starterSets'
import { withWidget } from '../../lib/dashboard'
import { markSeen } from '../../lib/whatsnew'
import { isNative, requestNotifyPermission } from '../../lib/native'
import { computeTargets, defaultWaterTarget } from '../../lib/nutrition'
import {
  CARDIO_KINDS,
  DAILY,
  DEFAULT_ANSWERS,
  EQUIPMENT,
  FOCUSES,
  GOALS,
  MINUTES,
  PLACES,
  WEEKDAYS,
  activityFor,
  buildCardioPlan,
  buildSchedule,
  buildTemplate,
  cardioHowTo,
  cardioTitle,
  nutritionGoalFor,
  suggestCardioPerWeek,
  suggestDays,
  toggleEquip,
  togglePlace,
  weekPlanNames,
  type CardioKind,
  type CardioSession,
  type Daily,
  type Experience,
  type FitGoal,
  type Focus,
  type OnboardingAnswers,
} from '../../lib/onboarding'
import type { Sex } from '../../types'

/** Symbole statt Emojis – neutral wie im Rest der App. */
const OB_ICON: Record<string, LucideIcon> = {
  muscle: Dumbbell,
  lose: Flame,
  fit: HeartPulse,
  strength: Trophy,
  endurance: Activity,
  gym: Dumbbell,
  home: House,
  outdoor: Trees,
  sitting: Armchair,
  mixed: Footprints,
  active: Hammer,
  run: Activity,
  bike: Bike,
  walk: Footprints,
  any: Timer,
  none: Dumbbell,
  new: Sprout,
  some: TrendingUp,
  pro: Trophy,
  no: ShieldCheck,
  yes: Bandage,
}
function obIcon(id: string) {
  const I = OB_ICON[id] ?? Dumbbell
  return <I size={20} />
}
export const OPEN_ONBOARDING_EVENT = 'open-onboarding'

/** Nur die Plan-Fragen öffnen (Profil/Pläne → „Plan neu erstellen“) – ohne Begrüßung und Einrichtung. */
export function openPlanWizard(): void {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT))
}

/** Zeigt das Intro beim ersten Start – und auf Wunsch erneut. */
export function OnboardingHost() {
  const { prefs, ready } = useUserPrefs()
  const [manual, setManual] = useState(false)
  const [closed, setClosed] = useState(false)
  // Einmal geöffnet, bleibt es offen bis zum Schließen (auch wenn „onboarded“ beim Speichern wechselt)
  const [auto, setAuto] = useState(false)
  useEffect(() => {
    if (ready && !prefs.onboarded) setAuto(true)
  }, [ready, prefs.onboarded])
  useEffect(() => {
    const on = () => {
      setClosed(false)
      setManual(true)
    }
    window.addEventListener(OPEN_ONBOARDING_EVENT, on)
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, on)
  }, [])
  const open = !closed && (manual || auto)
  if (!open) return null
  return (
    <Onboarding
      mode={manual && !auto ? 'plan' : 'intro'}
      onClose={() => {
        setClosed(true)
        setManual(false)
        setAuto(false)
      }}
    />
  )
}

type Step =
  | 'hello'
  | 'goal'
  | 'level'
  | 'place'
  | 'days'
  | 'cardio'
  | 'focus'
  | 'limits'
  | 'modules'
  | 'daily'
  | 'body'
  | 'plan'
  | 'done'

const LIMITS_HINT =
  'Bitte kläre dein Training vorher mit Ärztin/Arzt oder Physio ab. Wir erstellen keinen medizinischen Plan.'

function Onboarding({ mode, onClose }: { mode: 'intro' | 'plan'; onClose: () => void }) {
  const planOnly = mode === 'plan'
  const navigate = useNavigate()
  const { prefs, save } = useUserPrefs()
  const mods = usePrefs()
  const { data: settings } = useNutritionSettings()
  const upsertNutrition = useUpsertNutritionSettings()
  const { list } = useLibrary()
  const { data: mine } = useExercises()
  const { data: plans } = usePlans()
  const createEx = useCreateExercise()
  const createPlan = useCreatePlan()
  const addPlanEx = useAddPlanExercise()

  const [step, setStep] = useState<Step>(planOnly ? 'goal' : 'hello')
  const [a, setA] = useState<OnboardingAnswers>({
    ...DEFAULT_ANSWERS,
    goal: prefs.fitGoal ?? 'muscle',
    gymDays: suggestDays(3),
  })
  const [limitsNote, setLimitsNote] = useState('')
  const [useNutrition, setUseNutrition] = useState(mods.showNutrition)
  const [useWatch, setUseWatch] = useState(mods.hasWatch)
  const [useSocial, setUseSocial] = useState(mods.showSocial)
  const [useCycle, setUseCycle] = useState(mods.hasCycle)
  const [body, setBody] = useState({
    sex: (settings?.sex === 'f' ? 'f' : 'm') as Sex,
    age: settings?.age ?? 30,
    height: settings?.height_cm ?? 175,
    weight: settings?.weight_kg ?? 75,
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [notifyAsk, setNotifyAsk] = useState<'open' | 'done'>('open')
  const [err, setErr] = useState<string | null>(null)

  // Alltag nur, wenn ein Kalorienziel berechnet wird (beim neuen Plan mit gespeicherten Körperdaten)
  const order: Step[] = planOnly
    ? [
        'goal',
        'level',
        'place',
        'days',
        'cardio',
        'focus',
        'limits',
        ...(useNutrition && settings ? ['daily' as const] : []),
        'plan',
      ]
    : [
        'hello',
        'goal',
        'level',
        'place',
        'days',
        'cardio',
        'focus',
        'limits',
        'modules',
        ...(useNutrition ? (['daily', 'body'] as const) : []),
        'plan',
      ]
  const idx = order.indexOf(step)
  const next = () => setStep(order[Math.min(order.length - 1, idx + 1)])
  const back = () => idx > 0 && setStep(order[idx - 1])
  const set = <K extends keyof OnboardingAnswers>(k: K, v: OnboardingAnswers[K]) => setA((x) => ({ ...x, [k]: v }))

  const template = useMemo(() => buildTemplate(a), [a])
  const cardio = useMemo(() => buildCardioPlan(a), [a])
  const week = weekPlanNames(
    template.plans.map((p) => p.name),
    a.gymDays,
  )

  async function skip() {
    markSeen()
    await save({ onboarded: true })
    onClose()
  }

  async function finish() {
    if (!list || !mine || !plans || busy) return
    setErr(null)
    try {
      // 1. Übungen + Pläne (Vorhandenes wird wiederverwendet)
      setBusy('Übungen anlegen …')
      const prev = planStarter(
        template,
        mine,
        plans.map((p) => p.name),
        list,
        getLinks(),
      )
      const idByLib = new Map(prev.existing)
      const links: Record<string, string> = {}
      for (const c of prev.create) {
        const created = await createEx.mutateAsync(c.input)
        idByLib.set(c.lib, created.id)
        links[created.id] = c.lib
      }
      if (Object.keys(links).length) setLinks(links)

      setBusy('Pläne anlegen …')
      const planIds = new Map<string, string>()
      let pos = nextPlanPosition(plans)
      for (const p of prev.plans) {
        const have = plans.find((x) => normalize(x.name) === normalize(p.name))
        if (have) {
          planIds.set(p.name, have.id)
          continue
        }
        const plan = await createPlan.mutateAsync({ name: p.name, position: pos++ })
        const ids = p.libs.map((l) => idByLib.get(l)).filter((x): x is string => !!x)
        for (const [position, exercise_id] of ids.entries()) {
          await addPlanEx.mutateAsync({ plan_id: plan.id, exercise_id, position })
        }
        planIds.set(p.name, plan.id)
      }

      // 2. Ernährung (nur wenn gewünscht; beim neuen Plan mit den gespeicherten Körperdaten)
      if (useNutrition && (!planOnly || settings)) {
        setBusy('Kalorienziel berechnen …')
        // Beim neuen Plan die gespeicherten Körperdaten nehmen (die Fragen dazu gibt es dort nicht)
        const b =
          planOnly && settings
            ? { sex: settings.sex, age: settings.age, height: settings.height_cm, weight: settings.weight_kg }
            : body
        const goal = nutritionGoalFor(a.goal, a.experience)
        const activity = activityFor(a.gymDays.length + (cardio?.sessions.length ?? 0), a.daily)
        const t = computeTargets({
          sex: b.sex,
          age: b.age,
          height_cm: b.height,
          weight_kg: b.weight,
          activity,
          goal,
        })
        await upsertNutrition.mutateAsync({
          sex: b.sex,
          age: b.age,
          height_cm: b.height,
          weight_kg: b.weight,
          activity,
          goal,
          kcal_target: t.kcal,
          protein_target: t.protein,
          carbs_target: t.carbs,
          fat_target: t.fat,
          water_target_ml: settings?.water_target_ml ?? defaultWaterTarget(b.weight),
        })
      }

      // 3. Bereiche (nur im Intro) + Rhythmus + Ausdauer-Plan
      if (!planOnly) {
        mods.setShowNutrition(useNutrition)
        mods.setHasWatch(useWatch)
        mods.setShowSocial(useSocial)
        mods.setHasCycle(useCycle)
      }
      // Ausdauer gewählt → Hybrid-Bereich an (lässt sich im Profil wieder abschalten)
      if (cardio) mods.setHasHybrid(true)
      else if (!planOnly) mods.setHasHybrid(false)
      await save({
        onboarded: true,
        fitGoal: a.goal,
        cardioPlan: cardio,
        dashboard: (() => {
          let d = cardio ? withWidget(prefs.dashboard, 'cardioPlan', 'nextWorkout') : prefs.dashboard
          if (!planOnly && useCycle) d = withWidget(d, 'cycle', 'nextWorkout')
          return d
        })(),
        schedule: buildSchedule(
          planIds,
          template.plans.map((p) => p.name),
          a.gymDays,
        ),
      })
      markSeen()
      setBusy(null)
      setStep('done')
    } catch (e) {
      setBusy(null)
      setErr(`Das hat nicht geklappt (${e instanceof Error ? e.message : 'Fehler'}). Nochmal versuchen?`)
    }
  }

  if (step === 'done')
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <MyBuddy size={140} mood="cheer" />
          <h1 className="text-3xl font-extrabold">{planOnly ? 'Neuer Plan steht!' : 'Alles bereit!'}</h1>
          <p className="max-w-[18rem] text-[15px] text-cocoa-light">
            {planOnly
              ? 'Pläne und Trainingstage sind aktualisiert.'
              : 'Dein Plan steht. Ich bin immer oben rechts, wenn du Fragen hast.'}
          </p>
          {a.limits && <LimitsHint note={limitsNote} />}
        </div>
        <button
          className="btn-primary w-full rounded-2xl py-4 text-base"
          onClick={() => {
            onClose()
            navigate(planOnly ? '/plans' : '/today')
          }}
        >
          {planOnly ? 'Zu meinen Plänen' : 'Los geht’s'}
        </button>
        {!planOnly && isNative() && notifyAsk !== 'done' && (
          <button
            className="btn-ghost w-full rounded-2xl py-3 text-sm"
            onClick={async () => {
              await requestNotifyPermission()
              setNotifyAsk('done')
            }}
          >
            Erinnerungen erlauben
          </button>
        )}
      </Screen>
    )

  return (
    <Screen>
      {/* Kopf: zurück · Fortschritt · überspringen */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Zurück"
          onClick={back}
          disabled={idx === 0 || !!busy}
          className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa disabled:opacity-0"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${((idx + 1) / order.length) * 100}%` }}
          />
        </div>
        <button
          className="text-sm font-semibold text-cocoa-muted"
          onClick={planOnly ? onClose : skip}
          disabled={!!busy}
        >
          {planOnly ? 'Abbrechen' : 'Überspringen'}
        </button>
      </div>

      <div key={step} className="anim-fade -mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-2 pt-6">
        {step === 'hello' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <MyBuddy size={150} mood="happy" />
            <h1 className="text-3xl font-extrabold">Hi, ich bin Buddy!</h1>
            <p className="max-w-[18rem] text-[15px] text-cocoa-light">
              Ein paar kurze Fragen – dann bekommst du deinen persönlichen Plan.
            </p>
          </div>
        )}

        {step === 'goal' && (
          <>
            <Ask mood="focus">Was ist dein Ziel?</Ask>
            <Options
              value={a.goal}
              onChange={(v: FitGoal) => {
                set('goal', v)
                if (a.cardio) set('cardioPerWeek', suggestCardioPerWeek(v))
              }}
              items={GOALS.map((g) => ({ id: g.id, label: g.label, icon: obIcon(g.id) }))}
            />
          </>
        )}

        {step === 'level' && (
          <>
            <Ask mood="happy">Wie viel Erfahrung hast du mit Krafttraining?</Ask>
            <Options
              value={a.experience}
              onChange={(v: Experience) => set('experience', v)}
              items={[
                { id: 'new', label: 'Neu dabei', sub: 'Noch nie oder lange her', icon: obIcon('new') },
                { id: 'some', label: 'Etwas Erfahrung', sub: 'Unter einem Jahr', icon: obIcon('some') },
                { id: 'pro', label: 'Fortgeschritten', sub: 'Über ein Jahr regelmäßig', icon: obIcon('pro') },
              ]}
            />
          </>
        )}

        {step === 'place' && (
          <>
            <Ask mood="focus">Wo trainierst du?</Ask>
            <div className="space-y-2" role="group" aria-label="Orte">
              {PLACES.map((p) => (
                <CheckCard
                  key={p.id}
                  icon={obIcon(p.id)}
                  label={p.label}
                  on={a.places.includes(p.id)}
                  onClick={() => setA((x) => togglePlace(x, p.id))}
                />
              ))}
            </div>
            {a.places.includes('home') ? (
              <div className="space-y-2">
                <p className="px-1 text-sm font-semibold text-cocoa-light">Was hast du zuhause?</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Geräte zuhause">
                  {EQUIPMENT.map((e) => {
                    const on = a.equipment.includes(e.id)
                    return (
                      <button
                        key={e.id}
                        aria-pressed={on}
                        onClick={() => set('equipment', toggleEquip(a.equipment, e.id))}
                        className={`rounded-full px-4 py-2.5 text-[15px] font-semibold transition ${
                          on ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
                        }`}
                      >
                        {e.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-cocoa-light">Mehrfachauswahl möglich.</p>
            )}
          </>
        )}

        {step === 'days' && (
          <>
            <Ask mood="focus">An welchen Tagen trainierst du Kraft?</Ask>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => set('gymDays', suggestDays(n))}
                  className={`flex-1 rounded-2xl py-3 text-[15px] font-bold transition ${
                    a.gymDays.length === n ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
            <DayPicker
              value={a.gymDays}
              onChange={(d) => set('gymDays', d)}
              label={(d) => (a.gymDays.includes(d) ? 'Gym' : '')}
            />
            <p className="text-center text-sm text-cocoa-light">Tipp auf einen Tag, um ihn an- oder abzuwählen.</p>
            <div className="space-y-2">
              <p className="px-1 text-sm font-semibold text-cocoa-light">Wie lange pro Training?</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Zeit pro Training">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={a.minutes === m}
                    onClick={() => set('minutes', m)}
                    className={`flex-1 rounded-2xl py-3 text-[15px] font-bold transition ${
                      a.minutes === m ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
                    }`}
                  >
                    {m} Min
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'cardio' && (
          <>
            <Ask mood="cheer">Möchtest du auch Ausdauer machen?</Ask>
            <Options
              value={a.cardio ?? 'none'}
              onChange={(v: CardioKind | 'none') => {
                if (v === 'none') setA((x) => ({ ...x, cardio: null, cardioPerWeek: 0 }))
                else setA((x) => ({ ...x, cardio: v, cardioPerWeek: x.cardioPerWeek || suggestCardioPerWeek(x.goal) }))
              }}
              items={[
                ...CARDIO_KINDS.map((c) => ({ id: c.id as CardioKind | 'none', label: c.label, icon: obIcon(c.id) })),
                { id: 'none', label: 'Nein, nur Kraft', icon: obIcon('none') },
              ]}
            />
            {a.cardio && (
              <div className="space-y-2">
                <p className="px-1 text-sm font-semibold text-cocoa-light">Wie oft pro Woche?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => set('cardioPerWeek', n)}
                      className={`flex-1 rounded-2xl py-3 text-[15px] font-bold transition ${
                        a.cardioPerWeek === n ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
                      }`}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 'focus' && (
          <>
            <Ask mood="focus">Hast du einen Schwerpunkt?</Ask>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Schwerpunkt">
              {FOCUSES.map((f) => {
                const on = a.focus === f.id
                return (
                  <button
                    key={f.id}
                    role="radio"
                    aria-checked={on}
                    onClick={() => set('focus', f.id as Focus)}
                    className={`min-w-0 rounded-2xl px-3 py-3.5 text-center transition active:scale-[0.99] ${
                      on ? 'bg-brand/10 ring-2 ring-brand' : 'bg-cream'
                    }`}
                  >
                    <span className="block truncate text-[15px] font-semibold">{f.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-center text-sm text-cocoa-light">Dafür kommt eine Übung extra dazu.</p>
          </>
        )}

        {step === 'limits' && (
          <>
            <Ask mood="happy">Hast du Verletzungen oder Beschwerden?</Ask>
            <Options
              value={a.limits ? 'yes' : 'no'}
              onChange={(v: 'yes' | 'no') => set('limits', v === 'yes')}
              items={[
                { id: 'no', label: 'Nein', icon: obIcon('no') },
                { id: 'yes', label: 'Ja', sub: 'Dein Plan wird leichter', icon: obIcon('yes') },
              ]}
            />
            {a.limits && (
              <>
                <textarea
                  value={limitsNote}
                  onChange={(e) => setLimitsNote(e.target.value.slice(0, 200))}
                  rows={2}
                  placeholder="Was genau? (optional)"
                  aria-label="Beschwerden (optional)"
                  className="w-full resize-none rounded-2xl bg-cream px-4 py-3 text-[16px] outline-none placeholder:text-cocoa-muted focus:ring-2 focus:ring-brand"
                />
                <LimitsHint />
              </>
            )}
          </>
        )}

        {step === 'daily' && (
          <>
            <Ask mood="happy">Wie aktiv ist dein Alltag?</Ask>
            <Options
              value={a.daily}
              onChange={(v: Daily) => set('daily', v)}
              items={DAILY.map((d) => ({ id: d.id, label: d.label, sub: d.sub, icon: obIcon(d.id) }))}
            />
            <p className="text-center text-sm text-cocoa-light">Ohne Sport – für dein Kalorienziel.</p>
          </>
        )}

        {step === 'modules' && (
          <>
            <Ask mood="happy">Was möchtest du noch nutzen?</Ask>
            <div className="space-y-2">
              <ToggleCard
                icon={<Utensils size={20} />}
                label="Ernährung"
                sub="Kalorien & Eiweiß im Blick"
                on={useNutrition}
                onChange={setUseNutrition}
              />
              <ToggleCard
                icon={<Watch size={20} />}
                label="Uhr & Health Connect"
                sub="Schlaf & Puls – Schritte auch vom Handy"
                on={useWatch}
                onChange={setUseWatch}
              />
              <ToggleCard
                icon={<Users size={20} />}
                label="Freunde"
                sub="Duelle & Bestenliste"
                on={useSocial}
                onChange={setUseSocial}
              />
              <ToggleCard
                icon={<Droplet size={20} />}
                label="Zyklus"
                sub="Für Frauen – Periode & Phase, privat"
                on={useCycle}
                onChange={setUseCycle}
              />
            </div>
            <p className="text-center text-sm text-cocoa-light">Kannst du jederzeit im Profil ändern.</p>
          </>
        )}

        {step === 'body' && (
          <>
            <Ask mood="focus">Für dein Kalorienziel brauche ich noch kurz das:</Ask>
            <div className="flex gap-2">
              {(
                [
                  ['m', 'Mann'],
                  ['f', 'Frau'],
                ] as const
              ).map(([id, l]) => (
                <button
                  key={id}
                  onClick={() => setBody((b) => ({ ...b, sex: id }))}
                  className={`flex-1 rounded-2xl py-3 text-[15px] font-bold transition ${
                    body.sex === id ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
              <NumRow
                label="Alter"
                unit="Jahre"
                value={body.age}
                min={14}
                max={99}
                onChange={(v) => setBody((b) => ({ ...b, age: v }))}
              />
              <NumRow
                label="Größe"
                unit="cm"
                value={body.height}
                min={120}
                max={230}
                onChange={(v) => setBody((b) => ({ ...b, height: v }))}
              />
              <NumRow
                label="Gewicht"
                unit="kg"
                value={body.weight}
                min={35}
                max={250}
                onChange={(v) => setBody((b) => ({ ...b, weight: v }))}
              />
            </div>
          </>
        )}

        {step === 'plan' && (
          <>
            <Ask mood="proud">Dein Plan ist fertig!</Ask>
            <Hero overline="Dein Training" index={0}>
              <p className="mt-1 text-2xl font-bold">{template.title}</p>
              <p className="text-sm text-bg/70 dark:text-cocoa-light">
                {a.gymDays.length}× Kraft à {a.minutes} Min{cardio ? ` · ${cardio.sessions.length}× Ausdauer` : ''} pro
                Woche
              </p>
            </Hero>
            <WeekView week={week} cardio={cardio?.sessions ?? []} />
            {err && <p className="text-center text-sm text-red-500">{err}</p>}
          </>
        )}
      </div>

      {step === 'plan' ? (
        <button
          className="btn-primary w-full rounded-2xl py-4 text-base"
          onClick={finish}
          disabled={!!busy || !list || !mine || !plans || a.gymDays.length === 0}
        >
          {busy ?? (list ? 'Plan übernehmen' : 'Lädt …')}
        </button>
      ) : (
        <button
          className="btn-primary w-full rounded-2xl py-4 text-base"
          onClick={next}
          disabled={step === 'days' && a.gymDays.length === 0}
        >
          {step === 'hello' ? 'Los geht’s' : 'Weiter'}
        </button>
      )}
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      className="anim-fade fixed inset-0 z-[90] flex flex-col bg-bg text-cocoa"
      role="dialog"
      aria-label="Einrichtung"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+16px)]">
        {children}
      </div>
    </div>
  )
}

/** Hinweis bei Beschwerden – kein medizinischer Plan. */
function LimitsHint({ note }: { note?: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-gold/15 p-4 text-left">
      <Info size={18} className="mt-0.5 shrink-0 text-gold" />
      <div className="space-y-1 text-sm text-cocoa">
        <p className="font-semibold">{LIMITS_HINT}</p>
        {note?.trim() && <p className="text-cocoa-light">Deine Angabe: {note.trim()}</p>}
      </div>
    </div>
  )
}

/** Mehrfachauswahl als große Karte. */
function CheckCard({ icon, label, on, onClick }: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99] ${
        on ? 'bg-brand/10 ring-2 ring-brand' : 'bg-cream'
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">{icon}</span>
      <span className="min-w-0 flex-1 text-[16px] font-semibold">{label}</span>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
          on ? 'bg-brand text-on-brand' : 'border-2 border-sand-dark'
        }`}
      >
        {on && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

/** Buddy stellt die Frage. */
function Ask({ children, mood }: { children: ReactNode; mood: BuddyMood }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0">
        <MyBuddy size={64} mood={mood} />
      </span>
      <h2 className="text-2xl font-extrabold leading-tight">{children}</h2>
    </div>
  )
}

function Options<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { id: T; label: string; sub?: string; icon: ReactNode }[]
}) {
  return (
    <div className="space-y-2" role="radiogroup">
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(it.id)}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99] ${
              on ? 'bg-brand/10 ring-2 ring-brand' : 'bg-cream'
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
              {it.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{it.label}</span>
              {it.sub && <span className="block text-sm text-cocoa-light">{it.sub}</span>}
            </span>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                on ? 'bg-brand text-on-brand' : 'border-2 border-sand-dark'
              }`}
            >
              {on && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function DayPicker({
  value,
  onChange,
  label,
}: {
  value: number[]
  onChange: (d: number[]) => void
  label: (d: number) => string
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map((w, d) => {
        const on = value.includes(d)
        return (
          <button
            key={w}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((x, y) => x - y))}
            className={`flex aspect-[3/4] flex-col items-center justify-center rounded-2xl text-sm font-bold transition ${
              on ? 'bg-brand text-on-brand' : 'bg-cream text-cocoa'
            }`}
          >
            {w}
            {on && <Dumbbell size={14} className="mt-1 opacity-80" aria-label={label(d)} />}
          </button>
        )
      })}
    </div>
  )
}

function ToggleCard({
  icon,
  label,
  sub,
  on,
  onChange,
}: {
  icon: ReactNode
  label: string
  sub: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
        on ? 'bg-brand/10 ring-2 ring-brand' : 'bg-cream'
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="block text-sm text-cocoa-light">{sub}</span>
      </span>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          on ? 'bg-brand text-on-brand' : 'border-2 border-sand-dark'
        }`}
      >
        {on && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

function NumRow({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  return (
    <label className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1 text-[16px] font-semibold">{label}</span>
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))
          const n = Number(e.target.value)
          if (n >= min && n <= max) onChange(n)
        }}
        onBlur={() => setText(String(value))}
        className="w-16 rounded-xl bg-sand px-2 py-1.5 text-right text-[16px] font-bold outline-none focus:ring-2 focus:ring-brand"
        aria-label={label}
      />
      <span className="w-12 text-sm text-cocoa-light">{unit}</span>
    </label>
  )
}

/** Die Woche auf einen Blick; Ausdauer-Erklärung nur auf Tippen. */
function WeekView({ week, cardio }: { week: (string | null)[]; cardio: CardioSession[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
      {WEEKDAYS.map((w, d) => {
        const gym = week[d]
        const c = cardio.find((s) => s.day === d)
        return (
          <div key={w} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-7 text-sm font-bold text-cocoa-muted">{w}</span>
              <span className="min-w-0 flex-1 space-y-0.5">
                {gym && (
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                    <Dumbbell size={14} className="shrink-0 text-brand" /> {gym}
                  </span>
                )}
                {c && (
                  <button
                    className="flex items-center gap-1.5 text-left text-[15px] font-semibold"
                    onClick={() => setOpen(open === d ? null : d)}
                  >
                    <HeartPulse size={14} className="shrink-0 text-brand" /> {cardioTitle(c)}
                    <Info size={13} className="shrink-0 text-cocoa-muted" />
                  </button>
                )}
                {!gym && !c && <span className="text-[15px] text-cocoa-muted">Ruhetag</span>}
              </span>
            </div>
            {c && open === d && <p className="anim-fade mt-1.5 pl-10 text-sm text-cocoa-light">{cardioHowTo(c)}</p>}
          </div>
        )
      })}
    </div>
  )
}
