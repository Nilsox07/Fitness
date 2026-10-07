// Client-seitige KI-Anbindung. Alle Feature-Aufrufe gehen über die
// Serverless-Funktion /api/ai (dort liegt der Key). Die Prompts sind nicht
// geheim und leben deshalb hier — pro Feature ein typisierter Helfer.

import { supabase } from './supabase'
import { MUSCLE_GROUPS, type MuscleGroup, type Meal, type PlanDay, type ShoppingCat } from '../types'
import { aiBegin, aiEnd } from './aiActivity'
import { dietPromptText, getActiveDiet, type DietStyle } from './dietStyle'
import type { MealFlags } from './mealScore'

export interface AiStatus {
  enabled: boolean
  provider: string
  model: string
}

// Bricht Anfragen ab, die zu lange dauern — dann klare Meldung statt „hängt".
const AI_TIMEOUT_MS = 70000

async function complete(opts: {
  system?: string
  prompt: string
  json?: boolean
  temperature?: number
  image?: string
  maxTokens?: number
}): Promise<string> {
  aiBegin()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
  try {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      // Standard-Obergrenze für die Antwortlänge (spart Zeit); große Generatoren
      // (mehrtägige Pläne) übergeben einen höheren Wert.
      body: JSON.stringify({ maxTokens: 2048, ...opts }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}))
      throw new Error(msg.error || `KI-Fehler (${res.status})`)
    }
    const data = (await res.json()) as { text: string }
    return data.text
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Die KI hat zu lange gebraucht. Bitte nochmal versuchen.')
    }
    throw e
  } finally {
    clearTimeout(timer)
    aiEnd()
  }
}

export async function getAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch('/api/ai')
    if (!res.ok) return { enabled: false, provider: '', model: '' }
    return (await res.json()) as AiStatus
  } catch {
    return { enabled: false, provider: '', model: '' }
  }
}

const INCOMPLETE = 'Die KI-Antwort war unvollständig — bitte nochmal versuchen.'

/** Robustes JSON-Parsing: entfernt Code-Fences (auch mitten im Text) und schneidet
 *  vom ersten `{`/`[` bis zur passenden letzten `}`/`]` aus. */
