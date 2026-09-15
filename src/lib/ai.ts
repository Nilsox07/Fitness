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
