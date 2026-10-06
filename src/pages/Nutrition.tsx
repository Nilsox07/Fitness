import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bot,
  Camera,
  ChefHat,
  ClipboardList,
  History,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  Refrigerator,
  Save,
  ScanBarcode,
  Search,
  Share2,
  Sparkles,
  Store,
  Target,
  Trash2,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Sheet } from '../components/workout/Sheet'
import { PremiumSheet } from '../components/ui/PremiumSheet'
import { BIG_INPUT, ErrorNote, GroupLabel, GroupList, GroupRow } from '../components/ui/GroupList'
import { useAuth } from '../lib/auth'
import { useAddRecipe } from '../hooks/useRecipes'
import { Stepper } from '../components/Stepper'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { BodyWeightCard } from '../components/BodyWeightCard'
import { MicButton } from '../components/MicButton'
import { useAllSets } from '../hooks/useWorkouts'
import { MealAnalysisSheet, type AnalysisStatus } from '../components/food/MealAnalysisSheet'
import { MEALS, MEAL_LABEL, type Meal } from '../types'

/** Standard-Mahlzeit nach Uhrzeit. */
function currentMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

/** Mikronährwerte (Ballaststoffe/Zucker/gesätt. Fett/Salz) mit Fallback 0. */
const micro = (x: { fiber?: number; sugar?: number; sat_fat?: number; salt?: number }) => ({
  fiber: x.fiber ?? 0,
  sugar: x.sugar ?? 0,
  sat_fat: x.sat_fat ?? 0,
  salt: x.salt ?? 0,
})
import {
  useAddFoodEntries,
  useAddFoodEntry,
  useAllFoodEntries,
  useDeleteFoodEntry,
  useUpdateFoodEntry,
  useFoodEntries,
  useNutritionSettings,
  useDietStyle,
} from '../hooks/useNutrition'
import { GOAL_LABEL, scalePer100, sumEntries } from '../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { fetchProductByBarcode, searchProducts, type FoodProduct } from '../lib/openfoodfacts'
import {
  analyzeMeal,
  estimateFoodFromImage,
  estimateFoodFromText,
  mealPlanForDay,
  recipeFromFridge,
  recipeFromText,
  suggestOrder,
  type FoodEstimate,
  type MealAnalysis,
  type MealPlanItem,
  type Recipe,
} from '../lib/ai'
import { useAiStatus } from '../hooks/useAi'
import { usePrefs } from '../lib/prefs'
import { GoalEditor } from '../components/GoalEditor'
import { WeekStrip } from '../components/nutrition-home/WeekStrip'
import { HeroCard } from '../components/nutrition-home/HeroCard'
import { QuickAddBar } from '../components/nutrition-home/QuickAddBar'
import { RecentChips } from '../components/nutrition-home/RecentChips'
import { MealCard } from '../components/nutrition-home/MealCard'
import { WaterRow } from '../components/nutrition-home/WaterRow'
import { FastingCard } from '../components/nutrition-home/FastingCard'
import { dietShortLabel } from '../lib/dietStyle'
import { stagger } from '../components/nutrition-home/motion'
import { kcalByDate, mealRecommendation } from '../lib/nutritionHome'
import { dayLabel } from '../lib/day'
import type { FoodEntry } from '../types'
import { useNutritionPrefs } from '../hooks/usePrefsSync'
import { ChainBadge, ChainMenu } from '../components/food/ChainMenu'
import { CHAIN_BADGE, findChain, loadChains, menuItemToEstimate, suggestCombo, type Chain } from '../lib/fastfood'

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

/** Fehlermeldung — wird im jeweils offenen Sheet gezeigt, damit sie nicht hinter dem Overlay verschwindet. */
function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
}

/** Fehlertext für fehlgeschlagene Speichervorgänge. */
function saveError(e: unknown, what = 'Speichern'): string {
  const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
  return `${what} fehlgeschlagen${detail}. Bitte nochmal versuchen.`
}

function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sand-dark/50">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${pct >= 100 ? 'bg-success' : 'bg-brand'}`}
        style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Anbieter-Chips im Restaurant-Sheet. */
const PLACES = [
  'Döner',
  'Italienisch',
  'Indisch',
  'Mexikanisch',
  'Asiatisch',
  'Chinesisch',
  'Thai',
  'Vietnamesisch',
  'Sushi',
  'Griechisch',
  'Türkisch',
  'Libanesisch',
  'Burger',
  'Pizza',
  'Café',
  'Bäckerei',
  'Supermarkt',
]

/** Felder der manuellen Eingabe (die ersten fünf sind die Hauptwerte). */
const MANUAL_FIELDS = [
  ['kcal', 'kcal'],
  ['amount_g', 'Menge (g)'],
  ['protein', 'Eiweiß (g)'],
  ['carbs', 'Kohlenhydrate (g)'],
  ['fat', 'Fett (g)'],
  ['fiber', 'Ballaststoffe (g)'],
  ['sugar', 'Zucker (g)'],
  ['sat_fat', 'ges. Fett (g)'],
  ['salt', 'Salz (g)'],
] as const

const fmtNum = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/**
 * Sheet der Hinzufügen-Abläufe: im neuen Modus als Premium-Sheet (Griff, Titel,
 * runder Schließen-Knopf, feste Primäraktion unten), im klassischen Modus
 * unverändert als Karte über dem abgedunkelten Hintergrund.
 */