export function parseJson<T>(text: string): T {
  const clean = String(text ?? '')
    .replace(/```(?:json)?/gi, '')
    .trim()
  try {
    return JSON.parse(clean) as T
  } catch {
    /* weiter unten: JSON aus dem Text herausschneiden */
  }
  const obj = clean.indexOf('{')
  const arr = clean.indexOf('[')
  const start = obj < 0 ? arr : arr < 0 ? obj : Math.min(obj, arr)
  if (start >= 0) {
    const close = clean[start] === '{' ? '}' : ']'
    const end = clean.lastIndexOf(close)
    if (end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as T
      } catch {
        /* unten: klare Meldung */
      }
    }
  }
  throw new Error(INCOMPLETE)
}

/** Zahl robust aus KI-Antworten lesen: „ca. 350", „2,5", "12 g" → Zahl; sonst fallback.
 *  Verhindert NaN/null in NOT-NULL-Spalten. */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback
  if (typeof v !== 'string') return fallback
  const m = /-?\d+(?:[.,]\d+)?/.exec(v)
  if (!m) return fallback
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

/** Nicht-negative Nährwert-Zahl (DB: check >= 0). */
const nn = (v: unknown) => Math.max(0, num(v))

// ---------------------------------------------------------------------------
// Feature: KI-Wochenreview & Coach-Chat
// ---------------------------------------------------------------------------

export type CoachTone = 'coach' | 'sergeant' | 'bro'

export const COACH_TONE_LABEL: Record<CoachTone, string> = {
  coach: 'Motivierender Coach',
  sergeant: 'Harter Sergeant',
  bro: 'Lockerer Gym-Bro',
}

const TONE_INSTRUCTION: Record<CoachTone, string> = {
  coach: 'Ton: motivierend, sachlich, ermutigend.',
  sergeant: 'Ton: harter Drill-Sergeant — fordernd, laut, kurze Kommandos, kein Mitleid.',
  bro: 'Ton: lockerer Gym-Bro — humorvoll, salopp, viele Emojis.',
}

export function getCoachTone(): CoachTone {
  try {
    const t = localStorage.getItem('coach_tone')
    if (t === 'sergeant' || t === 'bro' || t === 'coach') return t
  } catch {
    /* ignore */
  }
  return 'coach'
}

export function setCoachTone(t: CoachTone) {
  try {
    localStorage.setItem('coach_tone', t)
  } catch {
    /* ignore */
  }
}

function coachSystem(): string {
  return (
    'Du bist ein erfahrener Kraft- und Hypertrophie-Coach. ' +
    'Antworte auf Deutsch, kompakt und konkret, sprich den Nutzer mit "du" an. ' +
    'Stütze dich auf die mitgelieferten Trainingsdaten (JSON). Wenn etwas fehlt, ' +
    'sag es ehrlich statt zu raten. Kein Fachjargon-Overkill. ' +
    TONE_INSTRUCTION[getCoachTone()]
  )
}

/** Klartext-Wochenfazit aus der kompakten Trainings-Zusammenfassung. */
export async function weeklyTrainingReview(summary: unknown): Promise<string> {
  const prompt =
    `Trainingsdaten (JSON):\n${JSON.stringify(summary)}\n\n` +
    'Gib ein ehrliches, motivierendes Wochen-Fazit (max. ~120 Wörter): Was lief gut, ' +
    'wo ist eine Schieflage oder zu wenig Volumen (nutze status "low"/"high"), und was ' +
    'sollte diese oder nächste Woche priorisiert werden? 2–4 umsetzbare Empfehlungen.'
  return complete({ system: coachSystem(), prompt, temperature: 0.5 })
}

/** Kurzer, auf das heutige Training bezogener Motivations-/Hype-Spruch. */
export async function hypeLine(context: unknown): Promise<string> {
  const prompt =
    `Heutiges Training (JSON):\n${JSON.stringify(context)}\n\n` +
    'Schreib EINEN kurzen, lockeren Hype-/Motivationsspruch auf Deutsch (max. 12 Wörter), ' +
    'der sich auf die heutige Leistung bezieht. Gym-Bro-Ton, gern mit Emoji. Nur den Spruch.'
  const text = await complete({ system: coachSystem(), prompt, temperature: 0.9 })
  return text.trim().replace(/^["']|["']$/g, '')
}

/** Persönlicher „Wrapped"-Rückblick über die gesamte Trainingshistorie. */
export async function wrappedRecap(summary: unknown): Promise<string> {
  const prompt =
    `Trainingsdaten (JSON):\n${JSON.stringify(summary)}\n\n` +
    'Schreib einen kurzen, unterhaltsamen "Wrapped"-Rückblick (max. ~140 Wörter) über die ' +
    'bisherige Trainingsreise: Highlights, Lieblingsübung, größte Fortschritte, eine witzige ' +
    'Zahl. Feiere den Nutzer. Nutze ein paar Emojis und kurze Absätze.'
  return complete({ system: coachSystem(), prompt, temperature: 0.8 })
}

/** Kurzes Ernährungs-Wochenfazit aus den letzten Tagen. */
export async function nutritionReview(summary: unknown): Promise<string> {
  const prompt =
    `Ernährungsdaten (JSON):\n${JSON.stringify(summary)}\n\n` +
    'Gib ein kurzes, konkretes Wochenfazit zur Ernährung (max. ~100 Wörter): Kalorien- und ' +
    'Eiweißtreue, Auffälligkeiten, 2–3 konkrete Tipps. Bezieh die Gewichtsentwicklung mit ein, ' +
    'falls vorhanden.'
  return complete({ system: coachSystem(), prompt, temperature: 0.5 })
}

/** Gesamt-Wochenfazit (Training + Ernährung zusammen) — läuft automatisch montags. */
export interface WeeklyReviewInput {
  weekLabel: string
  goalLabel: string
  training: { sessions: number; volumeKg: number; prs: number; topMuscles: string[] }
  /** null = Ernährung ausgeblendet → reines Trainingsfazit */
  nutrition: {
    daysLogged: number
    avgKcal: number
    avgProtein: number
    target: { kcal: number; protein: number } | null
  } | null
  bodyweight: { start: number; current: number } | null
}

export async function combinedWeeklyReview(input: WeeklyReviewInput): Promise<string> {
  if (!input.nutrition) {
    const prompt =
      `Wochendaten (JSON) für ${input.weekLabel}:\n${JSON.stringify(input)}\n\n` +
      'Schreib ein Wochenfazit NUR über das Training (max. ~120 Wörter) — erwähne Ernährung, ' +
      'Kalorien oder Eiweiß nicht. Struktur:\n' +
      '1) 🏋️ Training: Sessions, Volumen, Rekorde, Auffälligkeiten.\n' +
      '2) 🎯 Fokus nächste Woche: 2–3 konkrete, umsetzbare Empfehlungen.\n' +
      'Ehrlich aber motivierend, per „du". Nutze ein paar Emojis.'
    return complete({ system: coachSystem(), prompt, temperature: 0.5 })
  }
  const prompt =
    `Wochendaten (JSON) für ${input.weekLabel}:\n${JSON.stringify(input)}\n\n` +
    'Schreib EIN gemeinsames Wochenfazit über Training UND Ernährung (max. ~150 Wörter), ' +
    'abgestimmt auf das Ziel des Nutzers (goalLabel — z. B. Abnehmen, Aufbauen, Body ' +
    'Recomposition). Struktur mit kurzen Absätzen:\n' +
    '1) 🏋️ Training: Sessions, Volumen, Auffälligkeiten.\n' +
    '2) 🍎 Ernährung: Kalorien-/Eiweißtreue zum Ziel, Gewichtstrend.\n' +
    '3) 🎯 Fokus nächste Woche: 2–3 konkrete, umsetzbare Empfehlungen.\n' +
    'Ehrlich aber motivierend, per „du". Nutze ein paar Emojis.'
  return complete({ system: coachSystem(), prompt, temperature: 0.5 })
}

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// App-Copilot: beantwortet Fragen UND führt Aktionen aus
// ---------------------------------------------------------------------------

export const ASSISTANT_ROUTES = [
  '/',
  '/nutrition',
  '/analytics',
  '/history',
  '/exercises',
  '/plans',
  '/social',
  '/recipes',
  '/badges',
  '/profile',
] as const

export type AssistantAction =
  | { type: 'none' }
  | { type: 'navigate'; to: string }
  | { type: 'log_food'; items: FoodEstimate[] }
  | { type: 'set_gym_status'; text: string }
  | { type: 'add_exercise'; draft: ExerciseDraft }

export interface AssistantReply {
  reply: string
  action: AssistantAction
}

export async function assistant(history: ChatMsg[], context: unknown): Promise<AssistantReply> {
  const convo = history
    .map((m) => `${m.role === 'user' ? 'Nutzer' : 'Assistent'}: ${m.content}`)
    .join('\n')
  const system =
    'Du bist der In-App-Assistent einer Fitness-App. Du beantwortest Fragen kompakt auf ' +
    'Deutsch UND kannst genau EINE Aktion auslösen. Antworte ausschließlich mit JSON ' +
    '{"reply":"...","action":{...}}. action.type ist eines von: ' +
    '"none" | "navigate" {to} | "log_food" {items:[{name,amount_g,kcal,protein,carbs,fat}]} | ' +
    '"set_gym_status" {text} | "add_exercise" {draft:{name,muscle_group,secondary_muscles,unilateral,weight_steps,target_rep_min,target_rep_max,increment}}. ' +
    `Erlaubte Routen für navigate: ${ASSISTANT_ROUTES.join(', ')}. ` +
    `Erlaubte Muskelgruppen: ${MUSCLE_GROUPS.join(', ')}. ` +
    'Wähle eine Aktion NUR, wenn der Nutzer sie klar will (z. B. "logg …", "leg Übung … an", ' +
    '"bring mich zu …", "ich gehe … ins Gym"). Sonst action.type="none" und beantworte die Frage. ' +
    'Bei log_food schätze realistische Nährwerte der genannten Menge.' +
    prefClause()
  const prompt = `Kontext (JSON):\n${JSON.stringify(context)}\n\nGespräch:\n${convo}\n\nAntworte als JSON.`
  const text = await complete({ system, prompt, json: true, temperature: 0.3 })
  const raw = parseJson<{ reply?: string; action?: { type?: string; [k: string]: unknown } }>(text)
  const reply = String(raw.reply ?? '…')
  const a = raw.action || { type: 'none' }
  let action: AssistantAction = { type: 'none' }
  if (a.type === 'navigate' && typeof a.to === 'string' && (ASSISTANT_ROUTES as readonly string[]).includes(a.to)) {
    action = { type: 'navigate', to: a.to }
  } else if (a.type === 'set_gym_status' && typeof a.text === 'string') {
    action = { type: 'set_gym_status', text: a.text }
  } else if (a.type === 'log_food' && Array.isArray(a.items)) {
    const items = (a.items as Partial<FoodEstimate>[]).map((i) => ({
      name: String(i.name ?? 'Lebensmittel'),
      amount_g: amountG(i.amount_g),
      kcal: Math.round(nn(i.kcal)),
      protein: Math.round(nn(i.protein)),
      carbs: Math.round(nn(i.carbs)),
      fat: Math.round(nn(i.fat)),
      ...micros(i),
    }))
    if (items.length) action = { type: 'log_food', items }
  } else if (a.type === 'add_exercise' && a.draft) {
    const d = a.draft as Partial<ExerciseDraft>
    const valid = (g: string): g is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(g)
    const primary = d.muscle_group && valid(d.muscle_group) ? d.muscle_group : 'Sonstige'
    action = {
      type: 'add_exercise',
      draft: {
        name: String(d.name ?? 'Übung').slice(0, 60),
        muscle_group: primary,
        secondary_muscles: (d.secondary_muscles ?? []).filter(valid).filter((g) => g !== primary).slice(0, 3),
        unilateral: Boolean(d.unilateral),
        weight_steps: typeof d.weight_steps === 'string' && d.weight_steps.trim() ? d.weight_steps.trim() : null,
        target_rep_min: Math.max(1, Math.round(Number(d.target_rep_min ?? 8)) || 8),
        target_rep_max: Math.max(1, Math.round(Number(d.target_rep_max ?? 12)) || 12),
        increment: Number(d.increment) > 0 ? Number(d.increment) : 2.5,
      },
    }
  }
  return { reply, action }
}

// ---------------------------------------------------------------------------
// Essensplan-Generator & Text-Rezept
// ---------------------------------------------------------------------------

export interface MealPlanItem {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
}

export async function mealPlanForDay(
  targets: { kcal: number; protein: number },
  wish: string,
): Promise<{ note: string; items: MealPlanItem[] }> {
  const system =
    'Du bist Ernährungsberater. Erstelle einen realistischen Tages-Essensplan, der die Ziele ' +
    'möglichst trifft. Antworte ausschließlich mit JSON.'
  const prompt =
    `Tagesziel: ~${targets.kcal} kcal, ~${targets.protein} g Eiweiß. Wunsch: "${wish || 'ausgewogen'}".\n` +
    'Format: {"note":"kurzer Hinweis","items":[{"meal":"breakfast|lunch|dinner|snack",' +
    '"name":"...","kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"fiber":<g>,"sugar":<g>,' +
    '"sat_fat":<g>,"salt":<g>}]}. 4–6 Einträge, deutsch.' +
    prefClause()
  const text = await complete({ system, prompt, json: true, temperature: 0.5 })
  const raw = parseJson<{ note?: string; items?: Partial<MealPlanItem>[] }>(text)
  const meals = ['breakfast', 'lunch', 'dinner', 'snack']
  return {
    note: String(raw.note ?? ''),
    items: (raw.items ?? []).map((i) => ({
      meal: (meals.includes(String(i.meal)) ? i.meal : 'snack') as MealPlanItem['meal'],
      name: String(i.name ?? 'Mahlzeit'),
      kcal: Math.round(nn(i.kcal)),
      protein: Math.round(nn(i.protein)),
      carbs: Math.round(nn(i.carbs)),
      fat: Math.round(nn(i.fat)),
      ...micros(i),
    })),
  }
}

export async function recipeFromText(request: string): Promise<Recipe> {
  const system =
    'Du bist Koch und Ernährungsberater. Erstelle EIN Rezept passend zur Anfrage. ' +
    'Antworte ausschließlich mit JSON.'
  const prompt =
    `Anfrage: "${request}".\n` +
    '"nutrition":{"kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"fiber":<g>,"sugar":<g>,"sat_fat":<g>,"salt":<g>}}. ' +
    'Format: {"title":"...","servings":<Zahl>,"ingredients":["..."],"steps":["..."], ...}. Nährwerte pro Portion. Deutsch.' +
    prefClause()
  const text = await complete({ system, prompt, json: true, temperature: 0.6 })
  const r = parseJson<Partial<Recipe>>(text)
  return {
    title: String(r.title ?? 'Rezept'),
    servings: Math.max(1, num(r.servings, 1)),
    ingredients: (r.ingredients ?? []).map(String),
    steps: (r.steps ?? []).map(String),
    nutrition: recipeNutrition(r.nutrition),
  }
}

/** Was /api/recipe-import zu einem geteilten Link findet. */
export interface SharedPost {
  source: string
  url: string
  title: string
  caption: string
  author: string
  image: string | null
  recipe: { name: string; yield: string; ingredients: string[]; steps: string[]; nutrition: unknown } | null
}

/** Ergebnis eines Imports: Rezept + ob Zutaten/Mengen ergänzt werden mussten. */
export interface ImportedRecipe extends Recipe {
  /** true = im Beitrag standen keine (vollständigen) Zutaten, die KI hat ergänzt */
  guessed: boolean
  source: string
  url: string | null
}

/** Ersten Link aus geteiltem Text holen (TikTok & Co. schicken oft „Schau mal … https://…"). */
export function extractUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text)
  return m ? m[0].replace(/[),.!?]+$/, '') : null
}

/** Link-Infos vom Server holen (Bildunterschrift, Vorschaubild, strukturiertes Rezept). */
export async function fetchSharedPost(url: string): Promise<SharedPost> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  const res = await fetch('/api/recipe-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ url }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Link konnte nicht geladen werden.')
  return data as SharedPost
}

const IMPORT_FORMAT =
  'Format: {"title":"...","servings":<Zahl>,"ingredients":["Menge Zutat", ...],"steps":["..."],' +
  '"guessed":<true|false>,' +
  '"nutrition":{"kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"fiber":<g>,"sugar":<g>,"sat_fat":<g>,"salt":<g>}}. ' +
  'Nährwerte PRO PORTION aus den Mengen berechnen. Alles auf Deutsch (Zutaten und Schritte übersetzen, ' +
  'amerikanische Maße wie cups/oz in g/ml umrechnen).'

function toImported(text: string, source: string, url: string | null): ImportedRecipe {
  const r = parseJson<Partial<Recipe> & { guessed?: unknown }>(text)
  return {
    title: String(r.title ?? 'Rezept'),
    servings: Math.max(1, num(r.servings, 1)),
    ingredients: (r.ingredients ?? []).map(String),
    steps: (r.steps ?? []).map(String),
    nutrition: recipeNutrition(r.nutrition),
    guessed: r.guessed === true || r.guessed === 'true',
    source,
    url,
  }
}

/**
 * Rezept aus einem geteilten Beitrag (Link-Infos und/oder eingefügtem Text).
 * Das Original bleibt erhalten – es wird NICHT an die Ernährungsweise angepasst.
 */
export async function recipeFromPost(post: SharedPost | null, pastedText = ''): Promise<ImportedRecipe> {
  const system =
    'Du übernimmst Rezepte aus Social-Media-Beiträgen (TikTok, Instagram, YouTube) und Rezeptseiten. ' +
    'Übernimm Zutaten, Mengen und Schritte so originalgetreu wie möglich. Fehlen Zutaten oder Mengen ' +
    '(z. B. „Rezept im Video"), ergänze ein typisches Rezept für genau dieses Gericht und setze "guessed": true. ' +
    'Antworte ausschließlich mit JSON.'
  const useful = (post?.caption.trim().length ?? 0) > 15 || !!post?.recipe || !!post?.image || pastedText.trim().length > 15
  if (!useful) {
    throw new Error(
      post?.source === 'Instagram'
        ? 'Instagram gibt den Beitrag ohne Anmeldung nicht frei. Mach einen Screenshot vom Rezept oder kopier die Bildunterschrift hier rein.'
        : 'Im Link steht kein Rezept. Mach einen Screenshot oder kopier die Beschreibung hier rein.',
    )
  }
  const parts: string[] = []
  if (post) {
    parts.push(`Quelle: ${post.source}${post.author ? ` (von ${post.author})` : ''}`)
    if (post.title) parts.push(`Titel: ${post.title}`)
    if (post.caption) parts.push(`Bildunterschrift/Beschreibung:\n${post.caption.slice(0, 4000)}`)
    if (post.recipe) parts.push(`Strukturierte Rezeptdaten der Seite:\n${JSON.stringify(post.recipe).slice(0, 6000)}`)
  }
  if (pastedText.trim()) parts.push(`Vom Nutzer eingefügter Text:\n${pastedText.trim().slice(0, 4000)}`)
  if (post?.image) parts.push('Das Bild ist das Vorschaubild des Beitrags – nutze es, um das Gericht zu erkennen.')
  const prompt = `${parts.join('\n\n')}\n\n${IMPORT_FORMAT}`
  const text = await complete({ system, prompt, image: post?.image ?? undefined, json: true, temperature: 0.3 })
  return toImported(text, post?.source ?? 'Text', post?.url ?? null)
}

/** Rezept aus einem Screenshot (z. B. Rezept-Slide aus Instagram oder Text im Video). */
export async function recipeFromScreenshot(image: string): Promise<ImportedRecipe> {
  const system =
    'Du liest Rezepte aus Screenshots (Social-Media-Beiträge, Kochbuchseiten, Videos mit Text). ' +
    'Übernimm Zutaten, Mengen und Schritte originalgetreu. Ist nur das fertige Gericht zu sehen, ' +
    'erstelle ein typisches Rezept dafür und setze "guessed": true. Antworte ausschließlich mit JSON.'
  const text = await complete({ system, prompt: IMPORT_FORMAT, image, json: true, temperature: 0.3 })
  return toImported(text, 'Screenshot', null)
}

/** Coach-Chat: beantwortet die letzte Nutzerfrage mit Datenkontext. */
export async function coachChat(history: ChatMsg[], context: unknown): Promise<string> {
  const convo = history
    .map((m) => `${m.role === 'user' ? 'Nutzer' : 'Coach'}: ${m.content}`)
    .join('\n')
  const prompt =
    `Trainingsdaten (JSON):\n${JSON.stringify(context)}\n\n` +
    `Gespräch bisher:\n${convo}\n\nAntworte als Coach auf die letzte Nutzer-Nachricht.`
  return complete({ system: coachSystem(), prompt, temperature: 0.6 })
}

// ---------------------------------------------------------------------------
// Feature: Cheat-Meal-Erkennung (für den Freunde-Alarm)
// ---------------------------------------------------------------------------

export async function judgeCheatMeal(entry: {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}): Promise<{ indulgent: boolean; quip: string }> {
  const system =
    'Du entscheidest, ob ein EINZELNES Lebensmittel ein ungesunder „Cheat" ist, über den man ' +
    'Freunde freundschaftlich necken kann. Wichtig: berücksichtige die Makros — hohe Eiweißdichte ' +
    'oder ausgewogen = KEIN Cheat, auch bei vielen Kalorien (z. B. High-Protein-Pizza, große ' +
    'gesunde Mahlzeit). Junkfood/Süßigkeiten/viel Fett+Zucker mit wenig Eiweiß = Cheat. ' +
    'Antworte ausschließlich mit JSON.'
  const prompt =
    `Lebensmittel: "${entry.name}", ${entry.kcal} kcal, Eiweiß ${entry.protein} g, ` +
    `Kohlenhydrate ${entry.carbs} g, Fett ${entry.fat} g.\n` +
    'Format: {"indulgent":true|false,"quip":"kurzer, lockerer Neck-Spruch auf Deutsch (nur wenn indulgent), sonst \\"\\""}'
  try {
    const text = await complete({ system, prompt, json: true, temperature: 0.7 })
    const r = parseJson<{ indulgent?: boolean; quip?: string }>(text)
    return { indulgent: Boolean(r.indulgent), quip: String(r.quip ?? '') }
  } catch {
    return { indulgent: false, quip: '' }
  }
}

// ---------------------------------------------------------------------------
// Feature: Trainingsplan-Vorschlag aus vorhandenen Übungen
// ---------------------------------------------------------------------------

export interface PlanSuggestion {
  name: string
  exercises: string[]
}

export async function generatePlan(
  exercises: { name: string; muscle: string }[],
  wish: string,
): Promise<PlanSuggestion[]> {
  const list = exercises.map((e) => `${e.name} (${e.muscle})`).join(', ')
  const system =
    'Du bist ein Trainingsplaner. Erstelle sinnvolle Split-Pläne AUSSCHLIESSLICH aus den ' +
    'vorhandenen Übungen des Nutzers. Antworte nur mit JSON.'
  const prompt =
    `Vorhandene Übungen: ${list}.\n` +
    `Wunsch: "${wish}".\n` +
    'Erzeuge 2–4 Pläne mit sinnvoller Übungsauswahl und -reihenfolge. ' +
    'Nutze NUR exakt vorhandene Übungsnamen. ' +
    'Format: {"plans":[{"name":"Push","exercises":["Übungsname", ...]}, ...]}.'
  const text = await complete({ system, prompt, json: true, temperature: 0.4 })
  const raw = parseJson<{ plans?: { name?: string; exercises?: string[] }[] }>(text)
  const names = new Set(exercises.map((e) => e.name.toLowerCase()))
  return (raw.plans ?? [])
    .map((p) => ({
      name: String(p.name ?? 'Plan'),
      exercises: (p.exercises ?? []).filter((n) => names.has(String(n).toLowerCase())),
    }))
    .filter((p) => p.exercises.length > 0)
}

// ---------------------------------------------------------------------------
// Feature: Nährwerte aus Foto oder Text schätzen
// ---------------------------------------------------------------------------

// Ernährungs-Einschränkungen (nicht gegessen / Allergien / Abneigungen).
export function getDietAvoid(): string {
  try {
    return localStorage.getItem('diet_avoid') || ''
  } catch {
    return ''
  }
}
export function setDietAvoid(v: string) {
  try {
    localStorage.setItem('diet_avoid', v)
  } catch {
    /* ignore */
  }
}
/** Prompt-Zusatz zur gewählten Ernährungsweise (Makro-Stil, Einschränkungen,
 *  Intervallfasten), z. B. „Ernährungsweise des Nutzers: Keto (…), vegetarisch
 *  (…). Halte dich strikt daran." — '' bei „Ausgewogen" ohne Extras. */
export function dietContext(d: DietStyle = getActiveDiet()): string {
  return dietPromptText(d)
}

/** Prompt-Zusatz „Das esse ich nicht" (Allergien/Abneigungen). */
function avoidOnly(): string {
  const a = getDietAvoid().trim()
  return a
    ? ` WICHTIG: Der Nutzer isst folgendes NICHT bzw. hat Allergien/Abneigungen: "${a}". ` +
        'Vermeide diese Zutaten vollständig und schlage nichts damit vor.'
    : ''
}

/** Prompt-Zusatz, den alle KI-Essens-Generatoren beachten: Ernährungsweise +
 *  „Das esse ich nicht". */
function prefClause(): string {
  return dietContext() + avoidOnly()
}

export interface FoodEstimate {
  name: string
  amount_g: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
}

const NUTRITION_SYSTEM =
  'Du bist Ernährungsberater. Schätze Lebensmittel und ihre Nährwerte für die ' +
  'GEZEIGTE bzw. BESCHRIEBENE Portion (nicht pro 100 g). Antworte ausschließlich mit JSON.'

const NUTRITION_FORMAT =
  'Format: {"items":[{"name":"...","amount_g":<Zahl oder null>,"kcal":<Zahl>,' +
  '"protein":<g>,"carbs":<g>,"fat":<g>,"fiber":<g Ballaststoffe>,"sugar":<g Zucker>,' +
  '"sat_fat":<g gesättigte Fettsäuren>,"salt":<g Salz>}]}. Zahlen gerundet, realistische ' +
  'Schätzung. Mehrere Bestandteile = mehrere items.'

/** Menge in g (oder null, wenn unbekannt/unlesbar). */
function amountG(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = num(v, NaN)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
}

/** Extra-Nährwerte robust aus einem beliebigen Objekt lesen. */
function micros(i: Partial<FoodEstimate>) {
  return {
    fiber: Math.round(nn(i.fiber) * 10) / 10,
    sugar: Math.round(nn(i.sugar) * 10) / 10,
    sat_fat: Math.round(nn(i.sat_fat) * 10) / 10,
    salt: Math.round(nn(i.salt) * 100) / 100,
  }
}

function toEstimates(text: string): FoodEstimate[] {
  return toEstimateList(parseJson<{ items?: Partial<FoodEstimate>[] }>(text).items)
}

function toEstimateList(items: Partial<FoodEstimate>[] | undefined): FoodEstimate[] {
  return (Array.isArray(items) ? items : []).map((i) => ({
    name: String(i.name ?? 'Lebensmittel'),
    amount_g: amountG(i.amount_g),
    kcal: Math.round(nn(i.kcal)),
    protein: Math.round(nn(i.protein)),
    carbs: Math.round(nn(i.carbs)),
    fat: Math.round(nn(i.fat)),
    ...micros(i),
  }))
}

/** Nährwerte aus einem Foto schätzen (image = Data-URL), optional mit Zusatzinfo. */
export async function estimateFoodFromImage(image: string, hint?: string): Promise<FoodEstimate[]> {
  const prompt =
    'Erkenne das Essen auf dem Bild und schätze die Nährwerte der abgebildeten Portion. ' +
    (hint ? `Zusatzinfo vom Nutzer (Zutaten/Mengen unbedingt berücksichtigen): "${hint}". ` : '') +
    NUTRITION_FORMAT
  return toEstimates(await complete({ system: NUTRITION_SYSTEM, prompt, image, json: true, temperature: 0.2 }))
}

/** Nährwerte aus freier Texteingabe schätzen, z. B. „2 Eier und 80 g Haferflocken". */
export async function estimateFoodFromText(text: string): Promise<FoodEstimate[]> {
  const prompt = `Beschreibung: "${text}".\n${NUTRITION_FORMAT}`
  return toEstimates(await complete({ system: NUTRITION_SYSTEM, prompt, json: true, temperature: 0.2 }))
}

/** Mahlzeit-Analyse: Bestandteile + kurzer Titel + Ein-Satz-Einschätzung. */
export interface MealAnalysis {
  title: string
  verdict: string
  items: FoodEstimate[]
  /** KI-Hinweise für den Score (tierische Produkte, Verarbeitung) — optional. */
  flags?: MealFlags
}

const ANIMAL_FLAGS = ['meat', 'fish', 'dairy_egg', 'none'] as const

/** Liest {animal, processing} robust; undefined, wenn nichts Brauchbares kommt. */
export function toMealFlags(raw: unknown): MealFlags | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { animal?: unknown; processing?: unknown }
  const flags: MealFlags = {}
  if ((ANIMAL_FLAGS as readonly unknown[]).includes(r.animal)) flags.animal = r.animal as MealFlags['animal']
  const p = Math.round(num(r.processing, NaN))
  if (Number.isFinite(p)) flags.processing = Math.min(4, Math.max(1, p))
  return flags.animal || flags.processing ? flags : undefined
}

/** Titel aus den Bestandteilen, falls die KI keinen liefert. */
function fallbackTitle(items: FoodEstimate[]): string {
  const names = items.slice(0, 3).map((i) => i.name)
  return names.length ? names.join(' & ') : 'Mahlzeit'
}

/** Parst eine Analyse-Antwort ({title, verdict, items}) robust. */
export function toMealAnalysis(text: string): MealAnalysis {
  const raw = parseJson<{ title?: unknown; verdict?: unknown; items?: Partial<FoodEstimate>[]; flags?: unknown }>(text)
  const items = toEstimateList(raw.items)
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 60) : ''
  const verdict = typeof raw.verdict === 'string' ? raw.verdict.trim().slice(0, 200) : ''
  const flags = toMealFlags(raw.flags)
  return { title: title || fallbackTitle(items), verdict, items, ...(flags ? { flags } : {}) }
}

/**
 * Mahlzeit aus Foto (image = Data-URL, optional hint) ODER Text analysieren. Wie
 * estimateFoodFromImage/-Text, liefert zusätzlich einen Titel und eine kurze
 * Einschätzung. `goal` = Klartext-Ziel des Nutzers (z. B. „Abnehmen"), optional.
 */
export async function analyzeMeal(input: {
  image?: string
  hint?: string
  text?: string
  goal?: string
}): Promise<MealAnalysis> {
  const diet = dietContext()
  const meta =
    ' Zusätzlich: "title" = kurzer deutscher Name der ganzen Mahlzeit (max. 40 Zeichen, z. B. ' +
    '"Hähnchen mit Reis & Brokkoli") und "verdict" = EIN kurzer, freundlicher deutscher Satz ' +
    '(max. 110 Zeichen) mit ehrlicher Einschätzung und konkretem Tipp' +
    (input.goal ? ` passend zum Ziel des Nutzers („${input.goal}")` : '') +
    (diet ? ' und zur Ernährungsweise (weise freundlich auf Verstöße hin)' : '') +
    '. Außerdem "flags": {"animal":"meat|fish|dairy_egg|none" (strengste enthaltene tierische ' +
    'Zutat: Fleisch/Wurst > Fisch/Meeresfrüchte > Milch/Käse/Ei/Honig > keine),"processing":1-4 ' +
    '(Verarbeitungsgrad wie NOVA: 1 unverarbeitet … 4 stark verarbeitetes Fertigprodukt)}. ' +
    'Gesamtformat: {"title":"...","verdict":"...","flags":{...},"items":[...]}.' +
    diet
  const prompt = input.image
    ? 'Erkenne das Essen auf dem Bild und schätze die Nährwerte der abgebildeten Portion. ' +
      (input.hint ? `Zusatzinfo vom Nutzer (Zutaten/Mengen unbedingt berücksichtigen): "${input.hint}". ` : '') +
      NUTRITION_FORMAT +
      meta
    : `Beschreibung: "${input.text ?? ''}".\n${NUTRITION_FORMAT}${meta}`
  const text = await complete({
    system: NUTRITION_SYSTEM,
    prompt,
    image: input.image,
    json: true,
    temperature: 0.2,
    maxTokens: 1200,
  })
  return toMealAnalysis(text)
}

/** Empfiehlt eine konkrete Bestellung/Auswahl (Restaurant, Kette oder Supermarkt),
 *  die zum Rest-Kalorienbudget passt und viel Eiweiß liefert. */
export async function suggestOrder(
  place: string,
  remaining: { kcal: number; protein: number },
  wish: string,
): Promise<{ note: string; items: FoodEstimate[] }> {
  const system =
    'Du bist Ernährungsberater. Der Nutzer nennt einen Anbieter, eine Küche oder eine Restaurant-Art ' +
    '(z. B. „Indisch", „Mexikanisch", „Asiatisch", „McDonald\'s", „Supermarkt"). Empfiehl eine konkrete, ' +
    'typische Auswahl/Bestellung dieser Art, die möglichst nah an das Rest-Kalorienbudget kommt und ' +
    'viel Eiweiß liefert. Nenne echte, gängige Gerichte/Produkte. Antworte ausschließlich mit JSON.'
  const prompt =
    `Anbieter/Küche/Art: "${place}". Rest-Budget heute: ~${remaining.kcal} kcal, Ziel Eiweiß offen: ~${remaining.protein} g. ` +
    `Wunsch: "${wish || 'egal'}".\n` +
    `Gib die empfohlenen Artikel als items zurück. ${NUTRITION_FORMAT}\n` +
    'Zusätzlich ein Feld "note" mit einem kurzen Hinweis. ' +
    'Format: {"note":"...","items":[{"name":"...","amount_g":null,"kcal":...,"protein":...,"carbs":...,"fat":...}]}' +
    prefClause()
  const text = await complete({ system, prompt, json: true, temperature: 0.4 })
  const raw = parseJson<{ note?: string; items?: Partial<FoodEstimate>[] }>(text)
  return {
    note: String(raw.note ?? ''),
    items: (raw.items ?? []).map((i) => ({
      name: String(i.name ?? 'Artikel'),
      amount_g: amountG(i.amount_g),
      kcal: Math.round(nn(i.kcal)),
      protein: Math.round(nn(i.protein)),
      carbs: Math.round(nn(i.carbs)),
      fat: Math.round(nn(i.fat)),
      ...micros(i),
    })),
  }
}

// ---------------------------------------------------------------------------
// Feature: Einkaufsassistent (Wochen-Einkaufsliste)
// ---------------------------------------------------------------------------

export interface ShoppingCategory {
  category: string
  items: string[]
}

export async function shoppingList(
  days: number,
  targets: { kcal: number; protein: number },
  wish: string,
): Promise<{ note: string; categories: ShoppingCategory[] }> {
  const system =
    'Du bist Ernährungsberater. Erstelle eine praktische Einkaufsliste für den genannten Zeitraum, ' +
    'passend zu den Tageszielen. Gruppiere nach Kategorie und gib grobe Mengen an. ' +
    'Antworte ausschließlich mit JSON.'
  const prompt =
    `Zeitraum: ${days} Tage. Tagesziel: ~${targets.kcal} kcal, ~${targets.protein} g Eiweiß. ` +
    `Wunsch/Präferenzen: "${wish || 'ausgewogen, proteinreich'}".\n` +
    'Format: {"note":"kurzer Hinweis","categories":[{"category":"z. B. Obst & Gemüse","items":["500 g Hähnchen", "..."]}]}. ' +
    'Realistische Mengen für den Zeitraum, deutsch.' +
    prefClause()
  const text = await complete({ system, prompt, json: true, temperature: 0.5 })
  const raw = parseJson<{ note?: string; categories?: Partial<ShoppingCategory>[] }>(text)
  return {
    note: String(raw.note ?? ''),
    categories: (raw.categories ?? [])
      .map((c) => ({ category: String(c.category ?? 'Sonstiges'), items: (c.items ?? []).map(String) }))
      .filter((c) => c.items.length),
  }
}

// ---------------------------------------------------------------------------
// Feature: Ganzer Ernährungsplan (mehrtägig) inkl. Einkaufsliste
// ---------------------------------------------------------------------------

const MEAL_KEYS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** Antwortlänge für mehrtägige Pläne: ~1200 Tokens pro Tag (+ Einkaufsliste), max. 16000. */
function planTokens(days: number): number {
  return Math.min(16000, Math.max(4096, Math.round(days) * 1200 + 1500))
}

export interface WeeklyPlan {
  note: string
  days: PlanDay[]
  shopping: ShoppingCat[]
}

/**
 * Erstellt einen mehrtägigen Essensplan, der die Tagesziele trifft und die
 * festen Routinen (z. B. täglicher Proteinshake) JEDEN Tag mit einplant.
 * Liefert zusätzlich eine daraus abgeleitete Einkaufsliste.
 */
export async function generateWeeklyPlan(input: {
  days: number
  targets: { kcal: number; protein: number }
  routines: { meal: Meal; title: string; kcal: number; protein: number }[]
  wish: string
}): Promise<WeeklyPlan> {
  const system =
    'Du bist Ernährungsberater und Meal-Prep-Profi. Erstelle einen realistischen, ' +
    'abwechslungsreichen Essensplan über mehrere Tage, der die Tagesziele möglichst trifft. ' +
    'Feste Routinen MUSST du an JEDEM Tag exakt so einplanen (Feld routine=true). ' +
    'Antworte ausschließlich mit JSON.'
  const routineText = input.routines.length
    ? input.routines
        .map((r) => `- ${r.meal}: ${r.title} (~${r.kcal} kcal, ${r.protein} g Eiweiß)`)
        .join('\n')
    : '(keine)'
  const prompt =
    `Tage: ${input.days}. Tagesziel: ~${input.targets.kcal} kcal, ~${input.targets.protein} g Eiweiß.\n` +
    `Feste Routinen (jeden Tag einplanen):\n${routineText}\n` +
    `Wunsch/Präferenzen: "${input.wish || 'ausgewogen, proteinreich, alltagstauglich'}".\n` +
    'Format: {"note":"kurzer Hinweis","days":[{"label":"Tag 1","meals":[{"meal":"breakfast|lunch|dinner|snack",' +
    '"name":"...","kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"routine":true|false}]}],' +
    '"shopping":[{"category":"z. B. Obst & Gemüse","items":["500 g Hähnchen","..."]}]}. ' +
    `Genau ${input.days} Tage. Die Einkaufsliste deckt ALLE Tage ab, mit groben Mengen, nach Kategorie. Deutsch.` +
    prefClause()
  const text = await complete({ system, prompt, json: true, temperature: 0.6, maxTokens: planTokens(input.days) })
  const raw = parseJson<{
    note?: string
    days?: { label?: string; meals?: Record<string, unknown>[] }[]
    shopping?: Partial<ShoppingCat>[]
  }>(text)
  const days: PlanDay[] = (raw.days ?? []).map((d, i) => ({
    label: String(d.label ?? `Tag ${i + 1}`),
    meals: (d.meals ?? []).map((m) => ({
      meal: (MEAL_KEYS.includes(String(m.meal) as Meal) ? m.meal : 'snack') as Meal,
      name: String(m.name ?? 'Mahlzeit'),
      kcal: Math.round(nn(m.kcal)),
      protein: Math.round(nn(m.protein)),
      carbs: Math.round(nn(m.carbs)),
      fat: Math.round(nn(m.fat)),
      routine: Boolean(m.routine),
    })),
  }))
  const shopping: ShoppingCat[] = (raw.shopping ?? [])
    .map((c) => ({ category: String(c.category ?? 'Sonstiges'), items: (c.items ?? []).map(String) }))
    .filter((c) => c.items.length)
  return { note: String(raw.note ?? ''), days, shopping }
}

/** Passt einen bestehenden Plan per Anweisung an (z. B. „günstiger", „mehr Eiweiß"). */
export async function adjustWeeklyPlan(input: {
  current: WeeklyPlan
  instruction: string
  targets: { kcal: number; protein: number }
}): Promise<WeeklyPlan> {
  const system =
    'Du bist Ernährungsberater. Du bekommst einen bestehenden Essensplan (JSON) und eine ' +
    'Änderungsanweisung. Gib den ANGEPASSTEN Plan im GLEICHEN JSON-Format zurück, inklusive ' +
    'aktualisierter Einkaufsliste. Behalte gute Teile bei. Antworte ausschließlich mit JSON.'
  const prompt =
    `Bestehender Plan (JSON):\n${JSON.stringify({ days: input.current.days, shopping: input.current.shopping })}\n\n` +
    `Änderungswunsch: "${input.instruction}".\n` +
    `Tagesziel bleibt ~${input.targets.kcal} kcal, ~${input.targets.protein} g Eiweiß.\n` +
    'Gleiches Format: {"note":"was du geändert hast","days":[{"label":"...","meals":[{"meal":"...",' +
    '"name":"...","kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"routine":true|false}]}],' +
    '"shopping":[{"category":"...","items":["..."]}]}. Deutsch.' +
    prefClause()
  const text = await complete({
    system,
    prompt,
    json: true,
    temperature: 0.5,
    maxTokens: planTokens(input.current.days.length),
  })
  const raw = parseJson<{
    note?: string
    days?: { label?: string; meals?: Record<string, unknown>[] }[]
    shopping?: Partial<ShoppingCat>[]
  }>(text)
  const days: PlanDay[] = (raw.days ?? []).map((d, i) => ({
    label: String(d.label ?? `Tag ${i + 1}`),
    meals: (d.meals ?? []).map((m) => ({
      meal: (MEAL_KEYS.includes(String(m.meal) as Meal) ? m.meal : 'snack') as Meal,
      name: String(m.name ?? 'Mahlzeit'),
      kcal: Math.round(nn(m.kcal)),
      protein: Math.round(nn(m.protein)),
      carbs: Math.round(nn(m.carbs)),
      fat: Math.round(nn(m.fat)),
      routine: Boolean(m.routine),
    })),
  }))
  const shopping: ShoppingCat[] = (raw.shopping ?? [])
    .map((c) => ({ category: String(c.category ?? 'Sonstiges'), items: (c.items ?? []).map(String) }))
    .filter((c) => c.items.length)
  return { note: String(raw.note ?? ''), days, shopping }
}

// ---------------------------------------------------------------------------
// Feature: Rezept aus Kühlschrank-Foto (+ Wunsch)
// ---------------------------------------------------------------------------

export interface Recipe {
  title: string
  servings: number
  ingredients: string[]
  steps: string[]
  nutrition: {
    kcal: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
    sat_fat: number
    salt: number
  }
}

function recipeNutrition(n: Partial<Recipe['nutrition']> | undefined): Recipe['nutrition'] {
  return {
    kcal: Math.round(nn(n?.kcal)),
    protein: Math.round(nn(n?.protein)),
    carbs: Math.round(nn(n?.carbs)),
    fat: Math.round(nn(n?.fat)),
    fiber: Math.round(nn(n?.fiber) * 10) / 10,
    sugar: Math.round(nn(n?.sugar) * 10) / 10,
    sat_fat: Math.round(nn(n?.sat_fat) * 10) / 10,
    salt: Math.round(nn(n?.salt) * 100) / 100,
  }
}

export async function recipeFromFridge(image: string, craving: string): Promise<Recipe> {
  const system =
    'Du bist Koch und Ernährungsberater. Erkenne die Zutaten im Bild und schlage EIN ' +
    'umsetzbares Rezept vor, das primär diese Zutaten nutzt (Grundzutaten wie Öl, Salz, ' +
    'Gewürze darfst du annehmen). Antworte ausschließlich mit JSON.'
  const prompt =
    `Wunsch des Nutzers: "${craving || 'egal, Hauptsache lecker'}".\n` +
    'Gib ein Rezept passend zum Wunsch aus den sichtbaren Zutaten. ' +
    'Nährwerte pro Portion schätzen (inkl. Ballaststoffe, Zucker, gesättigte Fette, Salz). ' +
    'Format: {"title":"...","servings":<Zahl>,"ingredients":["..."],"steps":["..."],' +
    '"nutrition":{"kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>,"fiber":<g>,"sugar":<g>,"sat_fat":<g>,"salt":<g>}}. Auf Deutsch.' +
    prefClause()
  const text = await complete({ system, prompt, image, json: true, temperature: 0.5 })
  const r = parseJson<Partial<Recipe>>(text)
  return {
    title: String(r.title ?? 'Rezept'),
    servings: Math.max(1, num(r.servings, 1)),
    ingredients: (r.ingredients ?? []).map(String),
    steps: (r.steps ?? []).map(String),
    nutrition: recipeNutrition(r.nutrition),
  }
}

// ---------------------------------------------------------------------------
// Feature: Muskeln zu einer Übung vorschlagen (Primär + Sekundär)
// ---------------------------------------------------------------------------

export interface MuscleSuggestion {
  primary: MuscleGroup
  secondary: MuscleGroup[]
}

export interface ExerciseDraft {
  name: string
  muscle_group: MuscleGroup
  secondary_muscles: MuscleGroup[]
  unilateral: boolean
  weight_steps: string | null
  target_rep_min: number
  target_rep_max: number
  increment: number
  /** Gerät, zu dem der Vorschlag gehört (nur beim Geräte-Import). */
  device?: string
}

/** Freitext/Sprache → fertiger Übungs-Entwurf (Muskeln + Gewichtsstufen). */
export async function parseNewExercise(text: string): Promise<ExerciseDraft> {
  const groups = MUSCLE_GROUPS.join(', ')
  const system =
    'Du bist ein Trainings-Assistent. Aus der Beschreibung einer neuen Fitnessübung ' +
    '(evtl. mit Gewichtsstufen der Maschine) erstellst du einen strukturierten Entwurf. ' +
    'Antworte ausschließlich mit JSON.'
  const prompt =
    `Beschreibung: "${text}".\n` +
    `Erlaubte Muskelgruppen (exakt so): ${groups}.\n` +
    'Bestimme: name, muscle_group (primärer Mover), secondary_muscles (0–3, ohne primär), ' +
    'unilateral (true, wenn einseitig/links-rechts getrennt), weight_steps ' +
    '(Leerzeichen-getrennte reale Gewichte, aus der Beschreibung BERECHNET — z. B. ' +
    '"5er Schritte von 20 bis 40" → "20 25 30 35 40"; inkl. genannter Zusatzgewichte; ' +
    'leer/"" wenn keine genannt), target_rep_min, target_rep_max, increment (kg-Schritt). ' +
    'Format: {"name":"...","muscle_group":"...","secondary_muscles":["..."],' +
    '"unilateral":false,"weight_steps":"...","target_rep_min":8,"target_rep_max":12,"increment":2.5}.'
  const t = await complete({ system, prompt, json: true, temperature: 0.2 })
  const r = parseJson<Partial<ExerciseDraft>>(t)
  const valid = (g: string): g is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(g)
  const primary = r.muscle_group && valid(r.muscle_group) ? r.muscle_group : 'Sonstige'
  const min = Math.max(1, Math.round(Number(r.target_rep_min ?? 8)) || 8)
  const max = Math.max(min, Math.round(Number(r.target_rep_max ?? 12)) || min)
  const steps = typeof r.weight_steps === 'string' ? r.weight_steps.trim() : ''
  return {
    name: String(r.name ?? text).slice(0, 60),
    muscle_group: primary,
    secondary_muscles: (r.secondary_muscles ?? []).filter(valid).filter((g) => g !== primary).slice(0, 3),
    unilateral: Boolean(r.unilateral),
    weight_steps: steps || null,
    target_rep_min: min,
    target_rep_max: max,
    increment: Number(r.increment) > 0 ? Number(r.increment) : 2.5,
  }
}

/** KI-Empfehlung, ob für die aktuelle Übung ein Aufwärmsatz sinnvoll ist. */
export async function warmupAdvice(input: {
  exercise: string
  primary: string
  secondary: string[]
  muscleAlreadyWarm: boolean
  firstOfSession: boolean
  base: number
}): Promise<{ warmup: boolean; reason: string }> {
  const system =
    'Du bist ein Kraft-Coach. Entscheide, ob für den nächsten Arbeitssatz ein Aufwärmsatz sinnvoll ' +
    'ist. Faustregeln: erste Übung einer Muskelgruppe bzw. erste schwere Bewegung der Einheit → ' +
    'Aufwärmsatz; wenn der Muskel schon warm ist (vorher trainiert) oder es eine leichte ' +
    'Isolationsübung ist → weglassen. Antworte ausschließlich mit JSON.'
  const prompt =
    `Übung: "${input.exercise}" (primär ${input.primary}` +
    (input.secondary.length ? `, sekundär ${input.secondary.join(', ')}` : '') +
    `). Muskel heute schon trainiert: ${input.muscleAlreadyWarm ? 'ja' : 'nein'}. ` +
    `Erste Übung der Einheit: ${input.firstOfSession ? 'ja' : 'nein'}. Arbeitsgewicht ~${input.base} kg.\n` +
    'Format: {"warmup":true|false,"reason":"kurze Begründung auf Deutsch"}.'
  try {
    const text = await complete({ system, prompt, json: true, temperature: 0.2 })
    const r = parseJson<{ warmup?: boolean; reason?: string }>(text)
    return { warmup: Boolean(r.warmup), reason: String(r.reason ?? '') }
  } catch (e) {
    throw e instanceof Error ? e : new Error('KI-Fehler')
  }
}

function normalizeDraft(d: Partial<ExerciseDraft>): ExerciseDraft {
  const valid = (g: string): g is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(g)
  const primary = d.muscle_group && valid(d.muscle_group) ? d.muscle_group : 'Sonstige'
  const min = Math.max(1, Math.round(Number(d.target_rep_min ?? 8)) || 8)
  const max = Math.max(min, Math.round(Number(d.target_rep_max ?? 12)) || min)
  const steps = typeof d.weight_steps === 'string' ? d.weight_steps.trim() : ''
  return {
    name: String(d.name ?? 'Übung').slice(0, 60),
    muscle_group: primary,
    secondary_muscles: (d.secondary_muscles ?? []).filter(valid).filter((g) => g !== primary).slice(0, 3),
    unilateral: Boolean(d.unilateral),
    weight_steps: steps || null,
    target_rep_min: min,
    target_rep_max: max,
    increment: Number(d.increment) > 0 ? Number(d.increment) : 2.5,
    ...(typeof d.device === 'string' && d.device.trim()
      ? { device: d.device.trim().slice(0, 60) }
      : {}),
  }
}

/**
 * Ganze Geräteliste (Text oder Foto) → mehrere Übungs-Entwürfe.
 * Multifunktions-Geräte (Kabelzug, Multipresse, Bank …) liefern mehrere typische
 * Übungen, Einzweck-Maschinen genau eine. `device` ordnet jeden Entwurf seinem Gerät zu.
 */
export async function parseEquipmentList(text: string, image?: string): Promise<ExerciseDraft[]> {
  const groups = MUSCLE_GROUPS.join(', ')
  const system =
    'Du bist ein Trainings-Assistent. Aus einer Liste bzw. einem Foto von Fitnessgeräten/Maschinen ' +
    'erstellst du Übungs-Entwürfe. Einzweck-Maschinen (z. B. Beinpresse, Latzug, Brustpresse, ' +
    'Beinstrecker, Beinbeuger, Rudermaschine) → genau EINE Übung. Multifunktions-Geräte ' +
    '(z. B. Kabelzug/Kabelturm, Functional Trainer, Multipresse/Smith Machine, Kurzhantelbank, ' +
    'Kurzhanteln, Langhantel-Rack, Klimmzugstange/Dip-Station) → 3–6 typische, verschiedene ' +
    'Übungen, die wichtigste zuerst (z. B. Kabelzug → Trizepsdrücken am Kabel, Face Pulls, ' +
    'Kabelrudern, Cable Flys, Bizepscurls am Kabel). Antworte ausschließlich mit JSON.'
  const prompt =
    (text ? `Geräte: "${text}".\n` : 'Erkenne die Geräte im Bild.\n') +
    `Erlaubte Muskelgruppen (exakt): ${groups}.\n` +
    'Format: {"exercises":[{"device":"<Gerätename>","name":"...","muscle_group":"...",' +
    '"secondary_muscles":["..."],"unilateral":false,"weight_steps":"","target_rep_min":8,' +
    '"target_rep_max":12,"increment":2.5}]}. ' +
    '"device" ist bei allen Übungen desselben Geräts identisch (kurzer deutscher Gerätename). ' +
    'Übungen eines Geräts direkt hintereinander auflisten. Keine doppelten Übungsnamen. ' +
    'weight_steps leer lassen (kann der Nutzer später ergänzen).'
  const t = await complete({ system, prompt, image, json: true, temperature: 0.2 })
  const raw = parseJson<{ exercises?: Partial<ExerciseDraft>[] }>(t)
  return (raw.exercises ?? []).map(normalizeDraft).filter((d) => d.name)
}

/** Beste Ersatzübung aus den VERFÜGBAREN Übungen (Gerät besetzt). */
export async function alternativeExercise(
  target: { name: string; muscle: string; secondary: string[] },
  available: { name: string; muscle: string }[],
): Promise<{ name: string | null; reason: string }> {
  const list = available.map((e) => `${e.name} (${e.muscle})`).join(', ')
  const system =
    'Du hilfst, wenn ein Gerät besetzt ist. Wähle die beste Ersatzübung, die AUSSCHLIESSLICH aus ' +
    'der Liste der verfügbaren Übungen stammt und dieselben Muskeln trifft. Antworte nur mit JSON.'
  const prompt =
    `Besetzt: "${target.name}" (primär ${target.muscle}, sekundär ${target.secondary.join(', ') || '—'}).\n` +
    `Verfügbare Übungen: ${list}.\n` +
    'Wähle EINEN exakten Namen aus der Liste als Alternative. ' +
    'Format: {"name":"<exakter Name oder null>","reason":"kurze Begründung"}.'
  const t = await complete({ system, prompt, json: true, temperature: 0.3 })
  const r = parseJson<{ name?: string | null; reason?: string }>(t)
  const match = available.find((e) => e.name.toLowerCase() === String(r.name ?? '').toLowerCase())
  return { name: match ? match.name : null, reason: String(r.reason ?? '') }
}

export async function suggestMuscles(exerciseName: string): Promise<MuscleSuggestion> {
  const groups = MUSCLE_GROUPS.join(', ')
  const system =
    'Du bist ein Sport-/Trainingswissenschaftler. Ordne einer Fitnessübung die ' +
    'trainierten Muskelgruppen zu. Antworte ausschließlich mit JSON.'
  const prompt =
    `Übung: "${exerciseName}".\n` +
    `Erlaubte Muskelgruppen (nutze exakt diese Schreibweise): ${groups}.\n` +
    'Gib den Primär-Mover und die wichtigsten Sekundärmuskeln zurück. ' +
    'Format: {"primary":"<eine Gruppe>","secondary":["<Gruppe>", ...]}. ' +
    'secondary maximal 3 Einträge, ohne primary zu wiederholen. ' +
    'Wenn unklar, nutze "Sonstige" als primary und [] als secondary.'
  const text = await complete({ system, prompt, json: true, temperature: 0.2 })
  const raw = parseJson<{ primary: string; secondary: string[] }>(text)
  const valid = (g: string): g is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(g)
  const primary = valid(raw.primary) ? raw.primary : 'Sonstige'
  const secondary = (raw.secondary ?? [])
    .filter(valid)
    .filter((g) => g !== primary)
    .slice(0, 3)
  return { primary, secondary }
}

/**
 * Ordnet eigene Übungen in EINEM Aufruf der Übungsbibliothek zu. Pro Übung
 * darf nur eine der mitgegebenen Kandidaten-IDs gewählt werden (sonst null).
 * Ergebnis: { [Übungs-ID]: Bibliotheks-ID | null }.
 */
export async function matchExercisesToLibrary(
  items: { id: string; name: string; muscle: string }[],
  candidates: Record<string, { id: string; name: string; name_en?: string; muscle?: string }[]>,
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  const withCands = items.filter((it) => (candidates[it.id] ?? []).length > 0)
  for (const it of items) out[it.id] = null
  if (withCands.length === 0) return out

  const lines = withCands.map((it, i) => {
    const cands = (candidates[it.id] ?? [])
      .map((c) => `    - ${c.id}: ${c.name}${c.name_en ? ` / ${c.name_en}` : ''}${c.muscle ? ` (${c.muscle})` : ''}`)
      .join('\n')
    return `${i + 1}. key=${it.id} · "${it.name}" (${it.muscle})\n  Kandidaten:\n${cands}`
  })
  const system =
    'Du ordnest selbst benannte Fitnessübungen einer Übungsdatenbank zu. Wähle je Übung den ' +
    'Kandidaten, der dieselbe Bewegung beschreibt (gleiches Gerät, wenn erkennbar). Passt keiner ' +
    'wirklich, gib null zurück. Antworte ausschließlich mit JSON.'
  const prompt =
    `${lines.join('\n\n')}\n\n` +
    'Format: {"matches":{"<key>":"<Kandidaten-ID oder null>", ...}} — nutze nur IDs aus den Kandidaten der jeweiligen Übung.'
  const text = await complete({ system, prompt, json: true, temperature: 0.1, maxTokens: 1500 })
  const raw = parseJson<{ matches?: Record<string, unknown> }>(text)
  const matches = raw.matches ?? (raw as Record<string, unknown>)
  for (const it of withCands) {
    const v = matches[it.id]
    const allowed = candidates[it.id] ?? []
    out[it.id] = typeof v === 'string' && allowed.some((c) => c.id === v) ? v : null
  }
  return out
}
