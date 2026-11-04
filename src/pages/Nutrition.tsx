import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Camera,
  ChefHat,
  ClipboardList,
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
  BookOpen,
  CalendarDays,
  ChevronDown,
  ShoppingBasket,
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
import { GOAL_LABEL, fiberTarget, scalePer100, sumEntries } from '../lib/nutrition'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { fetchProductByBarcode, searchProducts, type FoodProduct } from '../lib/openfoodfacts'
import {
  analyzeMeal,
  estimateFoodFromText,
  mealPlanForDay,
  recipeFromFridge,
  recipeFromText,
  suggestOrder,
  menuFromPhoto,
  type MenuPick,
  type FoodEstimate,
  type MealAnalysis,
  type MealPlanItem,
  type Recipe,
} from '../lib/ai'
import { useAiGate } from '../hooks/usePremium'
import { PlusBadge } from '../components/premium/PlusBadge'
import { mealVerdictText } from '../lib/freeTexts'
import { GoalEditor } from '../components/GoalEditor'
import { WeekStrip } from '../components/nutrition-home/WeekStrip'
import { HeroCard } from '../components/nutrition-home/HeroCard'
import { QuickAddBar } from '../components/nutrition-home/QuickAddBar'
import { NutrientExtras } from '../components/food/NutrientExtras'
import { RecentFoods } from '../components/nutrition-home/RecentFoods'
import { lastMealCopy, recentFoods, repeatEntry } from '../lib/recentFoods'
import { scaleMicros } from '../lib/micros'
import { MicroCard } from '../components/nutrition-home/MicroCard'
import { MealCard } from '../components/nutrition-home/MealCard'
import { SaveMealSheet, SavedMealChips } from '../components/nutrition-home/SavedMeals'
import { entriesFromSaved, type SavedMeal } from '../lib/savedMeals'
import { WaterRow } from '../components/nutrition-home/WaterRow'
import { SupplementCard } from '../components/nutrition-home/SupplementCard'
import { useSupplements, useToggleDose } from '../hooks/useSupplements'
import { useSetWater, useWater } from '../hooks/useWater'
import { FastingCard } from '../components/nutrition-home/FastingCard'
import { dietShortLabel } from '../lib/dietStyle'
import { stagger } from '../components/nutrition-home/motion'
import { kcalByDate, mealRecommendation } from '../lib/nutritionHome'
import { dayLabel } from '../lib/day'
import type { FoodEntry } from '../types'
import { useNutrientPins, useNutritionPrefs } from '../hooks/usePrefsSync'
import { ToolTiles } from '../components/home/ToolTiles'
import { TabHeader } from '../components/ui/TabHeader'
import { QuestStrip } from '../components/buddy/QuestStrip'
import { CustomizeHome } from '../components/home/CustomizeHome'
import { useHomeCards } from '../lib/homeCards'
import { fluidOf } from '../lib/fluid'
import { ChainMenu } from '../components/food/ChainMenu'
import {
  CHAIN_BADGE,
  findChain,
  loadChains,
  matchChains,
  menuItemToEstimate,
  suggestCombo,
  suggestCombos,
  type Chain,
  type Combo,
} from '../lib/fastfood'
import { BuddyTip } from '../components/buddy/BuddyTip'

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

/** „Anderes Restaurant“ (ohne Kette): Speisekarte fotografieren oder beschreiben. */
const OTHER_PLACE = 'Restaurant'
/** Hinzufügen-Modi, die nur mit KI (Buddy Plus) gehen. Restaurant bleibt offen (Ketten-Karten ohne KI). */
const AI_MODES = ['photo', 'aitext', 'recipe', 'plan'] as const
const RECENT_PLACES_KEY = 'recent_places'

