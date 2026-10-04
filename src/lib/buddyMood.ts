// Buddy (Begleiter-Figur): Stimmung + kurzer Spruch aus echten Trainings-/Ernährungsdaten.
// Rein funktional — die Daten sammelt der Hook `useBuddy`.

export type BuddyMood = 'happy' | 'proud' | 'cheer' | 'sleepy' | 'sad' | 'hungry' | 'tired' | 'focus'

export const BUDDY_MOODS: BuddyMood[] = ['happy', 'proud', 'cheer', 'sleepy', 'sad', 'hungry', 'tired', 'focus']

export interface BuddyInput {
  /** Tage seit dem letzten Training; null = noch nie trainiert */
  daysSinceLastWorkout?: number | null
  trainedToday?: boolean
  weeklySessions?: number
  weeklyGoal?: number
  newPrToday?: boolean
  proteinToday?: number
  proteinTarget?: number
  /** Stunde 0–23 */
  hour?: number
  showNutrition?: boolean
  /** Alle (eigenen) Muskelgruppen noch erschöpft (< 48 h) */
  recoveryAllTired?: boolean
  streakWeeks?: number
  activeWorkout?: boolean
  /** YYYY-MM-DD — bestimmt (deterministisch), welcher Spruch gewählt wird */
  date?: string
}

export interface BuddyState {
  mood: BuddyMood
  line: string
}

/** Kleiner, stabiler String-Hash (FNV-1a). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Wählt einen Spruch — gleicher Tag + gleicher Anlass → gleicher Spruch. */
export function pickLine(lines: string[], seed: string): string {
  return lines[hash(seed) % lines.length]
}

const trainings = (n: number) => (n === 1 ? 'Training' : 'Trainings')

export function buddyMood(input: BuddyInput = {}): BuddyState {
  const {
    daysSinceLastWorkout = null,
    trainedToday = false,
    weeklySessions = 0,
    weeklyGoal = 3,
    newPrToday = false,
    proteinToday = 0,
    proteinTarget = 0,
    hour = 12,
    showNutrition = false,
    recoveryAllTired = false,
    streakWeeks = 0,
    activeWorkout = false,
    date = '',
  } = input
  const say = (key: string, mood: BuddyMood, lines: string[]): BuddyState => ({
    mood,
    line: pickLine(lines, `${date}|${key}`),
  })

  if (activeWorkout) {
    return say('focus', 'focus', [
      "Los geht's – du schaffst das!",
      'Volle Konzentration – ich zähl mit!',
      'Satz für Satz. Du rockst das!',
    ])
  }

  if (newPrToday) {
    return say('pr', 'proud', [
      'Neuer Rekord heute – ich platze vor Stolz!',
      'Rekord geknackt! Das war richtig stark.',
      'PR-Tag! So sehen Champions aus.',
    ])
  }

  if (weeklyGoal > 0 && weeklySessions >= weeklyGoal) {
    const lines = [
      `Wochenziel geschafft – ${weeklySessions} ${trainings(weeklySessions)}! Ich bin so stolz.`,
      'Wochenziel erreicht! Alles Weitere ist Bonus.',
    ]
    if (streakWeeks >= 2) lines.push(`${streakWeeks} Wochen am Stück – wir sind ein starkes Team!`)
    return say('goal', 'proud', lines)
  }

  if (trainedToday) {
    return say('trained', 'happy', [
      'Training erledigt – ich fühl mich gleich stärker!',
      'Stark heute! Jetzt gut essen und erholen.',
      'Abgehakt! Über Nacht wachsen die Muskeln.',
    ])
  }

  if (daysSinceLastWorkout != null && daysSinceLastWorkout >= 4) {
    const d = daysSinceLastWorkout
    if (d >= 7) {
      return say('sleepy', 'sleepy', [
        `${d} Tage Pause … weck mich mit einem Training!`,
        'Ich bin ganz eingerostet … Zeit fürs Gym?',
        'Zzz … ein Training würde mich aufwecken.',
      ])
    }
    return say('sad', 'sad', [
      'Ich vermisse das Gym …',
      `Schon ${d} Tage ohne Training – gehen wir heute?`,
      'Mir ist langweilig … kurzes Training?',
    ])
  }

  if (recoveryAllTired) {
    return say('tired', 'tired', [
      'Puh, meine Muskeln brauchen noch Erholung.',
      'Heute lieber locker – Regeneration ist auch Training.',
      'Muskelkater-Alarm! Gönn uns eine Pause.',
    ])
  }

  if (showNutrition && hour >= 17 && proteinTarget > 0 && proteinToday < proteinTarget * 0.6) {
    const rest = Math.round(proteinTarget - proteinToday)
    return say('hungry', 'hungry', [
      `Noch ${rest} g Eiweiß – ich hab Hunger!`,
      `Mir knurrt der Magen – noch ${rest} g Eiweiß offen.`,
      `${rest} g Eiweiß fehlen noch. Snack-Zeit?`,
    ])
  }

  // Standard: fröhlich, mit Bezug zur Woche.
  if (daysSinceLastWorkout == null) {
    return say('hello', 'happy', [
      'Hi, ich bin Buddy! Lass uns zusammen stark werden.',
      'Hi, ich bin Buddy! Mit jedem Training wachse ich mit.',
    ])
  }
  const lines: string[] = []
  const left = weeklyGoal - weeklySessions
  if (left > 0) lines.push(`Noch ${left} ${trainings(left)} bis zum Wochenziel – packen wir's!`)
  if (streakWeeks >= 2) lines.push(`${streakWeeks} Wochen Serie – lass sie nicht reißen!`)
  if (hour < 11) lines.push('Guten Morgen! Ich bin bereit, wenn du es bist.')
  else lines.push('Bereit für heute? Ich bin dabei!')
  return say('default', 'happy', lines)
}

/** Tage zwischen zwei YYYY-MM-DD (b − a). */
function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** Stimmung eines Freundes-Buddys: heute trainiert → fröhlich, ≥ 4 Tage Pause → müde. */
export function friendBuddyMood(lastWorkout: string | null | undefined, today: string): BuddyMood {
  if (!lastWorkout) return 'sleepy'
  if (lastWorkout >= today) return 'happy'
  return daysBetween(lastWorkout, today) >= 4 ? 'sleepy' : 'happy'
}
