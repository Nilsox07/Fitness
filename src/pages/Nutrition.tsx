import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAddRecipe } from '../hooks/useRecipes'
import { Stepper } from '../components/Stepper'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { BodyWeightCard } from '../components/BodyWeightCard'
import { WaterCard } from '../components/WaterCard'
import { MicButton } from '../components/MicButton'
import { useAllSets } from '../hooks/useWorkouts'
import { MEALS, MEAL_LABEL, type Meal } from '../types'

/** Standard-Mahlzeit nach Uhrzeit. */
function currentMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
import {
  useAddFoodEntry,
  useAllFoodEntries,
  useDeleteFoodEntry,
  useFoodEntries,
  useNutritionSettings,
  useUpsertNutritionSettings,
  type NutritionSettingsInput,
} from '../hooks/useNutrition'
import {
  ACTIVITY_LABEL,
  GOAL_LABEL,
  computeTargets,
  scalePer100,
  sumEntries,
} from '../lib/nutrition'
import { fetchProductByBarcode, searchProducts, type FoodProduct } from '../lib/openfoodfacts'
import {
  estimateFoodFromImage,
  estimateFoodFromText,
  mealPlanForDay,
  nutritionReview,
  recipeFromFridge,
  recipeFromText,
  suggestOrder,
  type FoodEstimate,
  type MealPlanItem,
  type Recipe,
} from '../lib/ai'
import { useAiStatus } from '../hooks/useAi'
import { useBodyWeights } from '../hooks/useBodyWeight'
import type { ActivityLevel, FoodEntry, NutritionGoal, Sex } from '../types'

/** Datei zu (verkleinerter) Data-URL — spart Tokens/Upload. */
function fileToDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(reader.result as string)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => resolve(reader.result as string)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const emptySettings: NutritionSettingsInput = {
  sex: 'm',
  age: 30,
  height_cm: 175,
  weight_kg: 75,
  activity: 'moderate',
  goal: 'maintain',
  kcal_target: 0,
  protein_target: 0,
  carbs_target: 0,
  fat_target: 0,
}

