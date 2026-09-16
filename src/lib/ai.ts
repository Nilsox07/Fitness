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
// Feature: Muskeln zu einer Übung vorschlagen (Primär + Sekundär)
// ---------------------------------------------------------------------------

export interface MuscleSuggestion {
  primary: MuscleGroup
  secondary: MuscleGroup[]
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