/** Zuletzt genutzte Ketten zuerst (schneller unterwegs). */
function recentFirst(ids: string[]): string[] {
  let recent: string[] = []
  try {
    recent = JSON.parse(localStorage.getItem(RECENT_PLACES_KEY) || '[]')
  } catch {
    recent = []
  }
  return [...ids].sort((a, b) => {
    const ia = recent.indexOf(a)
    const ib = recent.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}

/** Felder der manuellen Eingabe (die ersten sechs sind die Hauptwerte, inkl. Ballaststoffe). */
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
const MANUAL_MAIN = 6

const fmtNum = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/** Sheet der Hinzufügen-Abläufe (Griff, Titel, runder Schließen-Knopf, feste Primäraktion unten). */
function FlowSheet({
  title,
  subtitle,
  icon: Icon,
  onClose,
  onBack,
  busy = false,
  footer,
  children,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  onClose: () => void
  onBack?: () => void
  busy?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
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
  const nutrientPins = useNutrientPins()
  const { user } = useAuth()
  const addRecipe = useAddRecipe()
  // Ausgewählter Tag (?date=YYYY-MM-DD) — so lassen sich vergangene Tage nachtragen/korrigieren.
  const [params, setParams] = useSearchParams()
  const realToday = todayLocal()
  const paramDate = params.get('date')

  // Schnell-Aktion aus der Trink-Erinnerung (?addwater=250): einmal eintragen, dann Parameter entfernen
  const { data: waterToday, isFetched: waterLoaded } = useWater(realToday)
  const setWater = useSetWater()
  const [waterNote, setWaterNote] = useState<string | null>(null)
  const addWaterParam = params.get('addwater')
  useEffect(() => {
    if (!addWaterParam || !waterLoaded) return
    const ml = Math.min(2000, Math.max(0, Number(addWaterParam) || 0))
    const next = new URLSearchParams(params)
    next.delete('addwater')
    setParams(next, { replace: true })
    if (!ml) return
    setWater.mutate({ date: realToday, ml: (waterToday?.ml ?? 0) + ml })
    setWaterNote(`+${ml} ml eingetragen 💧`)
    const t = setTimeout(() => setWaterNote(null), 3500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addWaterParam, waterLoaded])

  // KI-Funktionen: sichtbar, sobald der Server KI hat; nutzbar nur mit Buddy Plus (sonst Plus-Sheet).
  const gate = useAiGate()

  // Direkteinstieg aus Suche/Widgets: ?add=photo|search|restaurant|aitext|recipe|plan|manual|menu
  const addParam = params.get('add')
  useEffect(() => {
    if (!addParam) return
    // KI-Modi erst nach dem KI-Status prüfen (Plus-Sperre)
    const aiMode = (AI_MODES as readonly string[]).includes(addParam)
    if (aiMode && !gate.ready) return
    const next = new URLSearchParams(params)
    next.delete('add')
    setParams(next, { replace: true })
    const modes = ['photo', 'search', 'restaurant', 'aitext', 'recipe', 'plan', 'manual', 'menu'] as const
    if (aiMode && !gate.requirePlus()) return
    if ((modes as readonly string[]).includes(addParam)) setAddMode(addParam as (typeof modes)[number])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam, gate.ready])

  // „Genommen“ aus der Supplement-Erinnerung (?supp=<id>&slot=HH:MM)
  const toggleDose = useToggleDose()
  const suppParam = params.get('supp')
  const slotParam = params.get('slot')
  useEffect(() => {
    if (!suppParam || !slotParam) return
    const next = new URLSearchParams(params)
    next.delete('supp')
    next.delete('slot')
    setParams(next, { replace: true })
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slotParam)) return
    toggleDose.mutate({ supplementId: suppParam, date: realToday, slot: slotParam, taken: true })
    setWaterNote('💊 Als genommen abgehakt')
    const t = setTimeout(() => setWaterNote(null), 3500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppParam, slotParam])
  // Vergangene Tage per ?date=… (Tagesnavigation)
  const today = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) && paramDate < realToday ? paramDate : realToday
  const isToday = today === realToday
  const setDay = (d: string) => setParams(d >= realToday ? {} : { date: d }, { replace: true })
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null)
  const { data: settings } = useNutritionSettings()
  const diet = useDietStyle()
  const [homeCards] = useHomeCards()
  const { data: supplements } = useSupplements()
  const dietLabel = dietShortLabel(diet)
  const { data: entries } = useFoodEntries(today)
  const { data: allEntries } = useAllFoodEntries()
  const { data: allSets } = useAllSets()
  const trainedToday = trainedOn(today, allSets)

  // „Zuletzt gegessen": passend zur Mahlzeit, oft Gegessenes und heute schon Gegessenes zuerst
  const recentFor = (meal: Meal) => recentFoods(allEntries ?? [], meal, today)

  /** Ein Lebensmittel mit derselben Menge nochmal eintragen (Menü bleibt offen). */
  function quickRepeat(e: FoodEntry, meal: Meal) {
    setError(null)
    addEntry.mutate(repeatEntry(e, today, meal), { onError: (err) => setError(saveError(err)) })
  }

  /** „Wie gestern“: ganze Mahlzeit vom letzten Mal übernehmen. */
  function copyMeal(meal: Meal) {
    const copy = lastMealCopy(allEntries ?? [], meal, today)
    if (!copy || addEntries.isPending) return
    setError(null)
    addEntries.mutate(
      copy.items.map((e) => repeatEntry(e, today, meal)),
      {
        onSuccess: () => flashNote(`${MEAL_LABEL[meal]} wie ${copy.label} eingetragen`),
        onError: (err) => setError(saveError(err)),
      },
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
        isDrink: fluidOf(e) > 0,
        per100: {
          kcal: Math.round(e.kcal * k),
          protein: r1(e.protein),
          carbs: r1(e.carbs),
          fat: r1(e.fat),
          fiber: r1(e.fiber),
          sugar: r1(e.sugar),
          sat_fat: r1(e.sat_fat),
          salt: Math.round((e.salt ?? 0) * k * 100) / 100,
          ...(e.micros ? { micros: scaleMicros(e.micros, k) ?? undefined } : {}),
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
        ...(fluidOf(e) > 0 ? { fluid_ml: fluidOf(e) } : {}),
      },
      { onSuccess: () => go(null), onError: (err) => setError(saveError(err)) },
    )
  }
  const addEntry = useAddFoodEntry()
  const addEntries = useAddFoodEntries()
  const saving = addEntry.isPending || addEntries.isPending
  const deleteEntry = useDeleteFoodEntry()
  const updateEntry = useUpdateFoodEntry()

  // Gespeicherte Mahlzeiten: speichern (Karte) und mit einem Tipp eintragen (Hinzufügen-Menü)
  const [saveMealFor, setSaveMealFor] = useState<Meal | null>(null)
  const flashNote = (m: string) => {
    setWaterNote(m)
    setTimeout(() => setWaterNote(null), 3000)
  }
  function logSavedMeal(m: SavedMeal) {
    if (addEntries.isPending || m.items.length === 0) return
    const meal = addMeal()
    setError(null)
    addEntries.mutate(entriesFromSaved(m.items, today, meal), {
      onSuccess: () => {
        go(null)
        flashNote(`„${m.name}“ zu ${MEAL_LABEL[meal]} eingetragen`)
      },
      onError: (err) => setError(saveError(err)),
    })
  }

  const totals = sumEntries(entries ?? [])

  // Modal-Status
  const [setupOpen, setSetupOpen] = useState(false)
  const [addMode, setAddMode] = useState<
    null | 'menu' | 'manual' | 'search' | 'aitext' | 'recipe' | 'plan' | 'photo' | 'restaurant'
  >(null)
  const [place, setPlace] = useState('')
  const [restItem, setRestItem] = useState('')
  const [menuPicks, setMenuPicks] = useState<{ note: string; picks: MenuPick[] } | null>(null)
  const [menuPhotos, setMenuPhotos] = useState<string[]>([])
  const [chains, setChains] = useState<Chain[] | null>(null)
  const [orderQty, setOrderQty] = useState<Record<string, number>>({})
  // Neues Restaurant-Sheet: Ort eintippen, Alternativen/Karte erst auf Wunsch
  const [placeQuery, setPlaceQuery] = useState('')
  const [showAlts, setShowAlts] = useState(false)
  const [showChainMenu, setShowChainMenu] = useState(false)
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
    if (mode && (AI_MODES as readonly string[]).includes(mode) && !gate.requirePlus()) return
    setError(null)
    setAddMode(mode)
  }

  // KI-Erfassung (Foto/Text)
  const aiOn = gate.enabled
  const lock = gate.locked ? <PlusBadge /> : undefined
  const [aiResults, setAiResults] = useState<FoodEstimate[] | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [photoHint, setPhotoHint] = useState('')

  // „Mahlzeit-Analyse"-Sheet (öffnet sofort, lädt im Sheet)
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
    if (!file || !gate.requirePlus()) return
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
  }

  async function handleAiText() {
    if (!aiText.trim() || !gate.requirePlus()) return
    setError(null)
    setAddMode(null)
    setAiText('')
    void runAnalysis({ text: aiText.trim() })
  }

  const [craving, setCraving] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeText, setRecipeText] = useState('')
  const [planWish, setPlanWish] = useState('')
  const [planItems, setPlanItems] = useState<MealPlanItem[] | null>(null)
  const [planNote, setPlanNote] = useState('')

  async function genPlan() {
    if (!gate.requirePlus()) return
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
        orderItems.length <= 2
          ? orderItems.map((i) => i.name).join(' + ')
          : `${activeChain.name} · ${orderItems.length} Artikel`
      showAnalysis(
        orderItems,
        title,
        mealVerdictText(
          orderItems.reduce(
            (a, i) => ({
              kcal: a.kcal + i.kcal,
              protein: a.protein + i.protein,
              carbs: a.carbs + i.carbs,
              fat: a.fat + i.fat,
              fiber: a.fiber + i.fiber,
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          ),
          { goal: settings?.goal, kcalLeft: hasTarget ? kcalTarget - totals.kcal : null },
        ),
      )
      setOrderQty({})
      setAddMode(null)
      return
    }
    if (!place && !restItem.trim()) return
    if (!gate.requirePlus()) return
    setAiBusy(true)
    setError(null)
    try {
      const items = await estimateFoodFromText(`${place ? place + ': ' : ''}${restItem.trim()}`)
      if (items.length === 0) setError('Nichts erkannt.')
      else {
        showAnalysis(items, restItem.trim() || place || 'Bestellung')
        setAddMode(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  /** Speisekarte fotografieren → 3 passende Gerichte zum Rest-Budget. */
  /** Ort wählen (Kette merken, damit sie beim nächsten Mal vorne steht). */
  function pickPlace(name: string, chainId?: string) {
    setPlace(name)
    setOrderQty({})
    setRestItem('')
    setPlaceQuery('')
    setShowAlts(false)
    setShowChainMenu(false)
    setMenuPicks(null)
    setMenuPhotos([])
    if (!chainId) return
    try {
      const recent: string[] = JSON.parse(localStorage.getItem(RECENT_PLACES_KEY) || '[]')
      localStorage.setItem(
        RECENT_PLACES_KEY,
        JSON.stringify([chainId, ...recent.filter((r) => r !== chainId)].slice(0, 12)),
      )
    } catch {
      /* ignore */
    }
  }

  /** Eingetippten Ort übernehmen: bekannte Kette → exakte Karte, sonst freier Ort (KI). */
  function pickTypedPlace() {
    const q = placeQuery.trim()
    if (!q) return
    const [id] = matchChains(q)
    if (id) pickPlace(CHAIN_BADGE[id].name, id)
    else pickPlace(q)
  }

  /** Eine Kombi von der Kettenkarte eintragen (exakte Werte, keine KI). */
  function logCombo(c: Combo) {
    const items = c.items.map((it) => menuItemToEstimate(it))
    showAnalysis(
      items,
      c.items
        .filter((it) => it.kcal > 10)
        .map((it) => it.name)
        .join(' + '),
      c.fits
        ? `Passt in dein Rest-Budget – ${c.protein} g Eiweiß.`
        : 'Dein Budget ist fast aufgebraucht – das ist die kleinste Option.',
    )
    setAddMode(null)
  }

  /** Foto einer Kartenseite hinzufügen (bis zu 4 Seiten). */
  async function addMenuPhoto(files: FileList | null | undefined) {
    if (!files?.length) return
    setError(null)
    setMenuPicks(null)
    const imgs = await Promise.all([...files].slice(0, 4).map((f) => fileToDataUrl(f, 1400)))
    setMenuPhotos((p) => [...p, ...imgs].slice(0, 4))
  }

  /** Alle Kartenfotos zusammen auswerten → 3 passende Optionen fürs Rest-Budget. */
  async function evaluateMenu() {
    if (!menuPhotos.length || !gate.requirePlus()) return
    setAiBusy(true)
    setError(null)
    setMenuPicks(null)
    try {
      const res = await menuFromPhoto(menuPhotos, {
        kcal: hasTarget ? Math.max(0, kcalTarget - totals.kcal) : 800,
        protein: Math.max(0, (settings?.protein_target ?? 0) - totals.protein),
      })
      if (res.picks.length === 0) setError(res.note || 'Keine Speisekarte erkannt.')
      else setMenuPicks(res)
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
      showAnalysis(items, `Vorschlag: ${activeChain.name}`, note)
      setAddMode(null)
      return
    }
    if (!gate.requirePlus()) return
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
        showAnalysis(res.items, `Vorschlag: ${place}`, res.note)
        setAddMode(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }

  async function genRecipeText() {
    if (!recipeText.trim() || !gate.requirePlus()) return
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
    if (!file || !gate.requirePlus()) return
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
    ...(it.fluid_ml ? { fluid_ml: it.fluid_ml } : {}),
    ...(it.micros ? { micros: it.micros } : {}),
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
        ...(pending.isDrink && amount > 0 ? { fluid_ml: Math.round(amount) } : {}),
        ...(pending.per100.micros ? { micros: scaleMicros(pending.per100.micros, amount / 100) } : {}),
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
      setManual({
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
      setAddMode(null)
    } catch (e) {
      setError(saveError(e))
    }
  }

  const hasTarget = settings && settings.kcal_target > 0
  // Gleiches Tagesziel wie Tagesüberblick/Auswertung (Trainingstag + eigener Bonus, Standard 250).
  const kcalTarget = kcalTargetFor(settings, trainedToday, kcalBonus)
  const dayKcal = useMemo(() => kcalByDate(allEntries), [allEntries])
  const sheetOpen = addMode !== null || !!pending || !!aiResults || !!recipe || !!planItems || !!analysis

  return (
    <div className="space-y-4">
      {/* Fehler ohne offenes Sheet (sonst zeigt das Sheet ihn selbst) */}
      {!sheetOpen && <ErrorLine error={error} />}

      <>
        <TabHeader
          style={stagger(0)}
          overline={
            isToday
              ? new Date(`${today}T12:00:00`).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : dayLabel(today, realToday)
          }
          title="Ernährung"
          action={
            <button
              className="flex max-w-[11rem] items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-sm font-semibold text-cocoa transition active:scale-95"
              onClick={openSetup}
              aria-label={hasTarget ? 'Ziel & Ernährungsweise bearbeiten' : 'Ziel festlegen'}
            >
              <Target size={15} className="shrink-0 text-brand" />
              <span className="truncate">{dietLabel || (hasTarget ? 'Ziel' : 'Ziel festlegen')}</span>
            </button>
          }
        />
        {isToday && <BuddyTip page="nutrition" />}

        {waterNote && (
          <div className="anim-fade rounded-full bg-brand/10 px-4 py-2 text-center text-sm font-semibold text-brand">
            {waterNote}
          </div>
        )}

        <WeekStrip
          date={today}
          today={realToday}
          onChange={setDay}
          kcalByDate={dayKcal}
          targetFor={(d) => kcalTargetFor(settings, trainedOn(d, allSets), kcalBonus)}
        />

        {isToday && <QuestStrip area="food" />}

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
            fiber: fiberTarget(settings?.kcal_target ?? 0),
          }}
          pins={nutrientPins}
          trained={trainedToday}
          bonus={kcalBonus}
          onSetup={openSetup}
          style={stagger(1)}
        />

        {isToday && diet.fasting !== 'none' && <FastingCard entries={entries ?? []} style={stagger(2)} />}

        <QuickAddBar
          aiOn={aiOn}
          locked={gate.locked}
          onLocked={() => gate.requirePlus()}
          onPhoto={(file) => {
            setMealOverride(null)
            void handlePhoto(file)
          }}
          onDescribe={() => {
            setMealOverride(null)
            go('aitext')
          }}
          onSuggest={() => {
            setMealOverride(null)
            go('plan')
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

        {isToday && (
          <ToolTiles
            style={stagger(3)}
            items={[
              { to: '/recipes', label: 'Rezepte', sub: 'Entdecken & eigene', Icon: BookOpen },
              { to: '/shopping?view=plan', label: 'Wochenplan', sub: 'Essen planen', Icon: CalendarDays },
              { to: '/shopping?view=shopping', label: 'Einkauf', sub: 'Einkaufsliste', Icon: ShoppingBasket },
            ]}
          />
        )}

        {homeCards.recent && isToday && (
          <div style={stagger(3)}>
            <RecentFoods
              label={`Nochmal zum ${MEAL_LABEL[currentMeal()]}?`}
              items={recentFor(currentMeal()).slice(0, 3)}
              onQuick={(e) => quickRepeat(e, currentMeal())}
              onOpen={(e) => {
                setMealOverride(currentMeal())
                pickRecent(e)
              }}
            />
          </div>
        )}

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
              onSaveMeal={() => setSaveMealFor(meal)}
              copy={lastMealCopy(allEntries ?? [], meal, today)}
              onCopy={() => copyMeal(meal)}
              copyBusy={addEntries.isPending}
              style={stagger(4 + i)}
            />
          ))}
        </div>

        <WaterRow date={today} style={stagger(8)} />
        <MicroCard entries={entries ?? []} sex={settings?.sex ?? null} style={stagger(9)} />
        {(homeCards.supplements || (supplements?.length ?? 0) > 0) && <SupplementCard date={today} />}
        {isToday && (homeCards.weight || params.has('weigh')) && <BodyWeightCard />}
        {isToday && <CustomizeHome area="food" />}
      </>

      {saveMealFor && (
        <SaveMealSheet
          meal={saveMealFor}
          entries={(entries ?? []).filter((e) => (e.meal ?? 'snack') === saveMealFor)}
          onClose={() => setSaveMealFor(null)}
          onSaved={(n) => flashNote(`„${n}“ gespeichert – beim Hinzufügen mit einem Tipp`)}
        />
      )}

      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={(patch) => {
            updateEntry.mutate({ id: editEntry.id, ...patch }, { onError: (err) => setError(saveError(err)) })
            setEditEntry(null)
          }}
          onDelete={() => {
            deleteEntry.mutate(editEntry, { onError: (err) => setError(saveError(err, 'Löschen')) })
            setEditEntry(null)
          }}
        />
      )}

      {/* ----- Ziel-Setup ----- */}
      {setupOpen && (
        <PremiumSheet
          title="Ziel & Körperdaten"
          subtitle="Nährwerte werden automatisch berechnet"
          leading={<IconTile icon={Target} />}
          onClose={() => setSetupOpen(false)}
        >
          <GoalEditor onSaved={() => setSetupOpen(false)} onCancel={() => setSetupOpen(false)} />
        </PremiumSheet>
      )}

      {/* ----- Hinzufügen: Menü ----- */}
      {addMode === 'menu' && !pending && !scanning && (
        <FlowSheet
          title="Hinzufügen"
          subtitle={mealOverride ? `zu ${MEAL_LABEL[mealOverride]}` : undefined}
          onClose={() => go(null)}
        >
          <>
            <ErrorNote error={error} />
            <SavedMealChips meal={mealOverride} busy={saving} onPick={logSavedMeal} />
            <RecentFoods items={recentFor(addMeal())} onQuick={(e) => quickRepeat(e, addMeal())} onOpen={pickRecent} />
            {aiOn && (
              <div>
                <GroupLabel>Mit Buddy (KI)</GroupLabel>
                <GroupList>
                  <GroupRow
                    accent
                    icon={<Camera size={18} />}
                    title="Foto"
                    subtitle="Essen fotografieren, Buddy schätzt"
                    right={lock}
                    onClick={() => go('photo')}
                  />
                  <GroupRow
                    icon={<MessageSquare size={18} />}
                    title="Beschreiben"
                    subtitle="z. B. „2 Eier und ein Brot"
                    right={lock}
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
                    right={lock}
                    onClick={() => go('recipe')}
                  />
                  <GroupRow
                    icon={<ClipboardList size={18} />}
                    title="Tagesplan für heute"
                    subtitle="Passend zu deinem Ziel"
                    right={lock}
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
        </FlowSheet>
      )}

      {/* ----- Suche ----- */}
      {addMode === 'search' && !pending && !scanning && (
        <FlowSheet title="Suchen" icon={Search} onClose={() => go(null)} onBack={() => go('menu')}>
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
                type="button"
                className="grid w-12 shrink-0 place-items-center rounded-2xl bg-sand text-cocoa-light transition active:scale-95"
                onClick={() => {
                  setError(null)
                  setScanning(true)
                }}
                aria-label="Barcode scannen"
              >
                <ScanBarcode size={20} />
              </button>
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

            {results.length === 0 && !searching && (
              <RecentFoods
                items={recentFor(addMeal())}
                disabled={saving}
                onQuick={(e) => quickRepeat(e, addMeal())}
                onOpen={pickRecent}
              />
            )}
          </>
        </FlowSheet>
      )}

      {/* ----- Mengen-Bestätigung (Barcode/Suche) ----- */}
      {pending && (
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
                    <div className="mt-2.5 flex justify-center">
                      <NutrientExtras values={m} />
                    </div>
                  </div>
                </div>
                <div>
                  <Stepper
                    label={pending.isDrink ? 'Menge (ml)' : 'Menge (g)'}
                    value={amount}
                    onChange={setAmount}
                    step={10}
                    min={0}
                    suffix={pending.isDrink ? 'ml' : 'g'}
                  />
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
      )}

      {/* ----- Manuelle Eingabe ----- */}
      {addMode === 'manual' && !pending && (
        <FlowSheet
          title="Manuell eingeben"
          icon={PenLine}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={saving}
          footer={
            <PrimaryButton onClick={addManual} disabled={saving} busy={addEntry.isPending}>
              Hinzufügen
            </PrimaryButton>
          }
        >
          <div>
            <label className="label" htmlFor="manual-name">
              Name
            </label>
            <input
              id="manual-name"
              className={BIG_INPUT}
              autoFocus
              placeholder="z. B. Proteinriegel"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
            />
          </div>
          <>
            <div>
              <GroupLabel>Hauptwerte</GroupLabel>
              <div className="grid grid-cols-2 gap-2">
                {MANUAL_FIELDS.slice(0, MANUAL_MAIN).map(([key, lbl]) => (
                  <ManualField
                    key={key}
                    label={lbl}
                    value={manual[key]}
                    onChange={(v) => setManual({ ...manual, [key]: v })}
                  />
                ))}
              </div>
            </div>
            <div>
              <GroupLabel>Optional</GroupLabel>
              <div className="grid grid-cols-2 gap-2">
                {MANUAL_FIELDS.slice(MANUAL_MAIN).map(([key, lbl]) => (
                  <ManualField
                    key={key}
                    label={lbl}
                    value={manual[key]}
                    onChange={(v) => setManual({ ...manual, [key]: v })}
                  />
                ))}
              </div>
            </div>
            <ErrorNote error={error} />
          </>
        </FlowSheet>
      )}

      {/* ----- KI: Restaurant / unterwegs ----- */}
      {addMode === 'restaurant' && (
        <FlowSheet
          title="Restaurant / unterwegs"
          icon={Store}
          subtitle={
            hasTarget
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
            !place ? undefined : orderItems.length > 0 || restItem.trim() ? (
              <PrimaryButton onClick={estimateOrder} disabled={aiBusy} busy={aiBusy}>
                {orderItems.length > 0
                  ? `${orderItems.length} Artikel eintragen · ${orderKcal} kcal`
                  : activeChain
                    ? 'Nicht dabei? Mit KI schätzen'
                    : 'Eintragen (KI schätzt)'}
              </PrimaryButton>
            ) : !activeChain && menuPhotos.length === 0 ? (
              <PrimaryButton onClick={suggestForBudget} disabled={aiBusy} busy={aiBusy}>
                Was soll ich hier nehmen?
              </PrimaryButton>
            ) : undefined
          }
        >
          {!place && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className={BIG_INPUT}
                  placeholder="Wo isst du? z. B. McDonald's, Italiener"
                  value={placeQuery}
                  enterKeyHint="go"
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pickTypedPlace()}
                />
                <MicButton onResult={(t) => setPlaceQuery(t)} />
              </div>
              {placeQuery.trim() ? (
                <div className="anim-fade divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
                  {matchChains(placeQuery).map((id) => (
                    <button
                      key={id}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-sand/60"
                      onClick={() => pickPlace(CHAIN_BADGE[id].name, id)}
                    >
                      <Store size={17} className="shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{CHAIN_BADGE[id].name}</span>
                        <span className="block text-xs text-cocoa-light">Exakte Nährwerte von der Karte</span>
                      </span>
                    </button>
                  ))}
                  <button
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-sand/60"
                    onClick={() => pickPlace(placeQuery.trim())}
                  >
                    <Sparkles size={17} className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">„{placeQuery.trim()}“</span>
                      <span className="block text-xs text-cocoa-light">KI kennt die typischen Gerichte</span>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recentFirst(Object.keys(CHAIN_BADGE)).map((id) => (
                    <button
                      key={id}
                      onClick={() => pickPlace(CHAIN_BADGE[id].name, id)}
                      className="rounded-full bg-cream px-3.5 py-2 text-sm font-semibold transition active:scale-95"
                    >
                      {CHAIN_BADGE[id].name}
                    </button>
                  ))}
                </div>
              )}
              {aiOn && (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-2xl bg-cream p-3.5 transition active:scale-[0.99]"
                  onClick={gate.guard}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Camera size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Speisekarte fotografieren</span>
                    <span className="block text-xs text-cocoa-light">
                      Jedes Restaurant – die KI sucht das Beste raus
                    </span>
                  </span>
                  {lock}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files
                      pickPlace(placeQuery.trim() || OTHER_PLACE)
                      void addMenuPhoto(files)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          )}
          {place && (
            <button
              className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left"
              onClick={() => pickPlace('')}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Store size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{place}</span>
                <span className="block text-xs text-cocoa-light">
                  {activeChain ? 'Exakte Werte von der Karte' : 'Werte schätzt die KI'}
                </span>
              </span>
              <span className="text-xs font-semibold text-brand">Ändern</span>
            </button>
          )}
          {aiOn && place && !activeChain && (
            <div className="space-y-2">
              <div className="space-y-2.5 rounded-2xl bg-cream p-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Camera size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Speisekarte fotografieren</span>
                    <span className="block text-xs text-cocoa-light">
                      Alle Seiten fotografieren – die KI sucht die 3 besten Optionen für dein Rest-Budget
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {menuPhotos.map((src, i) => (
                    <span key={i} className="relative">
                      <img src={src} alt={`Seite ${i + 1}`} className="h-16 w-12 rounded-lg object-cover" />
                      <button
                        aria-label={`Seite ${i + 1} entfernen`}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-cocoa text-bg"
                        onClick={() => setMenuPhotos((p) => p.filter((_, j) => j !== i))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {menuPhotos.length < 4 && (
                    <label
                      className={`grid h-16 w-12 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-sand-dark text-cocoa-light ${
                        aiBusy ? 'pointer-events-none opacity-60' : ''
                      }`}
                      aria-label="Seite hinzufügen"
                    >
                      <Plus size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void addMenuPhoto(e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
                {menuPhotos.length > 0 && (
                  <button className="btn-primary w-full gap-2 rounded-xl" onClick={evaluateMenu} disabled={aiBusy}>
                    {aiBusy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                    {aiBusy
                      ? 'Karte wird gelesen…'
                      : `${menuPhotos.length} ${menuPhotos.length === 1 ? 'Seite' : 'Seiten'} auswerten`}
                  </button>
                )}
              </div>
              {menuPicks && (
                <div className="anim-fade space-y-2">
                  {menuPicks.note && <p className="px-1 text-xs text-cocoa-light">{menuPicks.note}</p>}
                  {menuPicks.picks.map((p, i) => (
                    <button
                      key={p.name + i}
                      className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left ring-1 ring-transparent transition active:scale-[0.99]"
                      onClick={() => {
                        const { why: _why, ...item } = p
                        showAnalysis([item], p.name)
                        setMenuPicks(null)
                        setAddMode(null)
                      }}
                    >
                      <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="block text-xs text-cocoa-light">{p.why}</span>
                        <span className="tabular block text-[11px] text-cocoa-muted">
                          {p.kcal} kcal · {p.protein} g Eiweiß
                        </span>
                      </span>
                      <Plus size={18} className="shrink-0 text-brand" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {place && (!activeChain || showChainMenu) && (
            <div>
              <GroupLabel>{activeChain ? 'Auf der Karte suchen' : 'Oder beschreiben, was du bestellst'}</GroupLabel>
              <div className="flex gap-2">
                <input
                  className={BIG_INPUT}
                  placeholder={activeChain ? 'Auf der Karte suchen, z. B. Big Mac' : 'Gericht, z. B. Pasta Carbonara'}
                  value={restItem}
                  onChange={(e) => setRestItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && estimateOrder()}
                />
                <MicButton onResult={(t) => setRestItem((v) => (v ? v + ' ' + t : t))} />
              </div>
            </div>
          )}
          {activeChain &&
            !restItem.trim() &&
            (() => {
              const remaining = hasTarget
                ? {
                    kcal: Math.max(0, kcalTarget - totals.kcal),
                    protein: Math.max(0, (settings?.protein_target ?? 0) - totals.protein),
                  }
                : { kcal: 800, protein: 40 }
              const [best, ...alts] = suggestCombos(activeChain.items, remaining, 3)
              if (!best) return null
              return (
                <div className="space-y-2">
                  <section className="anim-fade relative overflow-hidden rounded-3xl bg-cocoa p-4 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/25 blur-3xl" />
                    <span className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                      <Sparkles size={13} className="text-brand" />
                      {best.fits ? 'Beste Wahl für dein Budget' : 'Kleinste sinnvolle Option'}
                    </span>
                    <ul className="relative mt-2 space-y-0.5">
                      {best.items.map((it, i) => (
                        <li key={it.name + i} className="text-[15px] font-semibold leading-snug">
                          {it.name}
                        </li>
                      ))}
                    </ul>
                    <div className="relative mt-3 flex items-end justify-between gap-3">
                      <div className="flex gap-4">
                        <span>
                          <span className="tabular block text-2xl font-black leading-none">{best.kcal}</span>
                          <span className="text-[11px] text-bg/60 dark:text-cocoa-light">kcal</span>
                        </span>
                        <span>
                          <span className="tabular block text-2xl font-black leading-none">{best.protein} g</span>
                          <span className="text-[11px] text-bg/60 dark:text-cocoa-light">Eiweiß</span>
                        </span>
                      </div>
                      <button className="btn-primary gap-1.5 rounded-2xl px-4 py-2.5" onClick={() => logCombo(best)}>
                        <Plus size={17} /> Eintragen
                      </button>
                    </div>
                    {hasTarget && (
                      <p className="relative mt-2.5 text-xs text-bg/60 dark:text-cocoa-light">
                        {best.fits
                          ? `Danach noch ${Math.max(0, remaining.kcal - best.kcal)} kcal übrig`
                          : `${best.kcal - remaining.kcal} kcal über deinem Rest-Budget`}
                      </p>
                    )}
                  </section>
                  {alts.length > 0 && (
                    <button
                      className="flex w-full items-center justify-between rounded-2xl px-1 py-1.5 text-sm font-semibold text-brand"
                      onClick={() => setShowAlts((v) => !v)}
                      aria-expanded={showAlts}
                    >
                      {showAlts ? 'Alternativen ausblenden' : `${alts.length} Alternativen`}
                      <ChevronDown size={16} className={`transition-transform ${showAlts ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {showAlts &&
                    alts.map((c, i) => (
                      <button
                        key={i}
                        className="anim-fade flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left transition active:scale-[0.99]"
                        onClick={() => logCombo(c)}
                      >
                        <span className="min-w-0 flex-1">
                          {c.tag && (
                            <span className="mb-0.5 inline-block text-[11px] font-semibold uppercase tracking-wide text-brand">
                              {c.tag}
                            </span>
                          )}
                          <span className="block text-sm font-semibold leading-snug">
                            {c.items.map((it) => it.name).join(' + ')}
                          </span>
                          <span className="tabular block text-xs text-cocoa-light">
                            {c.kcal} kcal · {c.protein} g Eiweiß{!c.fits && ' · über Budget'}
                          </span>
                        </span>
                        <Plus size={18} className="shrink-0 text-brand" />
                      </button>
                    ))}
                  {!showChainMenu && (
                    <button
                      className="flex w-full items-center justify-between rounded-2xl px-1 py-1.5 text-sm font-semibold text-cocoa-light"
                      onClick={() => setShowChainMenu(true)}
                    >
                      Selbst von der Karte wählen
                      <ChevronDown size={16} />
                    </button>
                  )}
                </div>
              )
            })()}
          {activeChain && (showChainMenu || !!restItem.trim()) && (
            <ChainMenu
              chain={activeChain}
              query={restItem}
              qty={orderQty}
              onQty={(name, n) => setOrderQty((q) => ({ ...q, [name]: Math.max(0, n) }))}
            />
          )}
          <ErrorNote error={error} />
        </FlowSheet>
      )}

      {/* ----- KI: Foto + optionale Notiz ----- */}
      {addMode === 'photo' && (
        <FlowSheet
          title="Foto"
          icon={Camera}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
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
          }
        >
          <p className="text-sm text-cocoa-light">
            Optional dazu schreiben oder diktieren, was drin ist oder wie viel — macht die Schätzung genauer.
          </p>
          <div className="flex gap-2">
            <input
              className={BIG_INPUT}
              placeholder="z. B. mit extra Käse, ca. 300 g, dazu Reis"
              value={photoHint}
              onChange={(e) => setPhotoHint(e.target.value)}
            />
            <MicButton onResult={(t) => setPhotoHint((v) => (v ? v + ' ' + t : t))} />
          </div>
          <ErrorNote error={error} />
        </FlowSheet>
      )}

      {/* ----- KI: Text beschreiben ----- */}
      {addMode === 'aitext' && (
        <FlowSheet
          title="Mahlzeit beschreiben"
          icon={MessageSquare}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            <PrimaryButton onClick={handleAiText} disabled={aiBusy || !aiText.trim()} busy={aiBusy}>
              Schätzen
            </PrimaryButton>
          }
        >
          <p className="text-sm text-cocoa-light">
            Schreib einfach, was du gegessen hast — die KI schätzt die Nährwerte.
          </p>
          <div className="flex gap-2">
            <input
              className={BIG_INPUT}
              autoFocus
              placeholder="z. B. 2 Eier, 80 g Haferflocken, 1 Banane"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiText()}
            />
            <MicButton onResult={(t) => setAiText((v) => (v ? v + ' ' + t : t))} />
          </div>
          <ErrorNote error={error} />
        </FlowSheet>
      )}

      {/* ----- KI: Ergebnis prüfen & übernehmen ----- */}
      {aiResults && (
        <FlowSheet
          title="KI-Schätzung"
          icon={Sparkles}
          onClose={() => {
            setError(null)
            setAiResults(null)
          }}
          busy={saving}
          footer={
            <PrimaryButton onClick={() => addEstimates(aiResults)} disabled={saving} busy={addEntries.isPending}>
              Alle übernehmen
            </PrimaryButton>
          }
        >
          <p className="text-xs text-cocoa-light">
            Schätzwerte — vor dem Übernehmen kurz prüfen. Zum Feinjustieren einzeln übernehmen und danach bearbeiten.
          </p>
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
          <ErrorNote error={error} />
        </FlowSheet>
      )}

      {/* ----- KI: Mahlzeit-Analyse ----- */}
      {analysis && (
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
            fiberTarget: fiberTarget(settings?.kcal_target ?? 0),
            goal: settings?.goal ?? null,
            eaten: { kcal: totals.kcal, protein: totals.protein },
          }}
        />
      )}

      {/* ----- KI: Kühlschrank-Rezept ----- */}
      {addMode === 'recipe' && (
        <FlowSheet title="Rezept" icon={ChefHat} onClose={() => go(null)} onBack={() => go('menu')} busy={aiBusy}>
          <p className="text-sm text-cocoa-light">
            Worauf hast du Lust? Dann den Kühlschrank/die Zutaten fotografieren — die KI macht dir ein passendes Rezept.
          </p>
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
        </FlowSheet>
      )}

      {/* ----- Rezept-Ergebnis ----- */}
      {recipe && (
        <FlowSheet
          title={recipe.title}
          icon={ChefHat}
          subtitle={`${recipe.servings} Portion(en)`}
          onClose={() => {
            setError(null)
            setRecipe(null)
          }}
          busy={addRecipe.isPending || saving}
          footer={
            <>
              <PrimaryButton
                onClick={() => logRecipe(recipe)}
                disabled={addRecipe.isPending || saving}
                busy={addEntry.isPending}
              >
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
          }
        >
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
              <div className="mt-2.5">
                <NutrientExtras values={recipe.nutrition} />
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
        </FlowSheet>
      )}

      {/* ----- KI: Essensplan Eingabe ----- */}
      {addMode === 'plan' && (
        <FlowSheet
          title="Tagesplan für heute"
          icon={ClipboardList}
          subtitle={`Ziel: ~${settings?.kcal_target || 2000} kcal · ${settings?.protein_target || 130} g Eiweiß`}
          onClose={() => go(null)}
          onBack={() => go('menu')}
          busy={aiBusy}
          footer={
            <PrimaryButton onClick={genPlan} disabled={aiBusy} busy={aiBusy}>
              {aiBusy ? 'Erstelle…' : 'Plan erstellen'}
            </PrimaryButton>
          }
        >
          <p className="text-sm text-cocoa-light">Wünsche? Buddy plant Frühstück bis Snack passend zu deinem Ziel.</p>
          <div className="flex gap-2">
            <input
              className={BIG_INPUT}
              placeholder="z. B. high protein, kein Schwein, schnell"
              value={planWish}
              onChange={(e) => setPlanWish(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && genPlan()}
            />
            <MicButton onResult={(t) => setPlanWish((v) => (v ? v + ' ' + t : t))} />
          </div>
          <ErrorNote error={error} />
        </FlowSheet>
      )}

      {/* ----- Essensplan Ergebnis ----- */}
      {planItems && (
        <FlowSheet
          title="Essensplan"
          icon={ClipboardList}
          subtitle={`${planItems.reduce((s, i) => s + i.kcal, 0)} kcal · ${planItems.reduce((s, i) => s + i.protein, 0)} g Eiweiß`}
          onClose={() => {
            setError(null)
            setPlanItems(null)
          }}
          busy={saving}
          footer={
            <PrimaryButton onClick={() => logPlan(planItems)} disabled={saving} busy={addEntries.isPending}>
              Alle loggen
            </PrimaryButton>
          }
        >
          {planNote && <p className="text-sm text-cocoa-light">{planNote}</p>}
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
          <ErrorNote error={error} />
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
        <div className="mt-2">
          <NutrientExtras
            values={{
              fiber: r1((entry.fiber ?? 0) * factor),
              sugar: r1((entry.sugar ?? 0) * factor),
              sat_fat: r1((entry.sat_fat ?? 0) * factor),
              salt: Math.round((entry.salt ?? 0) * factor * 100) / 100,
            }}
          />
        </div>
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
