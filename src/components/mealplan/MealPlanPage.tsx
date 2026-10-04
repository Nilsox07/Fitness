import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Ellipsis,
  FolderOpen,
  LoaderCircle,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useAddFoodEntries, useAddFoodEntry, useNutritionSettings } from '../../hooks/useNutrition'
import {
  useAddMealPlan,
  useAddMealRoutine,
  useDeleteMealPlan,
  useDeleteMealRoutine,
  useMealPlans,
  useMealRoutines,
  useUpdateMealPlan,
} from '../../hooks/useMealPlan'
import { useAddRecipe } from '../../hooks/useRecipes'
import {
  adjustWeeklyPlan,
  estimateFoodFromText,
  generateWeeklyPlan,
  recipeFromText,
  type Recipe,
  type WeeklyPlan,
} from '../../lib/ai'
import { localDate } from '../../lib/day'
import { fmtInt } from '../../lib/nutritionHome'
import { MEAL_LABEL, type Meal, type PlanMeal, type SavedMealPlan } from '../../types'
import { stagger } from '../nutrition-home/motion'
import { DayStrip } from './DayStrip'
import { PlanHero } from './PlanHero'
import { PlanMealCard } from './PlanMealCard'
import { AdjustSheet, MealEditSheet, PlanMenuSheet, RecipeSheet, SavedPlansSheet } from './PlanSheets'
import { RoutinesCard } from './RoutinesCard'
import { ShoppingListView } from './ShoppingListView'
import {
  checkKeys,
  dayTotals,
  initialDay,
  loadChecked,
  loadTab,
  planAverages,
  saveChecked,
  saveTab,
  shoppingText,
  type PlanTab,
} from './planUtils'

const HIDE_DONE_KEY = 'shopping_hide_done'

function loadHideDone(): boolean {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) === '1'
  } catch {
    return false
  }
}

const errText = (e: unknown, fallback = 'KI-Fehler') => (e instanceof Error ? e.message : fallback)

