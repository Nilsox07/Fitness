// Monats-Saisons: Thema + 3 Saison-Quests + exklusives Abzeichen. Die KI denkt sich
// das Thema aus (für alle gleich, einmal pro Monat gespeichert); die Quests kommen
// aus festen Vorlagen, damit die App sie aus echten Daten auswerten kann.

export const QUEST_TYPES = {
  sessions: { min: 6, max: 20, label: (t) => `${t} Trainings diesen Monat` },
  muscle: { min: 3, max: 10, label: (t, m) => `${t}× ${m} trainieren` },
  protein_days: { min: 8, max: 25, label: (t) => `An ${t} Tagen Eiweißziel` },
  logged_days: { min: 10, max: 28, label: (t) => `An ${t} Tagen Essen eintragen` },
  water_days: { min: 8, max: 25, label: (t) => `An ${t} Tagen Trinkziel` },
  volume: { min: 10000, max: 200000, label: (t) => `${t.toLocaleString('de-DE')} kg bewegen` },
  prs: { min: 2, max: 10, label: (t) => `${t} neue Bestleistungen` },
}

export const MUSCLES = ['Beine', 'Brust', 'Rücken', 'Schultern', 'Arme', 'Bauch']

const EMOJI_RE = /\p{Extended_Pictographic}/u

/** Fallback-Themen, falls die KI nicht erreichbar ist (eins pro Monat). */
export const FALLBACK_THEMES = [
  {
    name: 'Neustart-Januar',
    emoji: '🚀',
    tagline: 'Neues Jahr, neue Routine – Hauptsache dranbleiben.',
    badge: { emoji: '🚀', label: 'Neustarter' },
    quests: [
      { type: 'sessions', target: 12 },
      { type: 'logged_days', target: 20 },
      { type: 'water_days', target: 15 },
    ],
  },
  {
    name: 'Kraft-Februar',
    emoji: '🏋️',
    tagline: 'Kurzer Monat, schwere Gewichte.',
    badge: { emoji: '🏋️', label: 'Kraftprotz' },
    quests: [
      { type: 'prs', target: 4 },
      { type: 'sessions', target: 10 },
      { type: 'protein_days', target: 15 },
    ],
  },
  {
    name: 'Frühlings-Erwachen',
    emoji: '🌱',
    tagline: 'Raus aus dem Winterschlaf!',
    badge: { emoji: '🌱', label: 'Frühstarter' },
    quests: [
      { type: 'sessions', target: 12 },
      { type: 'water_days', target: 18 },
      { type: 'logged_days', target: 20 },
    ],
  },
  {
    name: 'Rücken-April',
    emoji: '🦅',
    tagline: 'Breites Kreuz, gerade Haltung.',
    badge: { emoji: '🦅', label: 'Adlerflügel' },
    quests: [
      { type: 'muscle', muscle: 'Rücken', target: 6 },
      { type: 'sessions', target: 12 },
      { type: 'protein_days', target: 15 },
    ],
  },
  {
    name: 'Mai-Power',
    emoji: '⚡',
    tagline: 'Volle Energie in den Sommer.',
    badge: { emoji: '⚡', label: 'Energiebündel' },
    quests: [
      { type: 'volume', target: 50000 },
      { type: 'sessions', target: 12 },
      { type: 'water_days', target: 18 },
    ],
  },
  {
    name: 'Sommer-Form',
    emoji: '☀️',
    tagline: 'Die Form für den Sommer wird jetzt gemacht.',
    badge: { emoji: '☀️', label: 'Sonnenkind' },
    quests: [
      { type: 'protein_days', target: 18 },
      { type: 'sessions', target: 12 },
      { type: 'water_days', target: 20 },
    ],
  },
  {
    name: 'Hitze-Juli',
    emoji: '🌊',
    tagline: 'Viel trinken, trotzdem trainieren.',
    badge: { emoji: '🌊', label: 'Wellenreiter' },
    quests: [
      { type: 'water_days', target: 22 },
      { type: 'sessions', target: 10 },
      { type: 'logged_days', target: 18 },
    ],
  },
  {
    name: 'Arm-August',
    emoji: '💪',
    tagline: 'Ärmel hoch – im wahrsten Sinne.',
    badge: { emoji: '💪', label: 'Bizeps-Boss' },
    quests: [
      { type: 'muscle', muscle: 'Arme', target: 6 },
      { type: 'sessions', target: 12 },
      { type: 'protein_days', target: 15 },
    ],
  },
  {
    name: 'Comeback-September',
    emoji: '🔁',
    tagline: 'Zurück aus dem Urlaub, zurück in die Routine.',
    badge: { emoji: '🔁', label: 'Comeback-Kid' },
    quests: [
      { type: 'sessions', target: 12 },
      { type: 'logged_days', target: 20 },
      { type: 'prs', target: 3 },
    ],
  },
  {
    name: 'Beintag-Oktober',
    emoji: '🦵',
    tagline: 'Kein Beintag wird ausgelassen.',
    badge: { emoji: '🦵', label: 'Beinmaschine' },
    quests: [
      { type: 'muscle', muscle: 'Beine', target: 6 },
      { type: 'sessions', target: 12 },
      { type: 'protein_days', target: 15 },
    ],
  },
  {
    name: 'Eiweiß-November',
    emoji: '🥚',
    tagline: 'Muskeln werden in der Küche gemacht.',
    badge: { emoji: '🥚', label: 'Eiweiß-Profi' },
    quests: [
      { type: 'protein_days', target: 20 },
      { type: 'logged_days', target: 22 },
      { type: 'sessions', target: 10 },
    ],
  },
  {
    name: 'Durchhalte-Dezember',
    emoji: '🎄',
    tagline: 'Plätzchen ja – Training trotzdem.',
    badge: { emoji: '🎄', label: 'Durchhalter' },
    quests: [
      { type: 'sessions', target: 10 },
      { type: 'logged_days', target: 18 },
      { type: 'water_days', target: 15 },
    ],
  },
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)))
const str = (v, max, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)
const emoji = (v, fallback) =>
  typeof v === 'string' && EMOJI_RE.test(v) ? [...v.trim()].slice(0, 2).join('') : fallback

