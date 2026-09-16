// Client-seitige KI-Anbindung. Alle Feature-Aufrufe gehen über die
// Serverless-Funktion /api/ai (dort liegt der Key). Die Prompts sind nicht
// geheim und leben deshalb hier — pro Feature ein typisierter Helfer.

import { MUSCLE_GROUPS, type MuscleGroup } from '../types'

export interface AiStatus {
  enabled: boolean
  provider: string
  model: string
}

async function complete(opts: {
  system?: string
  prompt: string
  json?: boolean
  temperature?: number
  image?: string
}): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || `KI-Fehler (${res.status})`)
  }
  const data = (await res.json()) as { text: string }
  return data.text
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

/** Robustes JSON-Parsing (entfernt evtl. Code-Fences). */
function parseJson<T>(text: string): T {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  return JSON.parse(clean) as T
}

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
    'Bei log_food schätze realistische Nährwerte der genannten Menge.'
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
      amount_g: i.amount_g == null ? null : Number(i.amount_g),
      kcal: Math.round(Number(i.kcal ?? 0)),
      protein: Math.round(Number(i.protein ?? 0)),
      carbs: Math.round(Number(i.carbs ?? 0)),
      fat: Math.round(Number(i.fat ?? 0)),
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
    '"name":"...","kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>}]}. 4–6 Einträge, deutsch.'
  const text = await complete({ system, prompt, json: true, temperature: 0.5 })
  const raw = parseJson<{ note?: string; items?: Partial<MealPlanItem>[] }>(text)
  const meals = ['breakfast', 'lunch', 'dinner', 'snack']
  return {
    note: String(raw.note ?? ''),
    items: (raw.items ?? []).map((i) => ({
      meal: (meals.includes(String(i.meal)) ? i.meal : 'snack') as MealPlanItem['meal'],
      name: String(i.name ?? 'Mahlzeit'),
      kcal: Math.round(Number(i.kcal ?? 0)),
      protein: Math.round(Number(i.protein ?? 0)),
      carbs: Math.round(Number(i.carbs ?? 0)),
      fat: Math.round(Number(i.fat ?? 0)),
    })),
  }
}

