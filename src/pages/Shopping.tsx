import { useState } from 'react'
import { useNutritionSettings } from '../hooks/useNutrition'
import {
  adjustWeeklyPlan,
  estimateFoodFromText,
  generateWeeklyPlan,
  recipeFromText,
  type Recipe,
  type WeeklyPlan,
} from '../lib/ai'
import {
  useAddMealPlan,
  useAddMealRoutine,
  useDeleteMealPlan,
  useDeleteMealRoutine,
  useMealPlans,
  useMealRoutines,
  useUpdateMealPlan,
} from '../hooks/useMealPlan'
import { useAddRecipe } from '../hooks/useRecipes'
import { MicButton } from '../components/MicButton'
import { MEALS, MEAL_LABEL, type Meal, type PlanMeal } from '../types'

function loadChecked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('shopping_checked') || '[]'))
  } catch {
    return new Set()
  }
}
function saveChecked(s: Set<string>) {
  try {
    localStorage.setItem('shopping_checked', JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

export default function Shopping() {
  const { data: settings } = useNutritionSettings()
  const { data: routines } = useMealRoutines()
  const { data: savedPlans } = useMealPlans()
  const addRoutine = useAddMealRoutine()
  const delRoutine = useDeleteMealRoutine()
  const addPlan = useAddMealPlan()
  const updatePlan = useUpdateMealPlan()
  const delPlan = useDeleteMealPlan()
  const addRecipe = useAddRecipe()

  const [days, setDays] = useState(7)
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(loadChecked)

  // Anpassen
  const [adjustText, setAdjustText] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [newItem, setNewItem] = useState<Record<number, string>>({})

  // Routine hinzufügen
  const [rMeal, setRMeal] = useState<Meal>('breakfast')
  const [rText, setRText] = useState('')
  const [rBusy, setRBusy] = useState(false)

  // Rezept-Modal
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeBusy, setRecipeBusy] = useState(false)

  const targets = {
    kcal: settings?.kcal_target || 2000,
    protein: settings?.protein_target || 130,
  }

  async function addRoutineItem() {
    const text = rText.trim()
    if (!text || rBusy) return
    setRBusy(true)
    setErr(null)
    try {
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
        meal: rMeal,
        title: text,
        kcal: Math.round(sum.kcal),
        protein: Math.round(sum.protein),
        carbs: Math.round(sum.carbs),
        fat: Math.round(sum.fat),
      })
      setRText('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setRBusy(false)
    }
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
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setBusy(false)
    }
  }

  async function adjust() {
    if (!plan || !adjustText.trim()) return
    setAdjustBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await adjustWeeklyPlan({ current: plan, instruction: adjustText.trim(), targets })
      if (res.days.length) {
        setPlan(res)
        setAdjustText('')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAdjustBusy(false)
    }
  }

  async function save() {
    if (!plan) return
    setErr(null)
    setMsg(null)
    try {
      if (currentPlanId) {
        await updatePlan.mutateAsync({ id: currentPlanId, days, plan: plan.days, shopping: plan.shopping })
        setMsg('Plan aktualisiert ✅')
      } else {
        const name = `Plan ${new Date().toLocaleDateString('de-DE')}`
        const saved = await addPlan.mutateAsync({ name, days, plan: plan.days, shopping: plan.shopping })
        setCurrentPlanId(saved.id)
        setMsg('Plan & Einkaufsliste gespeichert ✅')
      }
    } catch (e) {
      setErr(
        (e instanceof Error ? e.message : 'Speichern fehlgeschlagen') +
          ' — sind die Datenbank-Updates (Migration 0026) in Supabase ausgeführt?',
      )
    }
  }

  // ---- Einkaufsliste von Hand bearbeiten ----
  function editShopping(mut: (s: WeeklyPlan['shopping']) => WeeklyPlan['shopping']) {
    setPlan((p) => (p ? { ...p, shopping: mut(p.shopping) } : p))
    setMsg(null)
  }
  function removeItem(catIdx: number, item: string) {
    editShopping((s) =>
      s
        .map((c, i) => (i === catIdx ? { ...c, items: c.items.filter((x) => x !== item) } : c))
        .filter((c) => c.items.length),
    )
  }
  function addItem(catIdx: number) {
    const text = (newItem[catIdx] ?? '').trim()
    if (!text) return
    editShopping((s) => s.map((c, i) => (i === catIdx ? { ...c, items: [...c.items, text] } : c)))
    setNewItem((n) => ({ ...n, [catIdx]: '' }))
  }
  function removeMeal(dayIdx: number, mealIdx: number) {
    setPlan((p) =>
      p
        ? {
            ...p,
            days: p.days.map((d, i) =>
              i === dayIdx ? { ...d, meals: d.meals.filter((_, j) => j !== mealIdx) } : d,
            ),
          }
        : p,
    )
    setMsg(null)
  }

  async function makeRecipe(m: PlanMeal) {
    setRecipeBusy(true)
    setErr(null)
    try {
      setRecipe(
        await recipeFromText(`${m.name} — ca. ${m.kcal} kcal, ${m.protein} g Eiweiß, für 1 Portion`),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setRecipeBusy(false)
    }
  }

  async function saveRecipe() {
    if (!recipe) return
    const n = recipe.nutrition
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
  }

  function toggle(item: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      saveChecked(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Ernährungsplan</h1>
        <p className="text-sm text-cocoa-light">Routinen, Plan, Rezepte & Einkaufsliste — gespeichert.</p>
      </header>

      {err && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {err}</p>}
      {msg && <p className="text-sm text-brand">{msg}</p>}

      {/* 1) Routinen */}
      <div className="card space-y-2">
        <h2 className="font-semibold">Feste Routinen</h2>
        <p className="text-xs text-cocoa-light">
          Wird jeden Tag im Plan berücksichtigt — z. B. „Proteinshake 30 g Whey + Banane".
        </p>
        {(routines ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-sand-light px-3 py-1.5 ring-1 ring-sand-dark">
            <div className="text-sm">
              <span className="font-medium">{MEAL_LABEL[r.meal]}:</span> {r.title}
              <span className="text-cocoa-muted"> · {r.kcal} kcal / {r.protein} g E</span>
            </div>
            <button
              className="px-2 text-cocoa-muted hover:text-red-500"
              aria-label="Routine löschen"
              onClick={() => delRoutine.mutate(r.id)}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <select
            className="input max-w-[8rem]"
            value={rMeal}
            onChange={(e) => setRMeal(e.target.value as Meal)}
          >
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="z. B. Proteinshake mit Banane"
            value={rText}
            onChange={(e) => setRText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoutineItem()}
          />
          <MicButton onResult={(t) => setRText((v) => (v ? v + ' ' + t : t))} />
        </div>
        <button className="btn-ghost w-full text-sm" onClick={addRoutineItem} disabled={rBusy}>
          {rBusy ? 'Analysiere…' : '+ Routine hinzufügen'}
        </button>
      </div>

      {/* 2) Plan erstellen */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Plan erstellen</h2>
        <div className="flex gap-2">
          {[3, 7, 14].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`btn flex-1 text-sm ${
                days === d ? 'bg-ruby text-white' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
              }`}
            >
              {d} Tage
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Wünsche: z. B. proteinreich, wenig Zucker, vegetarisch"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
          />
          <MicButton onResult={(t) => setWish((v) => (v ? v + ' ' + t : t))} />
        </div>
        <p className="text-xs text-cocoa-light">
          Ziel: ~{targets.kcal} kcal · {targets.protein} g Eiweiß/Tag
          {(routines?.length ?? 0) > 0 && ` · ${routines!.length} Routine(n)`}
        </p>
        <button className="btn-primary w-full" onClick={generate} disabled={busy}>
          {busy ? 'Erstelle Plan…' : plan ? 'Neu erstellen' : 'Plan erstellen'}
        </button>
      </div>

      {/* 3) Ergebnis: Plan + Einkaufsliste */}
      {plan && (
        <>
          {plan.note && <p className="px-1 text-sm text-cocoa-light">{plan.note}</p>}

          <button
            className="btn-primary w-full"
            onClick={save}
            disabled={addPlan.isPending || updatePlan.isPending}
          >
            {addPlan.isPending || updatePlan.isPending
              ? 'Speichert…'
              : currentPlanId
                ? '💾 Änderungen speichern'
                : '💾 Plan & Einkaufsliste speichern'}
          </button>

          {/* Per KI anpassen */}
          <div className="card space-y-2">
            <label className="label">Anpassen per KI</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. günstiger, mehr Eiweiß, Tag 2 vegetarisch, ohne Milch"
                value={adjustText}
                onChange={(e) => setAdjustText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adjust()}
              />
              <MicButton onResult={(t) => setAdjustText((v) => (v ? v + ' ' + t : t))} />
            </div>
            <button className="btn-ghost w-full text-sm" onClick={adjust} disabled={adjustBusy}>
              {adjustBusy ? 'Passe an…' : '✨ Plan anpassen'}
            </button>
          </div>

          {plan.days.map((d, i) => (
            <div key={i} className="card space-y-2">
              <h3 className="font-semibold">{d.label}</h3>
              {d.meals.map((m, j) => (
                <div key={j} className="flex items-center justify-between gap-2 border-t border-sand-dark/50 pt-2 first:border-0 first:pt-0">
                  <div className="text-sm">
                    <span className="text-cocoa-muted">{MEAL_LABEL[m.meal]}: </span>
                    <span className="font-medium">{m.name}</span>
                    {m.routine && <span className="ml-1 text-[10px] text-brand">● Routine</span>}
                    <div className="text-xs text-cocoa-light">
                      {m.kcal} kcal · E {m.protein} / K {m.carbs} / F {m.fat}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="text-xs font-semibold text-brand disabled:opacity-40"
                      onClick={() => makeRecipe(m)}
                      disabled={recipeBusy}
                    >
                      🍳 Rezept
                    </button>
                    <button
                      className="px-1 text-cocoa-muted hover:text-red-500"
                      aria-label="Mahlzeit entfernen"
                      onClick={() => removeMeal(i, j)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="space-y-2">
            <h2 className="px-1 font-semibold">🛒 Einkaufsliste</h2>
            {plan.shopping.length === 0 && (
              <p className="px-1 text-sm text-cocoa-light">
                Noch keine Artikel — füge unten welche hinzu oder erstelle den Plan neu.
              </p>
            )}
            {plan.shopping.map((c, ci) => (
              <div key={c.category} className="card">
                <h3 className="mb-2 font-semibold">{c.category}</h3>
                <ul className="space-y-1">
                  {c.items.map((it) => {
                    const done = checked.has(it)
                    return (
                      <li key={it} className="flex items-center gap-2">
                        <button className="flex flex-1 items-center gap-2 text-left text-sm" onClick={() => toggle(it)}>
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] ${
                              done ? 'bg-brand text-white' : 'text-transparent ring-1 ring-sand-dark'
                            }`}
                          >
                            ✓
                          </span>
                          <span className={done ? 'text-cocoa-muted line-through' : 'text-cocoa'}>{it}</span>
                        </button>
                        <button
                          className="px-1 text-cocoa-muted hover:text-red-500"
                          aria-label="Artikel entfernen"
                          onClick={() => removeItem(ci, it)}
                        >
                          ✕
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input
                    className="input text-sm"
                    placeholder="Artikel hinzufügen…"
                    value={newItem[ci] ?? ''}
                    onChange={(e) => setNewItem((n) => ({ ...n, [ci]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(ci)}
                  />
                  <button className="btn-ghost shrink-0 text-sm" onClick={() => addItem(ci)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4) Gespeicherte Pläne */}
      {(savedPlans?.length ?? 0) > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold">Gespeicherte Pläne</h2>
          {savedPlans!.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-sand-light px-3 py-2 ring-1 ring-sand-dark">
              <button
                className="text-left text-sm"
                onClick={() => {
                  setPlan({ note: '', days: p.plan, shopping: p.shopping })
                  setCurrentPlanId(p.id)
                  setDays(p.days)
                  setMsg(`„${p.name}" geladen`)
                }}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-cocoa-light">
                  {p.days} Tage · {p.shopping.length} Kategorien Einkauf
                </div>
              </button>
              <button
                className="px-2 text-cocoa-muted hover:text-red-500"
                aria-label="Plan löschen"
                onClick={() => {
                  if (confirm(`„${p.name}" löschen?`)) delPlan.mutate(p.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Rezept-Modal */}
      {recipe && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{recipe.title}</h3>
              <button className="px-2 text-cocoa-muted" onClick={() => setRecipe(null)} aria-label="Schließen">
                ✕
              </button>
            </div>
            <div className="text-xs text-cocoa-light">
              {recipe.nutrition.kcal} kcal · E {recipe.nutrition.protein} / K {recipe.nutrition.carbs} / F{' '}
              {recipe.nutrition.fat} · {recipe.servings} Portion(en)
            </div>
            {recipe.ingredients.length > 0 && (
              <div>
                <div className="text-sm font-semibold">Zutaten</div>
                <ul className="list-disc pl-5 text-sm text-cocoa">
                  {recipe.ingredients.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.steps.length > 0 && (
              <div>
                <div className="text-sm font-semibold">Zubereitung</div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-cocoa">
                  {recipe.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            )}
            <button className="btn-primary w-full" onClick={saveRecipe} disabled={addRecipe.isPending}>
              {addRecipe.isPending ? 'Speichert…' : '💾 Als Rezept speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