/** KI-Antwort (oder Fallback) in ein gültiges Thema übersetzen; Quests werden beschriftet. */
export function normalizeTheme(raw, month) {
  const fb = FALLBACK_THEMES[(Number(month.slice(5, 7)) - 1 + 12) % 12]
  const r = raw && typeof raw === 'object' ? raw : {}
  const qs = (Array.isArray(r.quests) ? r.quests : [])
    .filter((q) => q && QUEST_TYPES[q.type])
    .map((q) => {
      const def = QUEST_TYPES[q.type]
      const muscle = q.type === 'muscle' ? (MUSCLES.includes(q.muscle) ? q.muscle : 'Beine') : undefined
      const target = clamp(q.target, def.min, def.max)
      return { type: q.type, target, ...(muscle ? { muscle } : {}) }
    })
  // genau 3 Quests, keine doppelten Arten (muscle darf nur einmal)
  const seen = new Set()
  const quests = []
  for (const q of [...qs, ...fb.quests]) {
    const key = q.type
    if (seen.has(key)) continue
    seen.add(key)
    const def = QUEST_TYPES[q.type]
    quests.push({ ...q, label: def.label(q.target, q.muscle) })
    if (quests.length === 3) break
  }
  const name = str(r.name, 40, fb.name)
  const em = emoji(r.emoji, fb.emoji)
  return {
    id: month,
    name,
    emoji: em,
    tagline: str(r.tagline, 120, fb.tagline),
    badge: { emoji: emoji(r.badge?.emoji, em), label: str(r.badge?.label, 30, fb.badge.label) },
    quests,
  }
}

export function seasonPrompt(month) {
  const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  return (
    `Erfinde das Saison-Thema für ${monthName} in einer deutschen Fitness- und Ernährungs-App für Freunde. ` +
    'Passend zur Jahreszeit, motivierend, mit etwas Humor, nicht kitschig. ' +
    'Wähle genau 3 Quests aus diesen Typen: ' +
    'sessions (Trainings im Monat, 6–20), muscle (Einheiten mit Muskelgruppe, 3–10, muscle eine aus: Beine, Brust, Rücken, Schultern, Arme, Bauch), ' +
    'protein_days (8–25), logged_days (Tage mit Essens-Einträgen, 10–28), water_days (8–25), volume (kg gesamt, 10000–200000), prs (neue Bestleistungen, 2–10). ' +
    'Realistisch für Hobbysportler mit 3 Trainings pro Woche; mische Training und Ernährung. ' +
    'Antworte nur als JSON: {"name":"max 3 Wörter","emoji":"ein Emoji","tagline":"ein kurzer Satz","badge":{"emoji":"ein Emoji","label":"max 2 Wörter"},"quests":[{"type":"…","target":0,"muscle":"…"}]}'
  )
}