export async function recipeFromText(request: string): Promise<Recipe> {
  const system =
    'Du bist Koch und Ernährungsberater. Erstelle EIN Rezept passend zur Anfrage. ' +
    'Antworte ausschließlich mit JSON.'
  const prompt =
    `Anfrage: "${request}".\n` +
    'Format: {"title":"...","servings":<Zahl>,"ingredients":["..."],"steps":["..."],' +
    '"nutrition":{"kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>}}. Nährwerte pro Portion. Deutsch.'
  const text = await complete({ system, prompt, json: true, temperature: 0.6 })
  const r = parseJson<Partial<Recipe>>(text)
  return {
    title: String(r.title ?? 'Rezept'),
    servings: Number(r.servings ?? 1) || 1,
    ingredients: (r.ingredients ?? []).map(String),
    steps: (r.steps ?? []).map(String),
    nutrition: {
      kcal: Math.round(Number(r.nutrition?.kcal ?? 0)),
      protein: Math.round(Number(r.nutrition?.protein ?? 0)),
      carbs: Math.round(Number(r.nutrition?.carbs ?? 0)),
      fat: Math.round(Number(r.nutrition?.fat ?? 0)),
    },
  }
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

export interface FoodEstimate {
  name: string
  amount_g: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
}

const NUTRITION_SYSTEM =
  'Du bist Ernährungsberater. Schätze Lebensmittel und ihre Nährwerte für die ' +
  'GEZEIGTE bzw. BESCHRIEBENE Portion (nicht pro 100 g). Antworte ausschließlich mit JSON.'

const NUTRITION_FORMAT =
  'Format: {"items":[{"name":"...","amount_g":<Zahl oder null>,"kcal":<Zahl>,' +
  '"protein":<g>,"carbs":<g>,"fat":<g>}]}. Zahlen gerundet, realistische Schätzung. ' +
  'Mehrere Bestandteile = mehrere items.'

function toEstimates(text: string): FoodEstimate[] {
  const raw = parseJson<{ items?: Partial<FoodEstimate>[] }>(text)
  return (raw.items ?? []).map((i) => ({
    name: String(i.name ?? 'Lebensmittel'),
    amount_g: i.amount_g == null ? null : Number(i.amount_g),
    kcal: Math.round(Number(i.kcal ?? 0)),
    protein: Math.round(Number(i.protein ?? 0)),
    carbs: Math.round(Number(i.carbs ?? 0)),
    fat: Math.round(Number(i.fat ?? 0)),
  }))
}

/** Nährwerte aus einem Foto schätzen (image = Data-URL). */
export async function estimateFoodFromImage(image: string): Promise<FoodEstimate[]> {
  const prompt =
    'Erkenne das Essen auf dem Bild und schätze die Nährwerte der abgebildeten Portion. ' +
    NUTRITION_FORMAT
  return toEstimates(await complete({ system: NUTRITION_SYSTEM, prompt, image, json: true, temperature: 0.2 }))
}

/** Nährwerte aus freier Texteingabe schätzen, z. B. „2 Eier und 80 g Haferflocken". */
export async function estimateFoodFromText(text: string): Promise<FoodEstimate[]> {
  const prompt = `Beschreibung: "${text}".\n${NUTRITION_FORMAT}`
  return toEstimates(await complete({ system: NUTRITION_SYSTEM, prompt, json: true, temperature: 0.2 }))
}

// ---------------------------------------------------------------------------
// Feature: Rezept aus Kühlschrank-Foto (+ Wunsch)
// ---------------------------------------------------------------------------

export interface Recipe {
  title: string
  servings: number
  ingredients: string[]
  steps: string[]
  nutrition: { kcal: number; protein: number; carbs: number; fat: number }
}

export async function recipeFromFridge(image: string, craving: string): Promise<Recipe> {
  const system =
    'Du bist Koch und Ernährungsberater. Erkenne die Zutaten im Bild und schlage EIN ' +
    'umsetzbares Rezept vor, das primär diese Zutaten nutzt (Grundzutaten wie Öl, Salz, ' +
    'Gewürze darfst du annehmen). Antworte ausschließlich mit JSON.'
  const prompt =
    `Wunsch des Nutzers: "${craving || 'egal, Hauptsache lecker'}".\n` +
    'Gib ein Rezept passend zum Wunsch aus den sichtbaren Zutaten. ' +
    'Nährwerte pro Portion schätzen. ' +
    'Format: {"title":"...","servings":<Zahl>,"ingredients":["..."],"steps":["..."],' +
    '"nutrition":{"kcal":<Zahl>,"protein":<g>,"carbs":<g>,"fat":<g>}}. Auf Deutsch.'
  const text = await complete({ system, prompt, image, json: true, temperature: 0.5 })
  const r = parseJson<Partial<Recipe>>(text)
  return {
    title: String(r.title ?? 'Rezept'),
    servings: Number(r.servings ?? 1) || 1,
    ingredients: (r.ingredients ?? []).map(String),
    steps: (r.steps ?? []).map(String),
    nutrition: {
      kcal: Math.round(Number(r.nutrition?.kcal ?? 0)),
      protein: Math.round(Number(r.nutrition?.protein ?? 0)),
      carbs: Math.round(Number(r.nutrition?.carbs ?? 0)),
      fat: Math.round(Number(r.nutrition?.fat ?? 0)),
    },
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
  }
}

/** Ganze Geräteliste (Text oder Foto) → mehrere Übungs-Entwürfe. */
export async function parseEquipmentList(text: string, image?: string): Promise<ExerciseDraft[]> {
  const groups = MUSCLE_GROUPS.join(', ')
  const system =
    'Du bist ein Trainings-Assistent. Aus einer Liste bzw. einem Foto von Fitnessgeräten/Maschinen ' +
    'erstellst du je Gerät einen Übungs-Entwurf. Antworte ausschließlich mit JSON.'
  const prompt =
    (text ? `Geräte: "${text}".\n` : 'Erkenne die Geräte im Bild.\n') +
    `Erlaubte Muskelgruppen (exakt): ${groups}.\n` +
    'Format: {"exercises":[{"name":"...","muscle_group":"...","secondary_muscles":["..."],' +
    '"unilateral":false,"weight_steps":"","target_rep_min":8,"target_rep_max":12,"increment":2.5}]}. ' +
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