function FlowSheet({
  premium,
  title,
  subtitle,
  icon: Icon,
  classicIcon = false,
  onClose,
  onBack,
  busy = false,
  footer,
  classicBack,
  z = 'z-20',
  scroll = false,
  dense = false,
  children,
}: {
  premium: boolean
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Icon auch im klassischen Titel zeigen */
  classicIcon?: boolean
  onClose: () => void
  onBack?: () => void
  busy?: boolean
  footer?: ReactNode
  /** Nur klassisch: unterstrichener Zurück-/Abbrechen-Link am Ende */
  classicBack?: ReactNode
  z?: 'z-20' | 'z-30'
  scroll?: boolean
  dense?: boolean
  children: ReactNode
}) {
  if (premium) {
    return (
      <PremiumSheet
        title={title}
        subtitle={subtitle}
        leading={Icon ? <IconTile icon={Icon} /> : undefined}
        onClose={onClose}
        onBack={onBack}
        busy={busy}
        footer={footer}
        bodyClassName="space-y-4"
      >
        {children}
      </PremiumSheet>
    )
  }
  return (
    <div
      className={`anim-fade fixed inset-0 ${z} flex items-end justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
    >
      <div
        className={`anim-sheet card w-full max-w-md ${dense ? 'space-y-2' : 'space-y-3'} ${
          scroll ? 'max-h-[90vh] overflow-y-auto' : ''
        }`}
      >
        {Icon && classicIcon ? (
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon size={20} className="text-cocoa-light" />
            {title}
          </h2>
        ) : (
          <h2 className="text-lg font-bold">{title}</h2>
        )}
        {children}
        {footer}
        {classicBack}
      </div>
    </div>
  )
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
      <Icon size={18} />
    </span>
  )
}

/** Große Primäraktion für die feste Fußzeile. */
function PrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  children: ReactNode
}) {
  return (
    <button
      className="btn-primary w-full gap-2 rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25 disabled:shadow-none"
      onClick={onClick}
      disabled={disabled}
    >
      {busy && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  )
}

function KcalBadge({ kcal }: { kcal: number }) {
  return (
    <span className="tabular shrink-0 text-right text-sm font-semibold text-cocoa">
      {Math.round(kcal)}
      <span className="ml-0.5 text-xs font-normal text-cocoa-light">kcal</span>
    </span>
  )
}

function MacroCell({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-xl bg-sand-light px-2 py-2">
      <div className="tabular text-base font-bold text-cocoa">
        {fmtNum(value)}
        <span className="ml-0.5 text-xs font-normal text-cocoa-light">g</span>
      </div>
      <div className="flex items-center justify-center gap-1 text-[11px] text-cocoa-light">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
    </div>
  )
}

function ManualField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block min-w-0">
      <span className="label text-xs">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="input tabular rounded-2xl py-3 text-base"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export default function Nutrition() {
  const { kcalBonus, mealSplit } = useNutritionPrefs()
  const { user } = useAuth()
  const addRecipe = useAddRecipe()
  // Ausgewählter Tag (?date=YYYY-MM-DD) — so lassen sich vergangene Tage nachtragen/korrigieren.
  const [params, setParams] = useSearchParams()
  const { isNew } = usePrefs()
  const realToday = todayLocal()
  const paramDate = params.get('date')
  // Vergangene Tage nur im neuen Modus (der klassische hat keine Tagesnavigation).
  const today =
    isNew && paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) && paramDate < realToday ? paramDate : realToday
  const isToday = today === realToday
  const setDay = (d: string) => setParams(d >= realToday ? {} : { date: d }, { replace: true })
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null)
  const { data: settings } = useNutritionSettings()
  const diet = useDietStyle()
  const dietLabel = dietShortLabel(diet)
  const { data: entries } = useFoodEntries(today)
  const { data: allEntries } = useAllFoodEntries()
  const { data: allSets } = useAllSets()
  const trainedToday = trainedOn(today, allSets)

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
    addEntry.mutate(
      {
        date: today,
        name: e.name,
        amount_g: e.amount_g,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        ...micro(e),
        barcode: e.barcode,
        // wie alle anderen Wege: Mahlzeit nach aktueller Uhrzeit
        meal: currentMeal(),
      },
      { onError: (err) => setError(saveError(err)) },
    )
  }
  /** Suche (neu): „Zuletzt gegessen" antippen → mit Gramm zur Mengen-Bestätigung, sonst direkt loggen. */
  function pickRecent(e: FoodEntry) {
    const g = e.amount_g ?? 0
    if (g > 0) {
      const k = 100 / g
      const r1 = (v: number | null | undefined) => Math.round((v ?? 0) * k * 10) / 10
      setPending({
        barcode: e.barcode,
        name: e.name,
        brand: null,
        per100: {
          kcal: Math.round(e.kcal * k),
          protein: r1(e.protein),
          carbs: r1(e.carbs),
          fat: r1(e.fat),
          fiber: r1(e.fiber),
          sugar: r1(e.sugar),
          sat_fat: r1(e.sat_fat),
          salt: Math.round((e.salt ?? 0) * k * 100) / 100,
        },
      })
      setAmount(Math.round(g))
      return
    }
    setError(null)
    addEntry.mutate(
      {
        date: today,
        name: e.name,
        amount_g: e.amount_g,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        ...micro(e),
        barcode: e.barcode,
        meal: addMeal(),
      },
      { onSuccess: () => go(null), onError: (err) => setError(saveError(err)) },
    )
  }
  const addEntry = useAddFoodEntry()
  const addEntries = useAddFoodEntries()
  const saving = addEntry.isPending || addEntries.isPending
  const deleteEntry = useDeleteFoodEntry()
  const updateEntry = useUpdateFoodEntry()

  const totals = sumEntries(entries ?? [])

  // Modal-Status
  const [setupOpen, setSetupOpen] = useState(false)
  const [addMode, setAddMode] = useState<
    null | 'menu' | 'manual' | 'search' | 'aitext' | 'recipe' | 'plan' | 'photo' | 'restaurant'
  >(null)
  const [place, setPlace] = useState('')
  const [restItem, setRestItem] = useState('')
  const [chains, setChains] = useState<Chain[] | null>(null)
  const [orderQty, setOrderQty] = useState<Record<string, number>>({})
  useEffect(() => {
    if (addMode !== 'restaurant' || chains) return
    loadChains()
      .then(setChains)
      .catch(() => setChains([]))
  }, [addMode, chains])
  const activeChain = chains && place ? findChain(chains, place) : undefined
  const orderItems = activeChain
    ? activeChain.items.filter((i) => (orderQty[i.name] ?? 0) > 0).map((i) => menuItemToEstimate(i, orderQty[i.name]))
    : []
  const orderKcal = orderItems.reduce((s, i) => s + i.kcal, 0)
  const [scanning, setScanning] = useState(false)

  // gewähltes Produkt → Mengen-Bestätigung
  const [pending, setPending] = useState<FoodProduct | null>(null)
  const [amount, setAmount] = useState(100)

  // Suche
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodProduct[]>([])
  const [searching, setSearching] = useState(false)

  // manuelle Eingabe
  const [manual, setManual] = useState({
    name: '',
    amount_g: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sat_fat: 0,
    salt: 0,
  })

  const [error, setError] = useState<string | null>(null)
  // Über das „+" einer Mahlzeiten-Karte vorgewählte Mahlzeit für die nächsten
  // Einträge; null = nach Uhrzeit (wie bisher).
  const [mealOverride, setMealOverride] = useState<Meal | null>(null)
  const addMeal = (): Meal => mealOverride ?? currentMeal()
  /** Sheet wechseln und alte Fehlermeldung verwerfen. */
  const go = (mode: typeof addMode) => {
    setError(null)
    setAddMode(mode)
  }

  // KI-Erfassung (Foto/Text)
  const { data: ai } = useAiStatus()
  const aiOn = isNew && ai?.enabled
  const [aiResults, setAiResults] = useState<FoodEstimate[] | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [photoHint, setPhotoHint] = useState('')

  // Neuer Modus: „Mahlzeit-Analyse"-Sheet (öffnet sofort, lädt im Sheet)
  type AnalysisSource = { image: string; hint?: string } | { text: string }
  const [analysis, setAnalysis] = useState<{
    id: number
    photo: string | null
    source: AnalysisSource | null
    status: AnalysisStatus
    result: MealAnalysis | null
    error: string | null
  } | null>(null)
  const analysisReq = useRef(0)

  /** KI-Analyse starten; Ergebnisse eines inzwischen geschlossenen Sheets werden verworfen. */
  async function runAnalysis(source: AnalysisSource) {
    const id = ++analysisReq.current
    const photo = 'image' in source ? source.image : null
    setAnalysis({ id, photo, source, status: 'loading', result: null, error: null })
    const finish = (patch: { status: AnalysisStatus; result?: MealAnalysis; error?: string }) =>
      setAnalysis((a) => (a && a.id === id ? { ...a, result: null, error: null, ...patch } : a))
    try {
      const goal = settings?.goal ? GOAL_LABEL[settings.goal] : undefined
      const res = await analyzeMeal({ ...source, goal })
      if (analysisReq.current !== id) return
      if (res.items.length === 0)
        finish({
          status: 'error',
          error: photo ? 'Kein Essen erkannt. Versuch ein klareres Foto.' : 'Nichts erkannt. Formulier es anders.',
        })
      else finish({ status: 'ready', result: res })
    } catch (e) {
      if (analysisReq.current !== id) return
      finish({ status: 'error', error: e instanceof Error ? e.message : 'KI-Fehler bei der Analyse' })
    }
  }

  /** Fertige Schätzungen (z. B. Restaurant) direkt im Analyse-Sheet zeigen. */
  function showAnalysis(items: FoodEstimate[], title: string, verdict = '') {
    const id = ++analysisReq.current
    setAnalysis({ id, photo: null, source: null, status: 'ready', result: { title, verdict, items }, error: null })
  }

  function closeAnalysis() {
    analysisReq.current++
    setAnalysis(null)
  }

  async function saveAnalysis(items: FoodEstimate[], meal: Meal) {
    await addEntries.mutateAsync(items.map((it) => ({ ...estimateToEntry(it), meal })))
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    if (isNew) {
      setError(null)
      try {
        const dataUrl = await fileToDataUrl(file)
        const hint = photoHint.trim() || undefined
        setAddMode(null)
        setPhotoHint('')
        void runAnalysis({ image: dataUrl, hint })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bild konnte nicht gelesen werden')
      }
      return
    }
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
    if (isNew) {
      setError(null)
      setAddMode(null)
      setAiText('')
      void runAnalysis({ text: aiText.trim() })
      return
    }
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
        { kcal: settings?.kcal_target || 2000, protein: settings?.protein_target || 130 },
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
    if (saving) return
    setError(null)
    try {
      // ein Insert für alle Einträge — keine halb geloggten Pläne
      await addEntries.mutateAsync(
        items.map((it) => ({
          date: today,
          name: it.name,
          amount_g: null,
          kcal: it.kcal,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          ...micro(it),
          barcode: null,
          meal: it.meal,
        })),
      )
      setPlanItems(null)
    } catch (e) {
      setError(saveError(e, 'Loggen'))
    }
  }

  async function estimateOrder() {
    // Von der Karte gewählt → exakte Werte, keine KI nötig.
    if (activeChain && orderItems.length > 0) {
      const title =
        orderItems.length <= 2 ? orderItems.map((i) => i.name).join(' + ') : `${activeChain.name} · ${orderItems.length} Artikel`
      if (isNew) showAnalysis(orderItems, title)
      else setAiResults(orderItems)
      setOrderQty({})
      setAddMode(null)
      return
    }
    if (!place && !restItem.trim()) return
    setAiBusy(true)
    setError(null)
    try {
      const items = await estimateFoodFromText(`${place ? place + ': ' : ''}${restItem.trim()}`)
      if (items.length === 0) setError('Nichts erkannt.')
      else {
        if (isNew) showAnalysis(items, restItem.trim() || place || 'Bestellung')
        else setAiResults(items)
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
    if (activeChain) {
      const remaining = {
        kcal: Math.max(0, kcalTarget - totals.kcal),
        protein: Math.max(0, (settings?.protein_target ?? 0) - totals.protein),
      }
      const combo = suggestCombo(activeChain.items, hasTarget ? remaining : { kcal: 800, protein: 40 })
      if (combo.length === 0) {
        setError('Kein Vorschlag möglich.')
        return
      }
      const items = combo.map((i) => menuItemToEstimate(i))
      const kcal = items.reduce((s, i) => s + i.kcal, 0)
      const note = hasTarget
        ? kcal > remaining.kcal
          ? 'Dein Budget ist fast aufgebraucht – das ist die kleinste sinnvolle Option.'
          : `Passt in deine restlichen ${remaining.kcal} kcal, mit möglichst viel Eiweiß.`
        : 'Viel Eiweiß für ca. 800 kcal.'
      if (isNew) showAnalysis(items, `Vorschlag: ${activeChain.name}`, note)
      else setAiResults(items)
      setAddMode(null)
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
        if (isNew) showAnalysis(res.items, `Vorschlag: ${place}`, res.note)
        else setAiResults(res.items)
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
    if (addRecipe.isPending) return
    setError(null)
    try {
      await addRecipe.mutateAsync({
        title: r.title,
        servings: r.servings,
        ingredients: r.ingredients,
        steps: r.steps,
        kcal: r.nutrition.kcal,
        protein: r.nutrition.protein,
        carbs: r.nutrition.carbs,
        fat: r.nutrition.fat,
        ...micro(r.nutrition),
        shared,
        author_name: user?.email?.split('@')[0] ?? null,
      })
      setRecipe(null)
      setCraving('')
    } catch (e) {
      setError(saveError(e))
    }
  }

  async function logRecipe(r: Recipe) {
    if (saving) return
    setError(null)
    try {
      await addEntry.mutateAsync({
        date: today,
        name: `🍳 ${r.title}`,
        amount_g: null,
        kcal: r.nutrition.kcal,
        protein: r.nutrition.protein,
        carbs: r.nutrition.carbs,
        fat: r.nutrition.fat,
        ...micro(r.nutrition),
        barcode: null,
        meal: addMeal(),
      })
      setRecipe(null)
      setCraving('')
    } catch (e) {
      setError(saveError(e, 'Loggen'))
    }
  }

  const estimateToEntry = (it: FoodEstimate) => ({
    date: today,
    name: it.name,
    amount_g: it.amount_g,
    kcal: it.kcal,
    protein: it.protein,
    carbs: it.carbs,
    fat: it.fat,
    ...micro(it),
    barcode: null,
    meal: addMeal(),
  })

  /** Alle Schätzungen in einem Insert übernehmen. */
  async function addEstimates(items: FoodEstimate[]) {
    if (saving) return
    setError(null)
    try {
      await addEntries.mutateAsync(items.map(estimateToEntry))
      setAiResults(null)
    } catch (e) {
      setError(saveError(e, 'Übernehmen'))
    }
  }

  /** Eine Schätzung übernehmen — nur diese verschwindet aus der Liste. */
  async function addEstimate(it: FoodEstimate) {
    if (saving) return
    setError(null)
    try {
      await addEntry.mutateAsync(estimateToEntry(it))
      setAiResults((prev) => {
        const rest = (prev ?? []).filter((x) => x !== it)
        return rest.length ? rest : null
      })
    } catch (e) {
      setError(saveError(e, 'Übernehmen'))
    }
  }

  function openSetup() {
    setSetupOpen(true)
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
    if (!pending || saving) return
    const m = scalePer100(pending.per100, amount)
    setError(null)
    try {
      await addEntry.mutateAsync({
        date: today,
        name: pending.name,
        amount_g: amount,
        kcal: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        ...micro(m),
        barcode: pending.barcode,
        meal: addMeal(),
      })
      setPending(null)
      setAddMode(null)
      setQuery('')
      setResults([])
    } catch (e) {
      setError(saveError(e))
    }
  }

  async function addManual() {
    if (saving) return
    if (!manual.name.trim()) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    setError(null)
    // leere/ungültige Felder als 0 speichern (DB: NOT NULL, ≥ 0)
    const v = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0)
    try {
      await addEntry.mutateAsync({
        date: today,
        name: manual.name.trim(),
        amount_g: v(manual.amount_g) || null,
        kcal: v(manual.kcal),
        protein: v(manual.protein),
        carbs: v(manual.carbs),
        fat: v(manual.fat),
        fiber: v(manual.fiber),
        sugar: v(manual.sugar),
        sat_fat: v(manual.sat_fat),
        salt: v(manual.salt),
        barcode: null,
        meal: addMeal(),
      })
      setManual({ name: '', amount_g: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sat_fat: 0, salt: 0 })
      setAddMode(null)
    } catch (e) {
      setError(saveError(e))
    }
  }

  const hasTarget = settings && settings.kcal_target > 0
  // Gleiches Tagesziel wie Tagesüberblick/Auswertung (Trainingstag + eigener Bonus, Standard 250).
  const kcalTarget = kcalTargetFor(settings, trainedToday, kcalBonus)
  const kcalLeft = hasTarget ? kcalTarget - totals.kcal : 0
  const dayKcal = useMemo(() => kcalByDate(allEntries), [allEntries])
  const sheetOpen = addMode !== null || !!pending || !!aiResults || !!recipe || !!planItems || !!analysis

  return (
    <div className="space-y-4">
      {/* Fehler ohne offenes Sheet (sonst zeigt das Sheet ihn selbst) */}
      {isNew && !sheetOpen && <ErrorLine error={error} />}

      {isNew ? (
        <>
          <header className="flex items-start justify-between gap-2" style={stagger(0)}>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{isToday ? 'Heute' : dayLabel(today, realToday)}</h1>
              <p className="text-sm text-cocoa-light">
                {new Date(`${today}T12:00:00`).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              {dietLabel && (
                <Link
                  to="/profile?s=goal"
                  className="mt-1.5 inline-flex max-w-full items-center rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-cocoa transition active:scale-95"
                  title="Ernährungsweise ändern"
                >
                  <span className="truncate">{dietLabel}</span>
                </Link>
              )}
            </div>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-cream text-cocoa transition active:scale-90"
              onClick={openSetup}
              aria-label={hasTarget ? 'Ziel bearbeiten' : 'Ziel festlegen'}
              title="Ziel"
            >
              <Target size={20} />
            </button>
          </header>

          <WeekStrip
            date={today}
            today={realToday}
            onChange={setDay}
            kcalByDate={dayKcal}
            targetFor={(d) => kcalTargetFor(settings, trainedOn(d, allSets), kcalBonus)}
          />

          {!isToday && (
            <div className="anim-fade flex items-center justify-between gap-2 rounded-full bg-sand px-3 py-1.5 text-xs text-cocoa-light">
              <span className="truncate">Vergangener Tag — neue Einträge landen hier</span>
              <button className="shrink-0 font-semibold text-brand" onClick={() => setDay(realToday)}>
                Zu heute
              </button>
            </div>
          )}

          <HeroCard
            totals={totals}
            targets={{
              kcal: hasTarget ? kcalTarget : 0,
              protein: settings?.protein_target ?? 0,
              carbs: settings?.carbs_target ?? 0,
              fat: settings?.fat_target ?? 0,
            }}
            trained={trainedToday}
            bonus={kcalBonus}
            onSetup={openSetup}
            style={stagger(1)}
          />

          {isToday && diet.fasting !== 'none' && <FastingCard entries={entries ?? []} style={stagger(2)} />}

          <QuickAddBar
            aiOn={!!aiOn}
            onPhoto={(file) => {
              setMealOverride(null)
              void handlePhoto(file)
            }}
            onScan={() => {
              setMealOverride(null)
              setError(null)
              setScanning(true)
            }}
            onSearch={() => {
              setMealOverride(null)
              go('search')
            }}
            onMore={() => {
              setMealOverride(null)
              go('menu')
            }}
            style={stagger(2)}
          />

          <RecentChips items={recent} onAdd={quickAdd} style={stagger(3)} />

          <div className="space-y-3">
            {MEALS.map((meal, i) => (
              <MealCard
                key={meal}
                meal={meal}
                entries={(entries ?? []).filter((e) => (e.meal ?? 'snack') === meal)}
                recommended={hasTarget ? mealRecommendation(meal, kcalTarget, mealSplit) : 0}
                onAdd={() => {
                  setMealOverride(meal)
                  go('menu')
                }}
                onEdit={setEditEntry}
                style={stagger(4 + i)}
              />
            ))}
          </div>

          <WaterRow date={today} style={stagger(8)} />
          {isToday && <BodyWeightCard />}
        </>
      ) : (
        <>
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Ernährung</h1>
              <p className="text-sm text-cocoa-light">
                {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button className="btn-ghost text-sm" onClick={openSetup}>
              {hasTarget ? 'Ziel' : 'Ziel einstellen'}
            </button>
          </header>

          {/* Fehler ohne offenes Sheet (sonst zeigt das Sheet ihn selbst) */}
          {!sheetOpen && <ErrorLine error={error} />}

          {/* Tagesübersicht */}
          <div className="card space-y-3">
            {hasTarget ? (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="tabular text-2xl font-bold text-cocoa">{totals.kcal}</div>
                    <div className="tabular text-xs text-cocoa-light">
                      von {kcalTarget} kcal{trainedToday && ' · +Trainingstag'}
                    </div>
                  </div>
                  <div className="tabular text-right text-sm text-cocoa-light">
                    {kcalLeft >= 0 ? `${kcalLeft} kcal übrig` : `${-kcalLeft} kcal drüber`}
                  </div>
                </div>
                <Bar value={totals.kcal} target={kcalTarget} />
                <div className="tabular grid grid-cols-3 gap-2 text-center text-xs">
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
                <div className="tabular grid grid-cols-4 gap-2 rounded-xl bg-sand-light p-2 text-center text-[11px] text-cocoa-light">
                  <div>
                    <div className="font-semibold text-cocoa">{totals.fiber} g</div>
                    Ballaststoffe
                  </div>
                  <div>
                    <div className="font-semibold text-cocoa">{totals.sugar} g</div>
                    Zucker
                  </div>
                  <div>
                    <div className="font-semibold text-cocoa">{totals.sat_fat} g</div>
                    ges. Fett
                  </div>
                  <div>
                    <div className="font-semibold text-cocoa">{totals.salt} g</div>
                    Salz
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
          <button className="btn-primary w-full gap-1.5" onClick={() => go('menu')}>
            <Plus size={18} strokeWidth={2.5} />
            Lebensmittel hinzufügen
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
                    className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-sand-dark/60"
                  >
                    <Plus size={14} className="text-cocoa-light" />
                    {e.name}
                    <span className="tabular text-cocoa-muted">{Math.round(e.kcal)}</span>
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
                    <span className="tabular text-xs text-cocoa-light">{Math.round(kcal)} kcal</span>
                  </div>
                  <div className="space-y-2">
                    {group.map((e) => (
                      <div key={e.id} className="card flex items-center justify-between">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => isNew && setEditEntry(e)}
                          disabled={!isNew}
                        >
                          <div className="font-medium">{e.name}</div>
                          <div className="tabular text-xs text-cocoa-light">
                            {e.amount_g ? `${e.amount_g} g · ` : ''}
                            {Math.round(e.kcal)} kcal · E {e.protein} / K {e.carbs} / F {e.fat}
                          </div>
                        </button>
                        <button
                          className="ml-2 shrink-0 px-2 text-cocoa-muted transition-colors duration-200 hover:text-red-500 dark:hover:text-red-400"
                          aria-label="Eintrag löschen"
                          onClick={() => deleteEntry.mutate(e, { onError: (err) => setError(saveError(err, 'Löschen')) })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {entries?.length === 0 && (
              <p className="text-center text-sm text-cocoa-light">
                {isToday ? 'Heute noch nichts erfasst.' : 'An diesem Tag nichts erfasst.'}
              </p>
            )}
          </div>

        </>
      )}

      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={(patch) => {
            updateEntry.mutate(
              { id: editEntry.id, ...patch },
              { onError: (err) => setError(saveError(err)) },
            )
            setEditEntry(null)
          }}
          onDelete={() => {
            deleteEntry.mutate(editEntry, { onError: (err) => setError(saveError(err, 'Löschen')) })
            setEditEntry(null)
          }}
        />
      )}

      {/* ----- Ziel-Setup ----- */}
      {setupOpen &&
        (isNew ? (
          <PremiumSheet
            title="Ziel & Körperdaten"
            subtitle="Nährwerte werden automatisch berechnet"
            leading={<IconTile icon={Target} />}
            onClose={() => setSetupOpen(false)}
          >
            <GoalEditor onSaved={() => setSetupOpen(false)} onCancel={() => setSetupOpen(false)} />
          </PremiumSheet>
        ) : (
          <div className="anim-fade fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="anim-sheet card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
              <h2 className="text-lg font-bold">Ziel & Körperdaten</h2>
              <GoalEditor onSaved={() => setSetupOpen(false)} onCancel={() => setSetupOpen(false)} />
            </div>
          </div>
        ))}

      {/* ----- Hinzufügen: Menü ----- */}
      {addMode === 'menu' && !pending && !(isNew && scanning) && (
        <FlowSheet
          premium={isNew}
          title="Hinzufügen"
          subtitle={mealOverride ? `zu ${MEAL_LABEL[mealOverride]}` : undefined}
          onClose={() => go(null)}
          dense
          classicBack={
            <button className="w-full pt-1 text-center text-sm text-cocoa-light underline" onClick={() => go(null)}>
              Abbrechen
            </button>
          }
        >
          {isNew ? (
            <>
              <ErrorNote error={error} />
              {aiOn && (
                <div>
                  <GroupLabel>Mit Buddy (KI)</GroupLabel>
                  <GroupList>
                    <GroupRow
                      accent
                      icon={<Camera size={18} />}
                      title="Foto"
                      subtitle="Essen fotografieren, Buddy schätzt"
                      onClick={() => go('photo')}
                    />
                    <GroupRow
                      icon={<MessageSquare size={18} />}
                      title="Beschreiben"
                      subtitle="z. B. „2 Eier und ein Brot"
                      onClick={() => go('aitext')}
                    />
                    <GroupRow
                      icon={<Store size={18} />}
                      title="Restaurant / unterwegs"
                      subtitle="Bestellung schätzen oder Vorschlag"
                      onClick={() => go('restaurant')}
                    />
                    <GroupRow
                      icon={<ChefHat size={18} />}
                      title="Rezept"
                      subtitle="Aus Kühlschrank-Foto oder Wunsch"
                      onClick={() => go('recipe')}
                    />
                    <GroupRow
                      icon={<ClipboardList size={18} />}
                      title="Tagesplan für heute"
                      subtitle="Passend zu deinem Ziel"
                      onClick={() => go('plan')}
                    />
                  </GroupList>
                </div>
              )}
              <div>
                <GroupLabel>Erfassen</GroupLabel>
                <GroupList>
                  <GroupRow
                    accent={!aiOn}
                    icon={<ScanBarcode size={18} />}
                    title="Barcode scannen"
                    subtitle="Produkt per Kamera"
                    onClick={() => {
                      setError(null)
                      setScanning(true)
                    }}
                  />
                  <GroupRow
                    icon={<Search size={18} />}
                    title="Suchen"
                    subtitle="In der Lebensmittel-Datenbank"
                    onClick={() => go('search')}
                  />
                  <GroupRow
                    icon={<PenLine size={18} />}
                    title="Manuell eingeben"
                    subtitle="Eigene Nährwerte"
                    onClick={() => go('manual')}
                  />
                </GroupList>
              </div>
            </>
          ) : (
            <>
              <ErrorLine error={error} />
              {aiOn && (
                <>
                  <button className="btn-primary w-full gap-2" onClick={() => go('photo')}>
                    <Camera size={18} />
                    Foto (KI)
                  </button>
                  <button className="btn-ghost w-full gap-2" onClick={() => go('aitext')}>
                    <MessageSquare size={18} className="text-cocoa-light" />
                    Text beschreiben (KI)
                  </button>
                  <button className="btn-ghost w-full gap-2" onClick={() => go('recipe')}>
                    <ChefHat size={18} className="text-cocoa-light" />
                    Rezept (Foto/Text, KI)
                  </button>
                  <button className="btn-ghost w-full gap-2" onClick={() => go('plan')}>
                    <ClipboardList size={18} className="text-cocoa-light" />
                    Tagesplan für heute (KI)
                  </button>
                  <button className="btn-ghost w-full gap-2" onClick={() => go('restaurant')}>
                    <Store size={18} className="text-cocoa-light" />
                    Restaurant / unterwegs (KI)
                  </button>
                </>
              )}
              <button
                className={aiOn ? 'btn-ghost w-full gap-2' : 'btn-primary w-full gap-2'}
                onClick={() => {
                  setError(null)
                  setScanning(true)
                }}
              >
                <ScanBarcode size={18} className={aiOn ? 'text-cocoa-light' : undefined} />
                Barcode scannen
              </button>
              <button className="btn-ghost w-full gap-2" onClick={() => go('search')}>
                <Search size={18} className="text-cocoa-light" />
                In Datenbank suchen
              </button>
              <button className="btn-ghost w-full gap-2" onClick={() => go('manual')}>
                <PenLine size={18} className="text-cocoa-light" />
                Manuell eingeben
              </button>
            </>
          )}
        </FlowSheet>
      )}

      {/* ----- Suche ----- */}
      {addMode === 'search' && !pending && !(isNew && scanning) && (
        <FlowSheet
          premium={isNew}
          title="Suchen"
          icon={Search}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          scroll
          classicBack={
            <button className="w-full text-center text-sm text-cocoa-light underline" onClick={() => go('menu')}>
              Zurück
            </button>
          }
        >
          {isNew ? (
            <>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void runSearch()
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cocoa-muted"
                  />
                  <input
                    className={`${BIG_INPUT} pl-10`}
                    type="search"
                    enterKeyHint="search"
                    autoFocus
                    aria-label="Lebensmittel suchen"
                    placeholder="z. B. Magerquark"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary shrink-0 rounded-2xl px-5"
                  disabled={searching || !query.trim()}
                >
                  {searching ? <Loader2 size={18} className="animate-spin" /> : 'Los'}
                </button>
              </form>
              <ErrorNote error={error} />

              {searching && results.length === 0 && (
                <GroupList>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-sand" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-sand" />
                      </div>
                      <div className="h-3 w-10 animate-pulse rounded-full bg-sand" />
                    </div>
                  ))}
                </GroupList>
              )}

              {results.length > 0 && (
                <div>
                  <GroupLabel right="pro 100 g">Ergebnisse</GroupLabel>
                  <GroupList>
                    {results.map((p, i) => (
                      <GroupRow
                        key={i}
                        title={p.name}
                        subtitle={`${p.brand ? `${p.brand} · ` : ''}${fmtNum(p.per100.protein)} g Eiweiß`}
                        right={<KcalBadge kcal={p.per100.kcal} />}
                        onClick={() => {
                          setPending(p)
                          setAmount(100)
                        }}
                      />
                    ))}
                  </GroupList>
                </div>
              )}

              {results.length === 0 && !searching && recent.length > 0 && (
                <div>
                  <GroupLabel>Zuletzt gegessen</GroupLabel>
                  <GroupList>
                    {recent.map((e) => (
                      <GroupRow
                        key={e.id}
                        icon={<History size={16} />}
                        title={e.name}
                        subtitle={`${e.amount_g ? `${fmtNum(e.amount_g)} g · ` : ''}${fmtNum(e.protein)} g Eiweiß`}
                        right={<KcalBadge kcal={e.kcal} />}
                        disabled={saving}
                        onClick={() => pickRecent(e)}
                      />
                    ))}
                  </GroupList>
                </div>
              )}
            </>
          ) : (
            <>
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
                      className="w-full rounded-lg bg-sand px-3 py-2 text-left transition-colors duration-200 hover:bg-sand-dark/60"
                      onClick={() => {
                        setPending(p)
                        setAmount(100)
                      }}
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="tabular text-xs text-cocoa-light">
                        {p.brand ? `${p.brand} · ` : ''}
                        {p.per100.kcal} kcal /100 g
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <ErrorLine error={error} />
            </>
          )}
        </FlowSheet>
      )}

      {/* ----- Mengen-Bestätigung (Barcode/Suche) ----- */}
      {pending &&
        (isNew ? (
          <PremiumSheet
            title={pending.name}
            subtitle={pending.brand ?? 'pro 100 g'}
            leading={<IconTile icon={UtensilsCrossed} />}
            onBack={() => {
              setError(null)
              setPending(null)
            }}
            onClose={() => {
              setPending(null)
              go(null)
            }}
            busy={saving}
            footer={
              <PrimaryButton onClick={confirmPending} disabled={saving} busy={addEntry.isPending}>
                {mealOverride ? `Zu ${MEAL_LABEL[mealOverride]} hinzufügen` : 'Hinzufügen'}
              </PrimaryButton>
            }
          >
            {(() => {
              const m = scalePer100(pending.per100, amount)
              return (
                <>
                  <div className="relative overflow-hidden rounded-3xl bg-cream p-4 text-center">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/15 blur-3xl" />
                    <div className="relative">
                      <div className="flex items-baseline justify-center gap-1.5">
                        <span className="tabular text-4xl font-bold tracking-tight text-cocoa">{m.kcal}</span>
                        <span className="text-sm text-cocoa-light">kcal</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MacroCell label="Eiweiß" value={m.protein} dot="bg-brand" />
                        <MacroCell label="Kohlenh." value={m.carbs} dot="bg-gold" />
                        <MacroCell label="Fett" value={m.fat} dot="bg-cocoa-light" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Stepper label="Menge (g)" value={amount} onChange={setAmount} step={10} min={0} suffix="g" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[50, 100, 150, 200, 250].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setAmount(g)}
                          className={`tabular rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                            amount === g ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
                          }`}
                        >
                          {g} g
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="tabular px-1 text-xs text-cocoa-muted">
                    pro 100 g: {pending.per100.kcal} kcal · E {pending.per100.protein} / K {pending.per100.carbs} / F{' '}
                    {pending.per100.fat}
                  </p>
                  <ErrorNote error={error} />
                </>
              )
            })()}
          </PremiumSheet>
        ) : (
          <div className="anim-fade fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="anim-sheet card w-full max-w-md space-y-3">
              <h2 className="text-lg font-bold">{pending.name}</h2>
              <p className="tabular text-xs text-cocoa-light">
                {pending.brand ? `${pending.brand} · ` : ''}
                pro 100 g: {pending.per100.kcal} kcal · E {pending.per100.protein} / K{' '}
                {pending.per100.carbs} / F {pending.per100.fat}
              </p>
              <Stepper label="Menge (g)" value={amount} onChange={setAmount} step={10} min={0} suffix="g" />
              <p className="tabular text-sm">
                = <strong>{scalePer100(pending.per100, amount).kcal} kcal</strong>, Eiweiß{' '}
                {scalePer100(pending.per100, amount).protein} g
              </p>
              <ErrorLine error={error} />
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setError(null)
                    setPending(null)
                  }}
                >
                  Abbrechen
                </button>
                <button className="btn-primary flex-1" onClick={confirmPending} disabled={saving}>
                  {addEntry.isPending ? 'Speichert…' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* ----- Manuelle Eingabe ----- */}
      {addMode === 'manual' && !pending && (
        <FlowSheet
          premium={isNew}
          title="Manuell eingeben"
          icon={PenLine}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={saving}
          scroll
          footer={
            isNew ? (
              <PrimaryButton onClick={addManual} disabled={saving} busy={addEntry.isPending}>
                Hinzufügen
              </PrimaryButton>
            ) : (
              <div className="flex gap-2 pt-1">
                <button className="btn-ghost flex-1" onClick={() => go('menu')}>
                  Zurück
                </button>
                <button className="btn-primary flex-1" onClick={addManual} disabled={saving}>
                  {addEntry.isPending ? 'Speichert…' : 'Hinzufügen'}
                </button>
              </div>
            )
          }
        >
          <div>
            <label className="label" htmlFor="manual-name">
              Name
            </label>
            <input
              id="manual-name"
              className={isNew ? BIG_INPUT : 'input'}
              autoFocus
              placeholder={isNew ? 'z. B. Proteinriegel' : undefined}
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
            />
          </div>
          {isNew ? (
            <>
              <div>
                <GroupLabel>Hauptwerte</GroupLabel>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_FIELDS.slice(0, 5).map(([key, lbl]) => (
                    <ManualField key={key} label={lbl} value={manual[key]} onChange={(v) => setManual({ ...manual, [key]: v })} />
                  ))}
                </div>
              </div>
              <div>
                <GroupLabel>Optional</GroupLabel>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_FIELDS.slice(5).map(([key, lbl]) => (
                    <ManualField key={key} label={lbl} value={manual[key]} onChange={(v) => setManual({ ...manual, [key]: v })} />
                  ))}
                </div>
              </div>
              <ErrorNote error={error} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {MANUAL_FIELDS.map(([key, lbl]) => (
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
              <ErrorLine error={error} />
            </>
          )}
        </FlowSheet>
      )}

      {/* ----- KI: Restaurant / unterwegs ----- */}
      {addMode === 'restaurant' && (
        <FlowSheet
          premium={isNew}
          title="Restaurant / unterwegs"
          icon={Store}
          classicIcon
          subtitle={
            isNew && hasTarget
              ? `Noch offen: ${Math.max(0, kcalTarget - totals.kcal)} kcal · ${Math.max(
                  0,
                  (settings?.protein_target ?? 0) - totals.protein,
                )} g Eiweiß`
              : undefined
          }
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            isNew ? (
              <>
                <PrimaryButton
                  onClick={estimateOrder}
                  disabled={aiBusy || (!!activeChain && orderItems.length === 0 && !restItem.trim())}
                  busy={aiBusy}
                >
                  {orderItems.length > 0
                    ? `${orderItems.length} ${orderItems.length === 1 ? 'Artikel' : 'Artikel'} eintragen · ${orderKcal} kcal`
                    : activeChain
                      ? 'Nicht dabei? Mit KI schätzen'
                      : 'Bestellung schätzen'}
                </PrimaryButton>
                <button className="btn-ghost w-full gap-1.5 rounded-2xl py-3" onClick={suggestForBudget} disabled={aiBusy}>
                  <Bot size={16} className="text-brand" />
                  Was passt zu meinem Budget?
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button className="btn-primary" onClick={estimateOrder} disabled={aiBusy}>
                  {aiBusy ? '…' : orderItems.length > 0 ? `${orderItems.length} eintragen` : 'Bestellung schätzen'}
                </button>
                <button className="btn-ghost gap-1.5" onClick={suggestForBudget} disabled={aiBusy}>
                  <Bot size={16} className="text-cocoa-light" />
                  Passt zum Budget
                </button>
              </div>
            )
          }
          classicBack={
            <button className="w-full text-center text-sm text-cocoa-light underline" onClick={() => go('menu')}>
              Zurück
            </button>
          }
        >
          {!isNew && hasTarget && (
            <p className="tabular text-xs text-cocoa-light">
              Noch offen heute: {Math.max(0, kcalTarget - totals.kcal)} kcal ·{' '}
              {Math.max(0, (settings?.protein_target ?? 0) - totals.protein)} g Eiweiß
            </p>
          )}
          <div>
            {isNew && <GroupLabel>Wo isst du?</GroupLabel>}
            <div className={isNew ? '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1' : '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1'}>
              {[...Object.entries(CHAIN_BADGE).map(([id, b]) => ({ id, name: b.name })), ...PLACES.map((p) => ({ id: '', name: p }))].map(
                ({ id, name: p }) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPlace(place === p ? '' : p)
                      setOrderQty({})
                    }}
                    aria-pressed={place === p}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 text-sm transition-colors duration-200 ${
                      id ? 'pl-1.5 pr-3' : 'px-3'
                    } ${
                      place === p ? 'bg-brand text-on-brand' : isNew ? 'bg-cream text-cocoa' : 'bg-sand text-cocoa'
                    } ${isNew ? 'font-medium' : ''}`}
                  >
                    {id && <ChainBadge id={id} size={22} />}
                    {p}
                  </button>
                ),
              )}
            </div>
          </div>
          <div>
            {isNew && <GroupLabel>Was bestellst du?</GroupLabel>}
            <div className="flex gap-2">
              <input
                className={isNew ? BIG_INPUT : 'input'}
                placeholder={
                  activeChain
                    ? 'Auf der Karte suchen, z. B. Big Mac'
                    : 'Küche/Restaurant & Gericht, z. B. Indisch: Chicken Tikka mit Reis'
                }
                value={restItem}
                onChange={(e) => setRestItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && estimateOrder()}
              />
              <MicButton onResult={(t) => setRestItem((v) => (v ? v + ' ' + t : t))} />
            </div>
          </div>
          {activeChain && (
            <ChainMenu
              chain={activeChain}
              query={restItem}
              qty={orderQty}
              onQty={(name, n) => setOrderQty((q) => ({ ...q, [name]: Math.max(0, n) }))}
            />
          )}
          {place && chains && !activeChain && chains.length > 0 && (
            <p className="text-xs text-cocoa-muted">Für „{place}" schätzt die KI die Nährwerte.</p>
          )}
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- KI: Foto + optionale Notiz ----- */}
      {addMode === 'photo' && (
        <FlowSheet
          premium={isNew}
          title={isNew ? 'Foto' : 'Essen fotografieren'}
          icon={Camera}
          classicIcon
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            isNew ? (
              <label
                className={`btn-primary flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25 ${
                  aiBusy ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {aiBusy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                {aiBusy ? 'Analysiere…' : 'Foto aufnehmen'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handlePhoto(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            ) : undefined
          }
          classicBack={
            <button className="w-full text-center text-sm text-cocoa-light underline" onClick={() => go('menu')}>
              Zurück
            </button>
          }
        >
          <p className={isNew ? 'text-sm text-cocoa-light' : 'text-xs text-cocoa-light'}>
            Optional dazu schreiben oder diktieren, was drin ist oder wie viel — macht die
            Schätzung genauer.
          </p>
          <div className="flex gap-2">
            <input
              className={isNew ? BIG_INPUT : 'input'}
              placeholder="z. B. mit extra Käse, ca. 300 g, dazu Reis"
              value={photoHint}
              onChange={(e) => setPhotoHint(e.target.value)}
            />
            <MicButton onResult={(t) => setPhotoHint((v) => (v ? v + ' ' + t : t))} />
          </div>
          {!isNew && (
            <label className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2">
              {!aiBusy && <Camera size={18} />}
              {aiBusy ? '… analysiere' : 'Foto aufnehmen'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void handlePhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          )}
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- KI: Text beschreiben ----- */}
      {addMode === 'aitext' && (
        <FlowSheet
          premium={isNew}
          title="Mahlzeit beschreiben"
          icon={MessageSquare}
          classicIcon
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            isNew ? (
              <PrimaryButton onClick={handleAiText} disabled={aiBusy || !aiText.trim()} busy={aiBusy}>
                Schätzen
              </PrimaryButton>
            ) : (
              <div className="flex gap-2 pt-1">
                <button className="btn-ghost flex-1" onClick={() => go('menu')}>
                  Zurück
                </button>
                <button className="btn-primary flex-1" onClick={handleAiText} disabled={aiBusy}>
                  {aiBusy ? '…' : 'Schätzen'}
                </button>
              </div>
            )
          }
        >
          <p className={isNew ? 'text-sm text-cocoa-light' : 'text-xs text-cocoa-light'}>
            Schreib einfach, was du gegessen hast — die KI schätzt die Nährwerte.
          </p>
          <div className="flex gap-2">
            <input
              className={isNew ? BIG_INPUT : 'input'}
              autoFocus
              placeholder="z. B. 2 Eier, 80 g Haferflocken, 1 Banane"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiText()}
            />
            <MicButton onResult={(t) => setAiText((v) => (v ? v + ' ' + t : t))} />
          </div>
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- KI: Ergebnis prüfen & übernehmen ----- */}
      {aiResults && (
        <FlowSheet
          premium={isNew}
          title="KI-Schätzung"
          icon={Sparkles}
          z="z-30"
          onClose={() => {
            setError(null)
            setAiResults(null)
          }}
          busy={saving}
          scroll
          footer={
            isNew ? (
              <PrimaryButton onClick={() => addEstimates(aiResults)} disabled={saving} busy={addEntries.isPending}>
                Alle übernehmen
              </PrimaryButton>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setError(null)
                    setAiResults(null)
                  }}
                  disabled={saving}
                >
                  Verwerfen
                </button>
                <button className="btn-primary flex-1" onClick={() => addEstimates(aiResults)} disabled={saving}>
                  {addEntries.isPending ? 'Speichert…' : 'Alle übernehmen'}
                </button>
              </div>
            )
          }
        >
          <p className="text-xs text-cocoa-light">
            Schätzwerte — vor dem Übernehmen kurz prüfen. Zum Feinjustieren einzeln übernehmen und
            danach bearbeiten.
          </p>
          {isNew ? (
            <GroupList>
              {aiResults.map((it, i) => (
                <GroupRow
                  key={i}
                  title={it.name}
                  subtitle={`${it.amount_g ? `${it.amount_g} g · ` : ''}${it.kcal} kcal · E ${it.protein} / K ${it.carbs} / F ${it.fat}`}
                  right={
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                      <Plus size={16} strokeWidth={2.5} />
                    </span>
                  }
                  disabled={saving}
                  onClick={() => addEstimate(it)}
                />
              ))}
            </GroupList>
          ) : (
            <ul className="space-y-2">
              {aiResults.map((it, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-sand px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="tabular text-xs text-cocoa-light">
                      {it.amount_g ? `${it.amount_g} g · ` : ''}
                      {it.kcal} kcal · E {it.protein} / K {it.carbs} / F {it.fat}
                    </div>
                  </div>
                  <button
                    className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"
                    onClick={() => addEstimate(it)}
                    disabled={saving}
                    aria-label="Übernehmen"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- KI: Mahlzeit-Analyse (neuer Modus) ----- */}
      {isNew && analysis && (
        <MealAnalysisSheet
          photo={analysis.photo}
          status={analysis.status}
          result={analysis.result}
          resultId={String(analysis.id)}
          error={analysis.error}
          onRetry={() => analysis.source && void runAnalysis(analysis.source)}
          onClose={closeAnalysis}
          onSave={saveAnalysis}
          defaultMeal={addMeal()}
          day={{
            kcalTarget,
            proteinTarget: settings?.protein_target ?? 0,
            carbsTarget: settings?.carbs_target ?? 0,
            fatTarget: settings?.fat_target ?? 0,
            goal: settings?.goal ?? null,
            eaten: { kcal: totals.kcal, protein: totals.protein },
          }}
        />
      )}

      {/* ----- KI: Kühlschrank-Rezept ----- */}
      {addMode === 'recipe' && (
        <FlowSheet
          premium={isNew}
          title={isNew ? 'Rezept' : 'Rezept aus Kühlschrank'}
          icon={ChefHat}
          classicIcon
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          classicBack={
            <button className="w-full text-center text-sm text-cocoa-light underline" onClick={() => go('menu')}>
              Zurück
            </button>
          }
        >
          <p className={isNew ? 'text-sm text-cocoa-light' : 'text-xs text-cocoa-light'}>
            Worauf hast du Lust? Dann den Kühlschrank/die Zutaten fotografieren — die KI macht dir
            ein passendes Rezept.
          </p>
          {isNew ? (
            <>
              <div className="space-y-2">
                <GroupLabel>Aus dem Kühlschrank</GroupLabel>
                <input
                  className={BIG_INPUT}
                  placeholder="z. B. was Herzhaftes, proteinreich, schnell"
                  value={craving}
                  onChange={(e) => setCraving(e.target.value)}
                />
                <label
                  className={`btn-primary flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-base ${
                    aiBusy ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  {aiBusy ? <Loader2 size={18} className="animate-spin" /> : <Refrigerator size={18} />}
                  {aiBusy ? 'Buddy kocht…' : 'Kühlschrank fotografieren'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFridge(e.target.files?.[0])}
                  />
                </label>
              </div>
              <ErrorNote error={error} />
              <div className="flex items-center gap-3 text-xs font-medium text-cocoa-muted">
                <span className="h-px flex-1 bg-sand-dark/60" /> oder ohne Foto
                <span className="h-px flex-1 bg-sand-dark/60" />
              </div>
              <div className="space-y-2">
                <GroupLabel>Nach Wunsch</GroupLabel>
                <div className="flex gap-2">
                  <input
                    className={BIG_INPUT}
                    placeholder="z. B. veganes Frühstück, 40 g Eiweiß"
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && genRecipeText()}
                  />
                  <MicButton onResult={(t) => setRecipeText((v) => (v ? v + ' ' + t : t))} />
                </div>
                <button
                  className="btn-ghost w-full gap-1.5 rounded-2xl py-3"
                  onClick={genRecipeText}
                  disabled={aiBusy || !recipeText.trim()}
                >
                  <Sparkles size={16} className="text-brand" />
                  Rezept erstellen
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                className="input"
                placeholder="z. B. was Herzhaftes, proteinreich, schnell"
                value={craving}
                onChange={(e) => setCraving(e.target.value)}
              />
              <label className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2">
                {!aiBusy && <Refrigerator size={18} />}
                {aiBusy ? '… koche' : 'Kühlschrank fotografieren'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFridge(e.target.files?.[0])}
                />
              </label>
              <ErrorLine error={error} />
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
            </>
          )}
        </FlowSheet>
      )}

      {/* ----- Rezept-Ergebnis ----- */}
      {recipe && (
        <FlowSheet
          premium={isNew}
          title={recipe.title}
          icon={ChefHat}
          subtitle={isNew ? `${recipe.servings} Portion(en)` : undefined}
          z="z-30"
          onClose={() => {
            setError(null)
            setRecipe(null)
          }}
          busy={addRecipe.isPending || saving}
          scroll
          footer={
            isNew ? (
              <>
                <PrimaryButton onClick={() => logRecipe(recipe)} disabled={addRecipe.isPending || saving} busy={addEntry.isPending}>
                  {mealOverride ? `Zu ${MEAL_LABEL[mealOverride]} loggen` : 'Loggen'}
                </PrimaryButton>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn-ghost gap-1.5 rounded-2xl"
                    onClick={() => saveRecipe(recipe, false)}
                    disabled={addRecipe.isPending || saving}
                  >
                    <Save size={16} className="text-cocoa-light" />
                    Speichern
                  </button>
                  <button
                    className="btn-ghost gap-1.5 rounded-2xl"
                    onClick={() => saveRecipe(recipe, true)}
                    disabled={addRecipe.isPending || saving}
                  >
                    <Share2 size={16} className="text-cocoa-light" />
                    Teilen
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  className="btn-ghost gap-1.5"
                  onClick={() => saveRecipe(recipe, false)}
                  disabled={addRecipe.isPending || saving}
                >
                  <Save size={16} className="text-cocoa-light" />
                  Speichern
                </button>
                <button
                  className="btn-ghost gap-1.5"
                  onClick={() => saveRecipe(recipe, true)}
                  disabled={addRecipe.isPending || saving}
                >
                  <Share2 size={16} className="text-cocoa-light" />
                  Speichern & teilen
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setError(null)
                    setRecipe(null)
                  }}
                  disabled={addRecipe.isPending || saving}
                >
                  Schließen
                </button>
                <button className="btn-primary" onClick={() => logRecipe(recipe)} disabled={addRecipe.isPending || saving}>
                  {addEntry.isPending ? 'Speichert…' : 'Loggen'}
                </button>
              </div>
            )
          }
        >
          {isNew ? (
            <>
              <div className="rounded-2xl bg-cream p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular text-3xl font-bold tracking-tight text-cocoa">{recipe.nutrition.kcal}</span>
                  <span className="text-sm text-cocoa-light">kcal pro Portion</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MacroCell label="Eiweiß" value={recipe.nutrition.protein} dot="bg-brand" />
                  <MacroCell label="Kohlenh." value={recipe.nutrition.carbs} dot="bg-gold" />
                  <MacroCell label="Fett" value={recipe.nutrition.fat} dot="bg-cocoa-light" />
                </div>
              </div>
              <div>
                <GroupLabel right={recipe.ingredients.length}>Zutaten</GroupLabel>
                <GroupList>
                  {recipe.ingredients.map((it, i) => (
                    <div key={i} className="px-4 py-2.5 text-[15px] text-cocoa">
                      {it}
                    </div>
                  ))}
                </GroupList>
              </div>
              <div>
                <GroupLabel>Zubereitung</GroupLabel>
                <ol className="space-y-3">
                  {recipe.steps.map((st, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-cocoa">
                      <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                        {i + 1}
                      </span>
                      <span className="min-w-0">{st}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <ErrorNote error={error} />
            </>
          ) : (
            <>
              <p className="tabular text-xs text-cocoa-light">
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
              <ErrorLine error={error} />
            </>
          )}
        </FlowSheet>
      )}

      {/* ----- KI: Essensplan Eingabe ----- */}
      {addMode === 'plan' && (
        <FlowSheet
          premium={isNew}
          title="Tagesplan für heute"
          icon={ClipboardList}
          classicIcon
          subtitle={
            isNew
              ? `Ziel: ~${settings?.kcal_target || 2000} kcal · ${settings?.protein_target || 130} g Eiweiß`
              : undefined
          }
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            isNew ? (
              <PrimaryButton onClick={genPlan} disabled={aiBusy} busy={aiBusy}>
                {aiBusy ? 'Erstelle…' : 'Plan erstellen'}
              </PrimaryButton>
            ) : (
              <div className="flex gap-2 pt-1">
                <button className="btn-ghost flex-1" onClick={() => go('menu')}>
                  Zurück
                </button>
                <button className="btn-primary flex-1" onClick={genPlan} disabled={aiBusy}>
                  {aiBusy ? 'Erstelle…' : 'Plan erstellen'}
                </button>
              </div>
            )
          }
        >
          {isNew ? (
            <p className="text-sm text-cocoa-light">Wünsche? Buddy plant Frühstück bis Snack passend zu deinem Ziel.</p>
          ) : (
            <p className="tabular text-xs text-cocoa-light">
              Ziel: ~{settings?.kcal_target || 2000} kcal · {settings?.protein_target || 130} g Eiweiß.
              Wünsche?
            </p>
          )}
          <div className="flex gap-2">
            <input
              className={isNew ? BIG_INPUT : 'input'}
              placeholder="z. B. high protein, kein Schwein, schnell"
              value={planWish}
              onChange={(e) => setPlanWish(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && genPlan()}
            />
            <MicButton onResult={(t) => setPlanWish((v) => (v ? v + ' ' + t : t))} />
          </div>
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- Essensplan Ergebnis ----- */}
      {planItems && (
        <FlowSheet
          premium={isNew}
          title="Essensplan"
          icon={ClipboardList}
          subtitle={
            isNew
              ? `${planItems.reduce((s, i) => s + i.kcal, 0)} kcal · ${planItems.reduce((s, i) => s + i.protein, 0)} g Eiweiß`
              : undefined
          }
          z="z-30"
          onClose={() => {
            setError(null)
            setPlanItems(null)
          }}
          busy={saving}
          scroll
          footer={
            isNew ? (
              <PrimaryButton onClick={() => logPlan(planItems)} disabled={saving} busy={addEntries.isPending}>
                Alle loggen
              </PrimaryButton>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setError(null)
                    setPlanItems(null)
                  }}
                  disabled={saving}
                >
                  Verwerfen
                </button>
                <button className="btn-primary flex-1" onClick={() => logPlan(planItems)} disabled={saving}>
                  {addEntries.isPending ? 'Speichert…' : 'Alle loggen'}
                </button>
              </div>
            )
          }
        >
          {planNote && <p className={isNew ? 'text-sm text-cocoa-light' : 'text-xs text-cocoa-light'}>{planNote}</p>}
          {isNew ? (
            <GroupList>
              {planItems.map((it, i) => (
                <div key={i} className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2.5">
                  <span className="w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
                    {MEAL_LABEL[it.meal]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-cocoa">{it.name}</span>
                    <span className="tabular block truncate text-xs text-cocoa-light">
                      E {it.protein} / K {it.carbs} / F {it.fat}
                    </span>
                  </span>
                  <KcalBadge kcal={it.kcal} />
                </div>
              ))}
            </GroupList>
          ) : (
            <>
              <ul className="space-y-1.5">
                {planItems.map((it, i) => (
                  <li key={i} className="rounded-lg bg-sand px-3 py-2">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="tabular text-xs text-cocoa-light">
                      {MEAL_LABEL[it.meal]} · {it.kcal} kcal · E {it.protein} / K {it.carbs} / F {it.fat}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="tabular text-xs text-cocoa-muted">
                Summe: {planItems.reduce((s, i) => s + i.kcal, 0)} kcal ·{' '}
                {planItems.reduce((s, i) => s + i.protein, 0)} g Eiweiß
              </div>
            </>
          )}
          {isNew ? <ErrorNote error={error} /> : <ErrorLine error={error} />}
        </FlowSheet>
      )}

      {/* ----- Kamera-Scanner ----- */}
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  )
}

type EntryPatch = Partial<Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>>
const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sat_fat', 'salt'] as const

/** Eintrag nachträglich ändern: Menge (Nährwerte skalieren mit), Mahlzeit, Name — oder löschen. */
function EditEntrySheet({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: FoodEntry
  onClose: () => void
  onSave: (patch: EntryPatch) => void
  onDelete: () => void
}) {
  const hasGrams = !!entry.amount_g && entry.amount_g > 0
  const [name, setName] = useState(entry.name)
  const [amount, setAmount] = useState(hasGrams ? String(entry.amount_g) : '1')
  const [meal, setMeal] = useState<Meal>((entry.meal ?? 'snack') as Meal)

  const num = parseFloat(amount.replace(',', '.'))
  const factor = Number.isFinite(num) && num > 0 ? (hasGrams ? num / entry.amount_g! : num) : 1
  const r1 = (v: number) => Math.round(v * 10) / 10
  const kcal = Math.round(entry.kcal * factor)

  function save() {
    const patch: EntryPatch = { name: name.trim() || entry.name, meal }
    if (factor !== 1) {
      for (const k of NUTRIENTS) patch[k] = k === 'kcal' ? kcal : r1(entry[k] * factor)
      if (hasGrams) patch.amount_g = Math.round(num)
    }
    onSave(patch)
  }

  return (
    <Sheet title="Eintrag bearbeiten" onClose={onClose}>
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">{hasGrams ? 'Menge (g)' : 'Portionen (×)'}</label>
        <input
          className="input tabular"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="tabular mt-1 text-xs text-cocoa-light">
          {kcal} kcal · E {r1(entry.protein * factor)} / K {r1(entry.carbs * factor)} / F {r1(entry.fat * factor)}
        </p>
      </div>
      <div>
        <label className="label">Mahlzeit</label>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m as Meal)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
                meal === m ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
              }`}
            >
              {MEAL_LABEL[m as Meal]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className="btn grid h-11 w-11 shrink-0 place-items-center bg-sand p-0 text-cocoa-light hover:text-red-500"
          onClick={onDelete}
          aria-label="Eintrag löschen"
        >
          <Trash2 size={18} />
        </button>
        <button className="btn-primary flex-1" onClick={save}>
          Speichern
        </button>
      </div>
    </Sheet>
  )
}