function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sand-dark/50">
      <div className="h-full rounded-full bg-ruby" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Nutrition() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const addRecipe = useAddRecipe()
  const today = todayLocal()
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(today)
  const { data: allEntries } = useAllFoodEntries()
  const { data: allSets } = useAllSets()
  const trainedToday = (allSets ?? []).some((s) => s.date === today)
  const upsertSettings = useUpsertNutritionSettings()

  // „Zuletzt gegessen": eindeutige letzte Lebensmittel für 1-Tap-Wiederholung
  const recent = useMemo(() => {
    const seen = new Map<string, FoodEntry>()
    for (const e of [...(allEntries ?? [])].reverse()) {
      const key = e.name.toLowerCase()
      if (!seen.has(key)) seen.set(key, e)
      if (seen.size >= 8) break
    }
    return [...seen.values()]
  }, [allEntries])

  function quickAdd(e: FoodEntry) {
    addEntry.mutate({
      date: today,
      name: e.name,
      amount_g: e.amount_g,
      kcal: e.kcal,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      barcode: e.barcode,
      meal: e.meal ?? currentMeal(),
    })
  }
  const addEntry = useAddFoodEntry()
  const deleteEntry = useDeleteFoodEntry()

  const totals = sumEntries(entries ?? [])

  // Modal-Status
  const [setupOpen, setSetupOpen] = useState(false)
  const [form, setForm] = useState<NutritionSettingsInput>(emptySettings)
  const [addMode, setAddMode] = useState<
    null | 'menu' | 'manual' | 'search' | 'aitext' | 'recipe' | 'plan' | 'photo' | 'restaurant'
  >(null)
  const [place, setPlace] = useState('')
  const [restItem, setRestItem] = useState('')
  const [scanning, setScanning] = useState(false)

  // gewähltes Produkt → Mengen-Bestätigung
  const [pending, setPending] = useState<FoodProduct | null>(null)
  const [amount, setAmount] = useState(100)

  // Suche
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodProduct[]>([])
  const [searching, setSearching] = useState(false)

  // manuelle Eingabe
  const [manual, setManual] = useState({ name: '', amount_g: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const [error, setError] = useState<string | null>(null)

  // KI-Erfassung (Foto/Text)
  const { data: ai } = useAiStatus()
  const [aiResults, setAiResults] = useState<FoodEstimate[] | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [photoHint, setPhotoHint] = useState('')
  const { data: weights } = useBodyWeights()
  const [nutriReview, setNutriReview] = useState<string | null>(null)
  const [nutriBusy, setNutriBusy] = useState(false)

  async function makeNutriReview() {
    setNutriBusy(true)
    try {
      const byDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
      for (const e of allEntries ?? []) {
        const d = byDay.get(e.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
        d.kcal += e.kcal
        d.protein += e.protein
        d.carbs += e.carbs
        d.fat += e.fat
        byDay.set(e.date, d)
      }
      const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7)
      const avg = (sel: (v: { kcal: number; protein: number; carbs: number; fat: number }) => number) =>
        days.length ? Math.round(days.reduce((s, [, v]) => s + sel(v), 0) / days.length) : 0
      const w = weights ?? []
      setNutriReview(
        await nutritionReview({
          tageErfasst: days.length,
          durchschnitt: {
            kcal: avg((v) => v.kcal),
            eiweiss: avg((v) => v.protein),
            kohlenhydrate: avg((v) => v.carbs),
            fett: avg((v) => v.fat),
          },
          ziel: settings
            ? { kcal: settings.kcal_target, eiweiss: settings.protein_target }
            : null,
          gewicht: w.length
            ? { start: Number(w[0].weight_kg), aktuell: Number(w[w.length - 1].weight_kg) }
            : null,
        }),
      )
    } catch (e) {
      setNutriReview(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setNutriBusy(false)
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    setAiBusy(true)
    setError(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const items = await estimateFoodFromImage(dataUrl, photoHint.trim() || undefined)
      if (items.length === 0) setError('Kein Essen erkannt. Versuch ein klareres Foto.')
      else {
        setAiResults(items)
        setAddMode(null)
        setPhotoHint('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler beim Foto')
    } finally {
      setAiBusy(false)
    }
  }

  async function handleAiText() {
    if (!aiText.trim()) return
    setAiBusy(true)
    setError(null)
    try {
      const items = await estimateFoodFromText(aiText.trim())
      if (items.length === 0) setError('Nichts erkannt. Formulier es anders.')
      else {
        setAiResults(items)
        setAddMode(null)
        setAiText('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  const [craving, setCraving] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeText, setRecipeText] = useState('')
  const [planWish, setPlanWish] = useState('')
  const [planItems, setPlanItems] = useState<MealPlanItem[] | null>(null)
  const [planNote, setPlanNote] = useState('')

  async function genPlan() {
    setAiBusy(true)
    setError(null)
    try {
      const res = await mealPlanForDay(
        { kcal: settings?.kcal_target ?? 2000, protein: settings?.protein_target ?? 130 },
        planWish,
      )
      setPlanItems(res.items)
      setPlanNote(res.note)
      setAddMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  async function logPlan(items: MealPlanItem[]) {
    for (const it of items) {
      await addEntry.mutateAsync({
        date: today,
        name: it.name,
        amount_g: null,
        kcal: it.kcal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        barcode: null,
        meal: it.meal,
      })
    }
    setPlanItems(null)
  }

  async function estimateOrder() {
    if (!place && !restItem.trim()) return
    setAiBusy(true)
    setError(null)
    try {
      const items = await estimateFoodFromText(`${place ? place + ': ' : ''}${restItem.trim()}`)
      if (items.length === 0) setError('Nichts erkannt.')
      else {
        setAiResults(items)
        setAddMode(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  async function suggestForBudget() {
    if (!place) {
      setError('Wähl zuerst einen Anbieter.')
      return
    }
    setAiBusy(true)
    setError(null)
    try {
      const remaining = {
        kcal: Math.max(0, kcalTarget - totals.kcal),
        protein: Math.max(0, (settings?.protein_target ?? 0) - totals.protein),
      }
      const res = await suggestOrder(place, remaining, restItem.trim())
      if (res.items.length === 0) setError('Kein Vorschlag möglich.')
      else {
        setAiResults(res.items)
        setAddMode(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  async function genRecipeText() {
    if (!recipeText.trim()) return
    setAiBusy(true)
    setError(null)
    try {
      setRecipe(await recipeFromText(recipeText.trim()))
      setRecipeText('')
      setAddMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  async function handleFridge(file: File | undefined) {
    if (!file) return
    setAiBusy(true)
    setError(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const r = await recipeFromFridge(dataUrl, craving)
      setRecipe(r)
      setAddMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler beim Rezept')
    } finally {
      setAiBusy(false)
    }
  }

  async function saveRecipe(r: Recipe, shared: boolean) {
    await addRecipe.mutateAsync({
      title: r.title,
      servings: r.servings,
      ingredients: r.ingredients,
      steps: r.steps,
      kcal: r.nutrition.kcal,
      protein: r.nutrition.protein,
      carbs: r.nutrition.carbs,
      fat: r.nutrition.fat,
      shared,
      author_name: user?.email?.split('@')[0] ?? null,
    })
    setRecipe(null)
    setCraving('')
  }

  async function logRecipe(r: Recipe) {
    await addEntry.mutateAsync({
      date: today,
      name: `🍳 ${r.title}`,
      amount_g: null,
      kcal: r.nutrition.kcal,
      protein: r.nutrition.protein,
      carbs: r.nutrition.carbs,
      fat: r.nutrition.fat,
      barcode: null,
      meal: currentMeal(),
    })
    setRecipe(null)
    setCraving('')
  }

  async function addEstimates(items: FoodEstimate[]) {
    for (const it of items) {
      await addEntry.mutateAsync({
        date: today,
        name: it.name,
        amount_g: it.amount_g,
        kcal: it.kcal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        barcode: null,
        meal: currentMeal(),
      })
    }
    setAiResults(null)
  }

  function openSetup() {
    setForm(settings ? { ...settings } : emptySettings)
    setSetupOpen(true)
  }

  async function saveSetup() {
    const t = computeTargets(form)
    await upsertSettings.mutateAsync({
      ...form,
      kcal_target: t.kcal,
      protein_target: t.protein,
      carbs_target: t.carbs,
      fat_target: t.fat,
    })
    setSetupOpen(false)
  }

  async function handleBarcode(code: string) {
    setScanning(false)
    setError(null)
    try {
      const product = await fetchProductByBarcode(code)
      if (!product) {
        setError(`Kein Produkt zu Barcode ${code} gefunden. Versuch die Suche oder manuelle Eingabe.`)
        setAddMode('menu')
        return
      }
      setPending(product)
      setAmount(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Abruf')
    }
  }

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchProducts(query.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler bei der Suche')
    } finally {
      setSearching(false)
    }
  }

  async function confirmPending() {
    if (!pending) return
    const m = scalePer100(pending.per100, amount)
    await addEntry.mutateAsync({
      date: today,
      name: pending.name,
      amount_g: amount,
      kcal: m.kcal,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      barcode: pending.barcode,
      meal: currentMeal(),
    })
    setPending(null)
    setAddMode(null)
    setQuery('')
    setResults([])
  }

  async function addManual() {
    if (!manual.name.trim()) return
    await addEntry.mutateAsync({
      date: today,
      name: manual.name.trim(),
      amount_g: manual.amount_g || null,
      kcal: manual.kcal,
      protein: manual.protein,
      carbs: manual.carbs,
      fat: manual.fat,
      barcode: null,
      meal: currentMeal(),
    })
    setManual({ name: '', amount_g: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 })
    setAddMode(null)
  }

  const hasTarget = settings && settings.kcal_target > 0
  // An Trainingstagen etwas mehr Energie (v. a. Kohlenhydrate) einplanen.
  const TRAINING_BONUS = 250
  const kcalTarget = hasTarget ? settings!.kcal_target + (trainedToday ? TRAINING_BONUS : 0) : 0
  const kcalLeft = hasTarget ? kcalTarget - totals.kcal : 0

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ernährung</h1>
        <div className="flex gap-2">
          {ai?.enabled && (
            <button className="btn-ghost text-sm" onClick={() => navigate('/shopping')} aria-label="Einkaufsassistent">
              🛒
            </button>
          )}
          <button className="btn-ghost text-sm" onClick={() => navigate('/recipes')} aria-label="Rezepte">
            📖
          </button>
          <button className="btn-ghost text-sm" onClick={openSetup}>
            {hasTarget ? 'Ziel' : 'Ziel einstellen'}
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {/* Tagesübersicht */}
      <div className="card space-y-3">
        {hasTarget ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-brand">{totals.kcal}</div>
                <div className="text-xs text-cocoa-light">
                  von {kcalTarget} kcal{trainedToday && ' · +Trainingstag'}
                </div>
              </div>
              <div className="text-right text-sm text-cocoa-light">
                {kcalLeft >= 0 ? `${kcalLeft} kcal übrig` : `${-kcalLeft} kcal drüber`}
              </div>
            </div>
            <Bar value={totals.kcal} target={kcalTarget} />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-cocoa">{totals.protein} g</div>
                <div className="text-cocoa-light">Eiweiß / {settings!.protein_target} g</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">{totals.carbs} g</div>
                <div className="text-cocoa-light">Kohlh. / {settings!.carbs_target} g</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">{totals.fat} g</div>
                <div className="text-cocoa-light">Fett / {settings!.fat_target} g</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-sm text-cocoa-light">
            Stell zuerst dein Kalorienziel ein, um deinen Tagesfortschritt zu sehen.
          </div>
        )}
      </div>

      {/* Erfassen */}
      <button className="btn-primary w-full" onClick={() => setAddMode('menu')}>
        + Lebensmittel hinzufügen
      </button>

      {/* Zuletzt gegessen — 1-Tap-Wiederholung */}
      {recent.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-cocoa-light">Zuletzt gegessen</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {recent.map((e) => (
              <button
                key={e.id}
                onClick={() => quickAdd(e)}
                className="shrink-0 rounded-full bg-sand-light px-3 py-1.5 text-sm ring-1 ring-sand-dark"
              >
                + {e.name}{' '}
                <span className="text-cocoa-muted">{Math.round(e.kcal)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Heutige Einträge, nach Mahlzeit gruppiert */}
      <div className="space-y-3">
        {MEALS.map((meal) => {
          const group = (entries ?? []).filter((e) => (e.meal ?? 'snack') === meal)
          if (group.length === 0) return null
          const kcal = group.reduce((s, e) => s + e.kcal, 0)
          return (
            <div key={meal}>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{MEAL_LABEL[meal as Meal]}</span>
                <span className="text-xs text-cocoa-light">{Math.round(kcal)} kcal</span>
              </div>
              <div className="space-y-2">
                {group.map((e) => (
                  <div key={e.id} className="card flex items-center justify-between">
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-cocoa-light">
                        {e.amount_g ? `${e.amount_g} g · ` : ''}
                        {Math.round(e.kcal)} kcal · E {e.protein} / K {e.carbs} / F {e.fat}
                      </div>
                    </div>
                    <button
                      className="ml-2 px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                      aria-label="Eintrag löschen"
                      onClick={() => deleteEntry.mutate(e)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {entries?.length === 0 && (
          <p className="text-center text-sm text-cocoa-light">Heute noch nichts erfasst.</p>
        )}
      </div>

      <WaterCard />
      <BodyWeightCard />

      {ai?.enabled && (allEntries?.length ?? 0) > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold">🤖 Ernährungs-Fazit</h2>
          {nutriReview && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-cocoa">{nutriReview}</p>
          )}
          <button className="btn-primary w-full" onClick={makeNutriReview} disabled={nutriBusy}>
            {nutriBusy ? 'Analysiere…' : nutriReview ? 'Neu erstellen' : 'Wochenfazit erstellen'}
          </button>
        </div>
      )}

      {/* ----- Ziel-Setup ----- */}
      {setupOpen && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Kalorienziel</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Geschlecht</label>
                <select
                  className="input"
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}
                >
                  <option value="m">männlich</option>
                  <option value="f">weiblich</option>
                </select>
              </div>
              <div>
                <label className="label">Alter</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  value={form.age}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Größe (cm)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  value={form.height_cm}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, height_cm: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Gewicht (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  value={form.weight_kg}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="label">Aktivität</label>
              <select
                className="input"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value as ActivityLevel })}
              >
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ziel</label>
              <select
                className="input"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value as NutritionGoal })}
              >
                {Object.entries(GOAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-cocoa-light">
              Ergibt ~{computeTargets(form).kcal} kcal/Tag · Eiweiß {computeTargets(form).protein} g
            </p>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setSetupOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={saveSetup}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Hinzufügen: Menü ----- */}
      {addMode === 'menu' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-2">
            <h2 className="text-lg font-bold">Hinzufügen</h2>
            {ai?.enabled && (
              <>
                <button className="btn-primary w-full" onClick={() => setAddMode('photo')}>
                  📸 Foto (KI)
                </button>
                <button className="btn-ghost w-full" onClick={() => setAddMode('aitext')}>
                  💬 Text beschreiben (KI)
                </button>
                <button className="btn-ghost w-full" onClick={() => setAddMode('recipe')}>
                  🍳 Rezept (Foto/Text, KI)
                </button>
                <button className="btn-ghost w-full" onClick={() => setAddMode('plan')}>
                  📋 Essensplan für heute (KI)
                </button>
                <button className="btn-ghost w-full" onClick={() => setAddMode('restaurant')}>
                  🍔 Restaurant / unterwegs (KI)
                </button>
              </>
            )}
            <button
              className={ai?.enabled ? 'btn-ghost w-full' : 'btn-primary w-full'}
              onClick={() => {
                setError(null)
                setScanning(true)
              }}
            >
              📷 Barcode scannen
            </button>
            <button className="btn-ghost w-full" onClick={() => setAddMode('search')}>
              🔎 In Datenbank suchen
            </button>
            <button className="btn-ghost w-full" onClick={() => setAddMode('manual')}>
              ✍️ Manuell eingeben
            </button>
            <button
              className="w-full pt-1 text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode(null)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* ----- Suche ----- */}
      {addMode === 'search' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Suchen</h2>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. Magerquark"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <button className="btn-primary" onClick={runSearch} disabled={searching}>
                {searching ? '…' : 'Los'}
              </button>
            </div>
            <ul className="space-y-1">
              {results.map((p, i) => (
                <li key={i}>
                  <button
                    className="w-full rounded-lg bg-sand/40 px-3 py-2 text-left ring-1 ring-sand-dark/50"
                    onClick={() => {
                      setPending(p)
                      setAmount(100)
                    }}
                  >
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-cocoa-light">
                      {p.brand ? `${p.brand} · ` : ''}
                      {p.per100.kcal} kcal /100 g
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="w-full text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode('menu')}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ----- Mengen-Bestätigung (Barcode/Suche) ----- */}
      {pending && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">{pending.name}</h2>
            <p className="text-xs text-cocoa-light">
              {pending.brand ? `${pending.brand} · ` : ''}
              pro 100 g: {pending.per100.kcal} kcal · E {pending.per100.protein} / K{' '}
              {pending.per100.carbs} / F {pending.per100.fat}
            </p>
            <Stepper label="Menge (g)" value={amount} onChange={setAmount} step={10} min={0} suffix="g" />
            <p className="text-sm">
              = <strong>{scalePer100(pending.per100, amount).kcal} kcal</strong>, Eiweiß{' '}
              {scalePer100(pending.per100, amount).protein} g
            </p>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setPending(null)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={confirmPending} disabled={addEntry.isPending}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Manuelle Eingabe ----- */}
      {addMode === 'manual' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Manuell eingeben</h2>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                autoFocus
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['kcal', 'kcal'],
                  ['amount_g', 'Menge (g)'],
                  ['protein', 'Eiweiß (g)'],
                  ['carbs', 'Kohlenhydrate (g)'],
                  ['fat', 'Fett (g)'],
                ] as const
              ).map(([key, lbl]) => (
                <div key={key}>
                  <label className="label">{lbl}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input"
                    value={manual[key]}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setManual({ ...manual, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAddMode('menu')}>
                Zurück
              </button>
              <button className="btn-primary flex-1" onClick={addManual} disabled={addEntry.isPending}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- KI: Restaurant / unterwegs ----- */}
      {addMode === 'restaurant' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">🍔 Restaurant / unterwegs</h2>
            {hasTarget && (
              <p className="text-xs text-cocoa-light">
                Noch offen heute: {Math.max(0, kcalTarget - totals.kcal)} kcal ·{' '}
                {Math.max(0, (settings?.protein_target ?? 0) - totals.protein)} g Eiweiß
              </p>
            )}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              {["McDonald's", 'Burger King', 'KFC', 'Subway', 'Döner', 'Supermarkt'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPlace(p)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
                    place === p ? 'bg-ruby text-white ring-ruby' : 'bg-sand-light text-cocoa ring-sand-dark'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Anbieter / Gericht, z. B. Big Mac Menü — oder leer lassen"
                value={restItem}
                onChange={(e) => setRestItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && estimateOrder()}
              />
              <MicButton onResult={(t) => setRestItem((v) => (v ? v + ' ' + t : t))} />
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="btn-primary" onClick={estimateOrder} disabled={aiBusy}>
                {aiBusy ? '…' : 'Bestellung schätzen'}
              </button>
              <button className="btn-ghost" onClick={suggestForBudget} disabled={aiBusy}>
                🤖 Passt zum Budget
              </button>
            </div>
            <button
              className="w-full text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode('menu')}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ----- KI: Foto + optionale Notiz ----- */}
      {addMode === 'photo' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">📸 Essen fotografieren</h2>
            <p className="text-xs text-cocoa-light">
              Optional dazu schreiben oder diktieren, was drin ist oder wie viel — macht die
              Schätzung genauer.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. mit extra Käse, ca. 300 g, dazu Reis"
                value={photoHint}
                onChange={(e) => setPhotoHint(e.target.value)}
              />
              <MicButton onResult={(t) => setPhotoHint((v) => (v ? v + ' ' + t : t))} />
            </div>
            <label className="btn-primary flex w-full cursor-pointer items-center justify-center">
              {aiBusy ? '… analysiere' : '📷 Foto aufnehmen'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </label>
            <button
              className="w-full text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode('menu')}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ----- KI: Text beschreiben ----- */}
      {addMode === 'aitext' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">💬 Mahlzeit beschreiben</h2>
            <p className="text-xs text-cocoa-light">
              Schreib einfach, was du gegessen hast — die KI schätzt die Nährwerte.
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                autoFocus
                placeholder="z. B. 2 Eier, 80 g Haferflocken, 1 Banane"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiText()}
              />
              <MicButton onResult={(t) => setAiText((v) => (v ? v + ' ' + t : t))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAddMode('menu')}>
                Zurück
              </button>
              <button className="btn-primary flex-1" onClick={handleAiText} disabled={aiBusy}>
                {aiBusy ? '…' : 'Schätzen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- KI: Ergebnis prüfen & übernehmen ----- */}
      {aiResults && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">KI-Schätzung</h2>
            <p className="text-xs text-cocoa-light">
              Schätzwerte — vor dem Übernehmen kurz prüfen. Zum Feinjustieren einzeln übernehmen und
              danach bearbeiten.
            </p>
            <ul className="space-y-2">
              {aiResults.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-sand/40 px-3 py-2 ring-1 ring-sand-dark/50"
                >
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-cocoa-light">
                      {it.amount_g ? `${it.amount_g} g · ` : ''}
                      {it.kcal} kcal · E {it.protein} / K {it.carbs} / F {it.fat}
                    </div>
                  </div>
                  <button
                    className="ml-2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white"
                    onClick={() => addEstimates([it])}
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAiResults(null)}>
                Verwerfen
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => addEstimates(aiResults)}
                disabled={addEntry.isPending}
              >
                Alle übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- KI: Kühlschrank-Rezept ----- */}
      {addMode === 'recipe' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">🍳 Rezept aus Kühlschrank</h2>
            <p className="text-xs text-cocoa-light">
              Worauf hast du Lust? Dann den Kühlschrank/die Zutaten fotografieren — die KI macht dir
              ein passendes Rezept.
            </p>
            <input
              className="input"
              placeholder="z. B. was Herzhaftes, proteinreich, schnell"
              value={craving}
              onChange={(e) => setCraving(e.target.value)}
            />
            <label className="btn-primary flex w-full cursor-pointer items-center justify-center">
              {aiBusy ? '… koche' : '📸 Kühlschrank fotografieren'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFridge(e.target.files?.[0])}
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-cocoa-muted">
              <span className="h-px flex-1 bg-sand-dark" /> oder ohne Foto{' '}
              <span className="h-px flex-1 bg-sand-dark" />
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. veganes Frühstück, 40 g Eiweiß"
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && genRecipeText()}
              />
              <MicButton onResult={(t) => setRecipeText((v) => (v ? v + ' ' + t : t))} />
              <button className="btn-ghost shrink-0" onClick={genRecipeText} disabled={aiBusy}>
                Los
              </button>
            </div>
            <button
              className="w-full text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode('menu')}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ----- Rezept-Ergebnis ----- */}
      {recipe && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">{recipe.title}</h2>
            <p className="text-xs text-cocoa-light">
              {recipe.servings} Portion(en) · pro Portion {recipe.nutrition.kcal} kcal · E{' '}
              {recipe.nutrition.protein} / K {recipe.nutrition.carbs} / F {recipe.nutrition.fat}
            </p>
            <div>
              <div className="mb-1 text-sm font-semibold">Zutaten</div>
              <ul className="list-disc pl-5 text-sm text-cocoa">
                {recipe.ingredients.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold">Zubereitung</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-cocoa">
                {recipe.steps.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="btn-ghost" onClick={() => saveRecipe(recipe, false)}>
                💾 Speichern
              </button>
              <button className="btn-ghost" onClick={() => saveRecipe(recipe, true)}>
                📤 Speichern & teilen
              </button>
              <button className="btn-ghost" onClick={() => setRecipe(null)}>
                Schließen
              </button>
              <button className="btn-primary" onClick={() => logRecipe(recipe)}>
                Loggen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- KI: Essensplan Eingabe ----- */}
      {addMode === 'plan' && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">📋 Essensplan für heute</h2>
            <p className="text-xs text-cocoa-light">
              Ziel: ~{settings?.kcal_target ?? 2000} kcal · {settings?.protein_target ?? 130} g Eiweiß.
              Wünsche?
            </p>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. high protein, kein Schwein, schnell"
                value={planWish}
                onChange={(e) => setPlanWish(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && genPlan()}
              />
              <MicButton onResult={(t) => setPlanWish((v) => (v ? v + ' ' + t : t))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAddMode('menu')}>
                Zurück
              </button>
              <button className="btn-primary flex-1" onClick={genPlan} disabled={aiBusy}>
                {aiBusy ? 'Erstelle…' : 'Plan erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Essensplan Ergebnis ----- */}
      {planItems && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Essensplan</h2>
            {planNote && <p className="text-xs text-cocoa-light">{planNote}</p>}
            <ul className="space-y-1.5">
              {planItems.map((it, i) => (
                <li key={i} className="rounded-lg bg-sand/40 px-3 py-2 ring-1 ring-sand-dark/50">
                  <div className="text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-cocoa-light">
                    {MEAL_LABEL[it.meal]} · {it.kcal} kcal · E {it.protein} / K {it.carbs} / F {it.fat}
                  </div>
                </li>
              ))}
            </ul>
            <div className="text-xs text-cocoa-muted">
              Summe: {planItems.reduce((s, i) => s + i.kcal, 0)} kcal ·{' '}
              {planItems.reduce((s, i) => s + i.protein, 0)} g Eiweiß
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setPlanItems(null)}>
                Verwerfen
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => logPlan(planItems)}
                disabled={addEntry.isPending}
              >
                Alle loggen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Kamera-Scanner ----- */}
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  )
}