/** Ernährungsplan im neuen Design: Segment „Plan | Einkaufsliste", ein Tag zur Zeit. */
export function MealPlanPage() {
  const { data: settings } = useNutritionSettings()
  const { data: routines } = useMealRoutines()
  const { data: savedPlans } = useMealPlans()
  const addRoutine = useAddMealRoutine()
  const delRoutine = useDeleteMealRoutine()
  const addPlan = useAddMealPlan()
  const updatePlan = useUpdateMealPlan()
  const delPlan = useDeleteMealPlan()
  const addRecipe = useAddRecipe()
  const addEntry = useAddFoodEntry()
  const addEntries = useAddFoodEntries()

  const [tab, setTabState] = useState<PlanTab>(loadTab)
  const setTab = (t: PlanTab) => {
    setTabState(t)
    saveTab(t)
  }

  // Plan erstellen
  const [days, setDays] = useState(7)
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // aktueller Plan
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [selDay, setSelDay] = useState(0)

  // Abhak-Liste des angezeigten Plans
  const [planKey, setPlanKey] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [hideDone, setHideDoneState] = useState(loadHideDone)

  // Sheets
  const [menuOpen, setMenuOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [adjustInit, setAdjustInit] = useState<string | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [adjustErr, setAdjustErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ d: number; j: number } | null>(null)

  // Rezept
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeKey, setRecipeKey] = useState<string | null>(null)
  const [recipeErr, setRecipeErr] = useState<string | null>(null)

  // heute ins Tagebuch eingetragen (nur Rückmeldung in dieser Sitzung)
  const [logged, setLogged] = useState<Set<string>>(new Set())
  const [logging, setLogging] = useState<string | null>(null)

  const targets = {
    kcal: settings?.kcal_target || 2000,
    protein: settings?.protein_target || 130,
  }

  // Erfolgsmeldungen blenden sich selbst aus
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3000)
    return () => clearTimeout(t)
  }, [msg])

  const flash = (m: string) => {
    setErr(null)
    setMsg(m)
  }

  // ---- Routinen ----
  async function addRoutineItem(meal: Meal, text: string) {
    const items = await estimateFoodFromText(text)
    const sum = items.reduce(
      (a, i) => ({
        kcal: a.kcal + i.kcal,
        protein: a.protein + i.protein,
        carbs: a.carbs + i.carbs,
        fat: a.fat + i.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
    await addRoutine.mutateAsync({
      meal,
      title: text,
      kcal: Math.round(sum.kcal),
      protein: Math.round(sum.protein),
      carbs: Math.round(sum.carbs),
      fat: Math.round(sum.fat),
    })
  }

  // ---- Plan anzeigen / erzeugen ----
  /** Plan anzeigen: Abhak-Liste dieses Plans laden (neuer Plan → leer). */
  function showPlan(key: string) {
    setPlanKey(key)
    setChecked(loadChecked(key))
  }

  async function generate() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await generateWeeklyPlan({
        days,
        targets,
        routines: (routines ?? []).map((r) => ({
          meal: r.meal,
          title: r.title,
          kcal: r.kcal,
          protein: r.protein,
        })),
        wish,
      })
      if (res.days.length === 0) setErr('Kein Plan erzeugt. Versuch es nochmal.')
      else {
        setPlan(res)
        setCurrentPlanId(null) // neuer, ungespeicherter Plan
        showPlan(`gen-${Date.now()}`) // neue Einkaufsliste → nichts abgehakt
        setSelDay(initialDay(res.days))
        setDirty(true)
        setCreating(false)
        setLogged(new Set())
      }
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  async function adjust(instruction: string) {
    if (!plan) return
    setAdjustBusy(true)
    setAdjustErr(null)
    try {
      const res = await adjustWeeklyPlan({ current: plan, instruction, targets })
      if (res.days.length) {
        setPlan(res)
        setSelDay((s) => Math.min(s, res.days.length - 1))
        setDirty(true)
        setAdjustInit(null)
        flash('Plan angepasst')
      } else setAdjustErr('Keine Änderung erhalten. Versuch es nochmal.')
    } catch (e) {
      setAdjustErr(errText(e))
    } finally {
      setAdjustBusy(false)
    }
  }

  const saving = addPlan.isPending || updatePlan.isPending

  async function save() {
    if (!plan || saving) return
    setErr(null)
    setMsg(null)
    try {
      if (currentPlanId) {
        await updatePlan.mutateAsync({ id: currentPlanId, days, plan: plan.days, shopping: plan.shopping })
        flash('Plan aktualisiert')
      } else {
        const name = `Plan ${new Date().toLocaleDateString('de-DE')}`
        const saved = await addPlan.mutateAsync({ name, days, plan: plan.days, shopping: plan.shopping })
        setCurrentPlanId(saved.id)
        // Häkchen des gerade erzeugten Plans unter seiner neuen ID weiterführen
        setPlanKey(saved.id)
        saveChecked(saved.id, checked)
        flash('Plan & Einkaufsliste gespeichert')
      }
      setDirty(false)
      setMenuOpen(false)
    } catch (e) {
      setMenuOpen(false)
      setErr(
        errText(e, 'Speichern fehlgeschlagen') + ' — sind die Datenbank-Updates (Migration 0026) in Supabase ausgeführt?',
      )
    }
  }

  function loadPlan(p: SavedMealPlan) {
    setPlan({ note: '', days: p.plan, shopping: p.shopping })
    setCurrentPlanId(p.id)
    showPlan(p.id)
    setDays(p.days)
    setSelDay(initialDay(p.plan))
    setDirty(false)
    setCreating(false)
    setLogged(new Set())
    setSavedOpen(false)
    flash(`„${p.name}" geladen`)
  }

  function deletePlan(p: SavedMealPlan) {
    if (!confirm(`„${p.name}" löschen?`)) return
    delPlan.mutate(p.id)
    // angezeigter Plan bleibt erhalten, gilt aber wieder als ungespeichert
    if (p.id === currentPlanId) {
      setCurrentPlanId(null)
      setDirty(true)
    }
  }

  // ---- Von Hand bearbeiten ----
  function editDays(mut: (d: WeeklyPlan['days']) => WeeklyPlan['days']) {
    setPlan((p) => (p ? { ...p, days: mut(p.days) } : p))
    setDirty(true)
    setMsg(null)
  }
  function removeMeal(dayIdx: number, mealIdx: number) {
    editDays((ds) => ds.map((d, i) => (i === dayIdx ? { ...d, meals: d.meals.filter((_, j) => j !== mealIdx) } : d)))
  }
  function updateMeal(dayIdx: number, mealIdx: number, m: PlanMeal) {
    editDays((ds) =>
      ds.map((d, i) => (i === dayIdx ? { ...d, meals: d.meals.map((x, j) => (j === mealIdx ? m : x)) } : d)),
    )
  }

  function editShopping(mut: (s: WeeklyPlan['shopping']) => WeeklyPlan['shopping']) {
    setPlan((p) => (p ? { ...p, shopping: mut(p.shopping) } : p))
    setDirty(true)
    setMsg(null)
  }
  function removeItem(catIdx: number, itemIdx: number) {
    editShopping((s) =>
      s
        .map((c, i) => (i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== itemIdx) } : c))
        .filter((c) => c.items.length),
    )
  }
  function addItem(catIdx: number, category: string, text: string) {
    editShopping((s) =>
      catIdx < 0
        ? [...s, { category, items: [text] }]
        : s.map((c, i) => (i === catIdx ? { ...c, items: [...c.items, text] } : c)),
    )
  }

  function toggle(key: string) {
    if (!planKey) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveChecked(planKey, next)
      return next
    })
  }

  function setHideDone(v: boolean) {
    setHideDoneState(v)
    try {
      localStorage.setItem(HIDE_DONE_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (!plan) return
    const text = shoppingText(plan.shopping, checked)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Einkaufsliste', text })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // sonst: auf Kopieren zurückfallen
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      flash('Einkaufsliste kopiert')
    } catch {
      setErr('Teilen nicht möglich — bitte manuell kopieren.')
    }
  }

  // ---- Rezept ----
  async function makeRecipe(m: PlanMeal, key: string) {
    setRecipeKey(key)
    setErr(null)
    try {
      setRecipeErr(null)
      setRecipe(await recipeFromText(`${m.name} — ca. ${m.kcal} kcal, ${m.protein} g Eiweiß, für 1 Portion`))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setRecipeKey(null)
    }
  }

  async function saveRecipe() {
    if (!recipe || addRecipe.isPending) return
    const n = recipe.nutrition
    setRecipeErr(null)
    try {
      await addRecipe.mutateAsync({
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        kcal: n.kcal,
        protein: n.protein,
        carbs: n.carbs,
        fat: n.fat,
        fiber: n.fiber,
        sugar: n.sugar,
        sat_fat: n.sat_fat,
        salt: n.salt,
        shared: false,
      })
      setRecipe(null)
      flash('Rezept gespeichert')
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
      setRecipeErr(`Speichern fehlgeschlagen${detail}. Bitte nochmal versuchen.`)
    }
  }

  // ---- Ins Tagebuch (heute) ----
  const entryOf = (m: PlanMeal) => ({
    date: localDate(),
    name: m.name,
    amount_g: null,
    kcal: Math.max(0, Math.round(m.kcal)),
    protein: Math.max(0, Math.round(m.protein)),
    carbs: Math.max(0, Math.round(m.carbs)),
    fat: Math.max(0, Math.round(m.fat)),
    fiber: 0,
    sugar: 0,
    sat_fat: 0,
    salt: 0,
    barcode: null,
    meal: m.meal,
  })
  const mealKey = (d: number, j: number) => `${planKey}:${d}:${j}`

  async function logMeal(d: number, j: number, m: PlanMeal) {
    const key = mealKey(d, j)
    setLogging(key)
    setErr(null)
    try {
      await addEntry.mutateAsync(entryOf(m))
      setLogged((s) => new Set(s).add(key))
      flash(`„${m.name}" heute eingetragen`)
    } catch (e) {
      setErr(errText(e, 'Eintragen fehlgeschlagen'))
    } finally {
      setLogging(null)
    }
  }

  async function logDay(d: number) {
    const day = plan?.days[d]
    if (!day || day.meals.length === 0 || addEntries.isPending) return
    setErr(null)
    try {
      await addEntries.mutateAsync(day.meals.map(entryOf))
      setLogged((s) => {
        const next = new Set(s)
        day.meals.forEach((_, j) => next.add(mealKey(d, j)))
        return next
      })
      flash(`${day.meals.length} Mahlzeiten heute eingetragen`)
    } catch (e) {
      setErr(errText(e, 'Eintragen fehlgeschlagen'))
    }
  }

  // ---- Ableitungen ----
  const avg = plan ? planAverages(plan.days) : null
  const openItems = plan
    ? plan.shopping.flatMap(checkKeys).filter((k) => !checked.has(k)).length
    : 0
  const day = plan?.days[selDay]
  const dayKcal = day ? dayTotals(day).kcal : 0
  const savedCount = savedPlans?.length ?? 0
  const showCreate = !plan || creating
  const edit = editing && plan ? plan.days[editing.d]?.meals[editing.j] : undefined

  const segBase =
    'flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200'
  const segOn = 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark'

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3" style={stagger(0)}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Ernährungsplan</h1>
          <p className="tabular truncate text-sm text-cocoa-light">
            {plan && avg
              ? `${plan.days.length} Tage · Ø ${fmtInt(avg.kcal)} kcal · ${fmtInt(avg.protein)} g E`
              : 'Planen, kochen, einkaufen'}
          </p>
        </div>
        {plan ? (
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
            onClick={() => setMenuOpen(true)}
            aria-label="Plan-Menü"
          >
            <Ellipsis size={20} />
          </button>
        ) : (
          savedCount > 0 && (
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
              onClick={() => setSavedOpen(true)}
              aria-label="Gespeicherte Pläne"
            >
              <FolderOpen size={19} />
            </button>
          )
        )}
      </header>

      <div className="flex gap-1 rounded-full bg-sand p-1" role="tablist" style={stagger(1)}>
        <button
          role="tab"
          aria-selected={tab === 'plan'}
          className={`${segBase} ${tab === 'plan' ? segOn : 'text-cocoa-light'}`}
          onClick={() => setTab('plan')}
        >
          <CalendarDays size={16} className={tab === 'plan' ? 'text-brand' : ''} />
          Plan
        </button>
        <button
          role="tab"
          aria-selected={tab === 'shopping'}
          className={`${segBase} ${tab === 'shopping' ? segOn : 'text-cocoa-light'}`}
          onClick={() => setTab('shopping')}
        >
          <ShoppingBasket size={16} className={tab === 'shopping' ? 'text-brand' : ''} />
          Einkaufsliste
          {openItems > 0 && (
            <span className="tabular rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-on-brand">
              {openItems}
            </span>
          )}
        </button>
      </div>

      {plan && dirty && !showCreate && (
        <div className="anim-fade flex items-center justify-between gap-2 rounded-full bg-sand px-3 py-1.5 text-xs text-cocoa-light">
          <span className="truncate">{currentPlanId ? 'Ungespeicherte Änderungen' : 'Plan noch nicht gespeichert'}</span>
          <button className="shrink-0 font-semibold text-brand disabled:opacity-50" onClick={save} disabled={saving}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      )}

      {err && (
        <p className="anim-fade flex items-start gap-1.5 text-sm text-red-500 dark:text-red-400">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {err}
        </p>
      )}
      {msg && (
        <p className="anim-fade flex items-center gap-1.5 text-sm text-success">
          <CircleCheck size={16} className="shrink-0" /> {msg}
        </p>
      )}

      {tab === 'plan' ? (
        showCreate ? (
          <div key="create" className="space-y-3">
            <PlanHero
              days={days}
              onDays={setDays}
              wish={wish}
              onWish={setWish}
              targets={targets}
              routineCount={routines?.length ?? 0}
              busy={busy}
              hasPlan={!!plan}
              onGenerate={generate}
              onCancel={plan ? () => setCreating(false) : undefined}
              style={stagger(2)}
            />
            <RoutinesCard
              routines={routines ?? []}
              onAdd={addRoutineItem}
              onDelete={(id) => delRoutine.mutate(id)}
              style={stagger(3)}
            />
            {!plan && savedCount > 0 && (
              <button className="btn-ghost w-full gap-2 text-sm" onClick={() => setSavedOpen(true)} style={stagger(4)}>
                <FolderOpen size={16} />
                Gespeicherten Plan laden
                <span className="tabular text-cocoa-muted">({savedCount})</span>
              </button>
            )}
          </div>
        ) : (
          <div key="plan" className="space-y-3">
            {plan.note && (
              <p className="flex gap-2 rounded-2xl bg-sand-light px-3 py-2.5 text-sm text-cocoa-light ring-1 ring-sand-dark/60" style={stagger(2)}>
                <Sparkles size={15} className="mt-0.5 shrink-0 text-brand" />
                <span>{plan.note}</span>
              </p>
            )}
            <DayStrip
              days={plan.days}
              selected={selDay}
              onSelect={setSelDay}
              kcalTarget={targets.kcal}
              style={stagger(2)}
            />

            {day && (
              <div key={selDay} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{day.label}</h2>
                  <span className="tabular shrink-0 text-xs text-cocoa-light">
                    <span className={`font-semibold ${dayKcal > targets.kcal * 1.1 ? 'text-gold' : 'text-cocoa'}`}>
                      {fmtInt(dayKcal)}
                    </span>
                    {` / ${fmtInt(targets.kcal)} kcal · E ${fmtInt(dayTotals(day).protein)} g`}
                  </span>
                </div>

                {day.meals.length === 0 && (
                  <p className="card text-center text-sm text-cocoa-light">Keine Mahlzeiten an diesem Tag.</p>
                )}

                {day.meals.map((m, j) => {
                  const key = mealKey(selDay, j)
                  return (
                    <PlanMealCard
                      key={`${key}:${m.name}`}
                      meal={m}
                      logged={logged.has(key)}
                      logging={logging === key}
                      recipeLoading={recipeKey === key}
                      recipeDisabled={recipeKey !== null}
                      onLog={() => logMeal(selDay, j, m)}
                      onRecipe={() => makeRecipe(m, key)}
                      onEdit={() => setEditing({ d: selDay, j })}
                      onAdjust={() => {
                        setAdjustErr(null)
                        setAdjustInit(`${day.label}, ${MEAL_LABEL[m.meal]} („${m.name}"): `)
                      }}
                      style={stagger(j + 3, 50)}
                    />
                  )
                })}

                {day.meals.length > 0 && (
                  <button
                    className="btn-ghost w-full gap-2 text-sm"
                    onClick={() => logDay(selDay)}
                    disabled={addEntries.isPending}
                    style={stagger(day.meals.length + 3, 50)}
                  >
                    {addEntries.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
                    Ganzen Tag heute eintragen
                  </button>
                )}
              </div>
            )}
          </div>
        )
      ) : plan ? (
        <div key="shopping">
          <ShoppingListView
            shopping={plan.shopping}
            checked={checked}
            hideDone={hideDone}
            onHideDone={setHideDone}
            onToggle={toggle}
            onRemove={removeItem}
            onAdd={addItem}
            onShare={share}
          />
        </div>
      ) : (
        <section key="shopping-empty" className="card flex flex-col items-center gap-3 py-8 text-center" style={stagger(2)}>
          <div className="grid h-14 w-14 place-items-center rounded-full bg-sand text-brand">
            <ShoppingBasket size={26} />
          </div>
          <div>
            <h2 className="font-semibold">Noch keine Einkaufsliste</h2>
            <p className="mt-1 text-sm text-cocoa-light">
              Erstell einen Plan — die Einkaufsliste dazu entsteht automatisch.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-primary gap-1.5" onClick={() => setTab('plan')}>
              <Sparkles size={16} />
              Plan erstellen
            </button>
            {savedCount > 0 && (
              <button className="btn-ghost gap-1.5" onClick={() => setSavedOpen(true)}>
                <FolderOpen size={16} />
                Plan laden
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---- Sheets ---- */}
      {menuOpen && plan && (
        <PlanMenuSheet
          saved={!!currentPlanId && !dirty}
          saving={saving}
          savedCount={savedCount}
          onSave={save}
          onLoad={() => {
            setMenuOpen(false)
            setSavedOpen(true)
          }}
          onAdjust={() => {
            setMenuOpen(false)
            setAdjustErr(null)
            setAdjustInit('')
          }}
          onNew={() => {
            setMenuOpen(false)
            setTab('plan')
            setCreating(true)
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {savedOpen && (
        <SavedPlansSheet
          plans={savedPlans ?? []}
          currentId={currentPlanId}
          onLoad={loadPlan}
          onDelete={deletePlan}
          onClose={() => setSavedOpen(false)}
        />
      )}

      {adjustInit !== null && (
        <AdjustSheet
          initial={adjustInit}
          busy={adjustBusy}
          error={adjustErr}
          onSubmit={adjust}
          onClose={() => !adjustBusy && setAdjustInit(null)}
        />
      )}

      {editing && edit && plan && (
        <MealEditSheet
          meal={edit}
          dayLabel={plan.days[editing.d].label}
          onSave={(m) => {
            updateMeal(editing.d, editing.j, m)
            setEditing(null)
          }}
          onRemove={() => {
            removeMeal(editing.d, editing.j)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {recipe && (
        <RecipeSheet
          recipe={recipe}
          saving={addRecipe.isPending}
          error={recipeErr}
          onSave={saveRecipe}
          onClose={() => {
            setRecipeErr(null)
            setRecipe(null)
          }}
        />
      )}
    </div>
  )
}
