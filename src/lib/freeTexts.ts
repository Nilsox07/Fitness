// Feste, regelbasierte Texte für die kostenlose Version (und als Ersatz, wenn die KI nicht da ist).
// Sie nutzen echte Zahlen und Namen, sind aber bewusst sachlicher als die KI – Buddy Plus soll ein
// spürbares Upgrade sein. Varianten wechseln täglich (deterministisch über das Datum).

import type { FactorStatus, ReadinessFactor } from './health'
import type { ReviewData, ReviewStats } from './weeklyReview'
import type { NutritionGoal } from '../types'

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

/** Kleiner, stabiler Hash (FNV-1a) – gleiche Eingabe, gleiche Variante. */
export function seedOf(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Variante passend zum Seed wählen. */
export function pick<T>(list: readonly T[], seed: string): T {
  return list[seedOf(seed) % list.length]
}

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`

// ---------------------------------------------------------------------------
// Tagesbriefing
// ---------------------------------------------------------------------------

export interface BriefingNutrition {
  kcalEaten: number
  kcalTarget: number
  proteinEaten: number
  proteinTarget: number
  waterMl: number
  waterTarget: number
}

export interface BriefingCtx {
  /** YYYY-MM-DD – bestimmt die Variante des Tages */
  day: string
  /** Stunde 0–23 */
  hour: number
  readiness: { score: number; factors: Pick<ReadinessFactor, 'key' | 'value' | 'status'>[] } | null
  trainedToday: boolean
  restDay: boolean
  /** Name des geplanten Trainings */
  nextWorkout: string | null
  weekDone: number
  weekGoal: number
  /** geplante Ausdauer-Einheit heute, z. B. „Laufen · 30 min“ */
  cardioToday?: string | null
  /** null = Ernährung ausgeblendet */
  nutrition?: BriefingNutrition | null
}

type Level = 'high' | 'mid' | 'low'
const levelOf = (score: number): Level => (score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low')

/** Kurzer Grund in Alltagssprache für einen Tagesform-Faktor. */
export function factorPhrase(f: { key: ReadinessFactor['key']; value: string; status: FactorStatus }): string {
  const good = f.status === 'gut'
  switch (f.key) {
    case 'sleep':
      return good ? `guter Schlaf (${f.value})` : `kurzer Schlaf (${f.value})`
    case 'deep':
      return good ? `viel Tiefschlaf (${f.value})` : `wenig Tiefschlaf (${f.value})`
    case 'hrv':
      return good ? `starke HRV (${f.value})` : `niedrige HRV (${f.value})`
    case 'rhr':
      return good ? `ruhiger Puls (${f.value})` : `erhöhter Ruhepuls (${f.value})`
    case 'load':
      return good ? 'frische Beine' : 'harte Ausdauer-Tage'
    case 'strength':
      return good ? 'erholte Muskeln' : 'viele harte Sätze zuletzt'
    case 'energy':
      return good ? 'gut gegessen gestern' : 'großes Defizit gestern'
    case 'protein':
      return good ? 'genug Eiweiß gestern' : 'wenig Eiweiß gestern'
    case 'water':
      return good ? 'gut getrunken gestern' : 'wenig getrunken gestern'
    case 'cycle':
      return good ? `gute Zyklusphase (${f.value})` : `dein Zyklus (${f.value})`
  }
}

/** Erster Satz: Tagesform + Training. */
function briefingTraining(c: BriefingCtx): string {
  const seed = c.day
  const plan = c.nextWorkout
  const cardio = c.cardioToday ?? null
  const left = Math.max(0, c.weekGoal - c.weekDone)
  const r = c.readiness

  if (!r) {
    if (c.trainedToday)
      return pick(
        [
          `Training erledigt – ${c.weekDone}/${c.weekGoal} diese Woche.`,
          `Heute schon trainiert, stark. Stand: ${c.weekDone}/${c.weekGoal} Trainings.`,
          `Haken dran: Training für heute steht (${c.weekDone}/${c.weekGoal}).`,
        ],
        seed + 'nr-done',
      )
    if (c.restDay)
      return cardio
        ? `Ruhetag fürs Gym – geplant ist ${cardio}, locker reicht.`
        : pick(
            [
              'Heute ist Ruhetag – Erholung gehört zum Plan.',
              'Ruhetag: Muskeln wachsen in der Pause.',
              'Heute frei vom Training – Spaziergang statt Hanteln.',
            ],
            seed + 'nr-rest',
          )
    if (plan)
      return pick(
        [
          `Heute steht ${plan} an${cardio ? ` und ${cardio}` : ''}.`,
          `Auf dem Plan: ${plan}${cardio ? `, dazu ${cardio}` : ''}.`,
          `${plan} wartet auf dich${left > 0 ? ` – noch ${plural(left, 'Training', 'Trainings')} bis zum Wochenziel` : ''}.`,
        ],
        seed + 'nr-plan',
      )
    if (cardio) return `Heute geplant: ${cardio}.`
    return left > 0
      ? `Noch ${plural(left, 'Training', 'Trainings')} bis zum Wochenziel.`
      : `Wochenziel geschafft (${c.weekDone}/${c.weekGoal}) – alles Weitere ist Bonus.`
  }

  const lv = levelOf(r.score)
  const weak = r.factors.find((f) => f.status === 'schwach')
  const best = r.factors.find((f) => f.status === 'gut')
  const s = r.score

  if (c.trainedToday) {
    if (lv === 'low')
      return pick(
        [
          `Training erledigt bei Tagesform ${s} – jetzt zählt Erholung.`,
          `Tagesform ${s} und trotzdem trainiert. Heute Abend früh runterfahren.`,
        ],
        seed + 'done-low',
      )
    return pick(
      [
        `Tagesform ${s} und Training erledigt – starker Tag.`,
        `Training steht, Tagesform ${s}. ${c.weekDone}/${c.weekGoal} diese Woche.`,
        `Haken dran: trainiert bei Tagesform ${s}.`,
      ],
      seed + 'done',
    )
  }

  if (c.restDay) {
    if (lv === 'high')
      return cardio
        ? `Tagesform ${s} am Ruhetag – ${cardio} darf heute zügig sein.`
        : pick(
            [
              `Tagesform ${s}, aber heute ist Ruhetag – ein Spaziergang reicht.`,
              `Fit wie lange nicht (${s}), trotzdem Ruhetag. Morgen zahlt sich das aus.`,
            ],
            seed + 'rest-high',
          )
    if (lv === 'low')
      return `Tagesform ${s}${weak ? ` wegen ${factorPhrase(weak)}` : ''} – gut, dass heute Ruhetag ist.`
    return cardio
      ? `Tagesform ${s} am Ruhetag: ${cardio} locker halten.`
      : `Tagesform ${s} am Ruhetag – Mobility oder ein Spaziergang passen gut.`
  }

  const what = plan ?? cardio ?? 'dein Training'
  if (lv === 'high')
    return pick(
      [
        `Tagesform ${s}${best ? ` dank ${factorPhrase(best)}` : ''} – perfekt für ${what}, geh ruhig schwer.`,
        `${s} Punkte: heute ist ein guter Tag für ${what} und neue Rekorde.`,
        `Tagesform ${s} – volle Kraft für ${what}.`,
      ],
      seed + 'plan-high',
    )
  if (lv === 'mid')
    return weak
      ? `Tagesform ${s}, ${factorPhrase(weak)} bremst etwas – ${what} normal, ohne Rekordjagd.`
      : pick(
          [
            `Tagesform ${s}: ${what} ganz normal durchziehen.`,
            `Solide ${s} Punkte – ${what} wie geplant, Technik vor Gewicht.`,
          ],
          seed + 'plan-mid',
        )
  return `Tagesform nur ${s}${weak ? ` (${factorPhrase(weak)})` : ''} – ${what} heute leichter oder Mobility statt Vollgas.`
}

/** Anteil des Tagesziels, den man zur Uhrzeit ungefähr haben sollte. */
export function expectedShare(hour: number): number {
  if (hour < 10) return 0.15
  if (hour < 14) return 0.4
  if (hour < 18) return 0.6
  if (hour < 21) return 0.85
  return 1
}

/** Eiweiß-Idee passend zur offenen Menge. */
export function proteinIdea(left: number): string {
  if (left > 60) return 'plan eine eiweißreiche Hauptmahlzeit ein (Hähnchen, Tofu, Fisch)'
  if (left > 25) return 'z. B. Joghurt, Quark, Eier oder Hülsenfrüchte'
  return 'ein Glas Milch oder ein paar Nüsse reichen'
}

/** Zweiter Satz: das Wichtigste bei Essen und Trinken (oder Tageszeit, ohne Ernährung). */
function briefingNutrition(c: BriefingCtx): string {
  const seed = c.day
  const n = c.nutrition
  if (!n) {
    if (c.hour < 11)
      return pick(
        ['Starte mit einem großen Glas Wasser.', 'Erst mal trinken, dann geht der Tag leichter.'],
        seed + 'nn-m',
      )
    if (c.hour >= 20) return 'Früh ins Bett hilft der Tagesform morgen.'
    return pick(
      ['Zwischendurch aufstehen und trinken nicht vergessen.', 'Ein kurzer Spaziergang hält dich frisch.'],
      seed + 'nn-d',
    )
  }

  const exp = expectedShare(c.hour)
  const proteinLeft = Math.max(0, n.proteinTarget - n.proteinEaten)
  const waterLeft = Math.max(0, n.waterTarget - n.waterMl)
  const over = n.kcalTarget > 0 ? n.kcalEaten - n.kcalTarget : 0

  if (n.kcalEaten === 0 && c.hour >= 11)
    return 'Noch nichts eingetragen – logg deine erste Mahlzeit, dann stimmt die Rechnung.'
  if (n.kcalTarget > 0 && over > 150)
    return pick(
      [
        `Du liegst ${fmt(over)} kcal über deinem Ziel – heute lieber leicht bleiben.`,
        `${fmt(over)} kcal über Ziel: Gemüse und Eiweiß statt Snacks.`,
      ],
      seed + 'over',
    )
  if (n.proteinTarget > 0 && n.proteinEaten < n.proteinTarget * exp * 0.7 && proteinLeft > 15)
    return `Noch ${fmt(proteinLeft)} g Eiweiß offen – ${proteinIdea(proteinLeft)}.`
  if (n.waterTarget > 0 && n.waterMl < n.waterTarget * exp * 0.6)
    return pick(
      [
        `Erst ${fmt(n.waterMl)} ml getrunken – stell dir eine Flasche hin.`,
        `Noch ${fmt(waterLeft)} ml bis zum Trinkziel, am besten jetzt ein Glas.`,
      ],
      seed + 'water',
    )
  if (c.hour >= 20 && proteinLeft <= 10 && waterLeft <= 250 && n.kcalTarget > 0)
    return `Ziele erreicht: ${fmt(n.kcalEaten)} kcal und ${fmt(n.proteinEaten)} g Eiweiß. Gönn dir Schlaf.`
  if (n.kcalTarget > 0)
    return pick(
      [
        `Ernährung läuft: ${fmt(n.kcalEaten)}/${fmt(n.kcalTarget)} kcal, ${fmt(n.proteinEaten)}/${fmt(n.proteinTarget)} g Eiweiß.`,
        `Noch ${fmt(Math.max(0, n.kcalTarget - n.kcalEaten))} kcal frei, davon gern ${fmt(proteinLeft)} g Eiweiß.`,
        `Essen im Plan – ${fmt(proteinLeft)} g Eiweiß und ${fmt(waterLeft)} ml Wasser fehlen noch.`,
      ],
      seed + 'ok',
    )
  return `Noch ${fmt(proteinLeft)} g Eiweiß und ${fmt(waterLeft)} ml Wasser bis zum Ziel.`
}

/** Tagesbriefing in 2 Sätzen – feste Regeln statt KI. */
export function dailyBriefingText(c: BriefingCtx): string {
  return `${briefingTraining(c)} ${briefingNutrition(c)}`
}

// ---------------------------------------------------------------------------
// Wochenfazit
// ---------------------------------------------------------------------------

export interface WeeklyFreeInput extends ReviewStats {
  /** z. B. „KW 43“ – bestimmt die Variante */
  weekId: string
  goal?: NutritionGoal | null
  topMuscles?: string[]
  /** Tage mit erreichtem Eiweißziel */
  proteinDays?: number | null
  /** Tage im Kalorienziel (±10 %) */
  kcalDays?: number | null
  /** Wochen in Folge mit Training */
  streakWeeks?: number | null
}

/** Wochenfazit aus den Kennzahlen – gleiche Struktur wie das KI-Fazit. */
export function weeklyReviewText(s: WeeklyFreeInput): ReviewData {
  const seed = s.weekId
  const goal = Math.max(1, s.sessionGoal)
  const ratio = s.sessions / goal
  const wins: string[] = []
  const focus: string[] = []

  // Überschrift + Gesamteindruck
  let headline: string
  let summary: string
  if (s.sessions === 0) {
    headline = 'Neue Woche, neuer Start'
    summary = 'Letzte Woche kein Training – passiert. Diese Woche zählt jede Einheit.'
  } else if (ratio > 1) {
    headline = pick(['Mehr als geplant!', 'Über dem Soll', 'Bonus-Woche'], seed + 'h')
    summary = `${s.sessions} Trainings bei ${goal} geplanten – starke Woche.`
  } else if (ratio === 1) {
    headline = pick(['Wochenziel geschafft', 'Alles erledigt', 'Volle Woche'], seed + 'h')
    summary = `${s.sessions} von ${goal} Trainings – genau nach Plan.`
  } else if (ratio >= 0.5) {
    headline = pick(['Solide Woche', 'Gut dabei', 'Auf Kurs'], seed + 'h')
    summary = `${s.sessions} von ${goal} Trainings – fast da.`
  } else {
    headline = 'Ausbaufähige Woche'
    summary = `${s.sessions} von ${goal} Trainings – da geht noch mehr.`
  }

  // Training
  const parts: string[] = []
  if (s.sessions > 0) {
    parts.push(
      `${plural(s.sessions, 'Training', 'Trainings')} mit ${fmt(s.volumeKg)} kg Volumen${
        s.topMuscles?.length ? `, vor allem ${s.topMuscles.slice(0, 2).join(' und ')}` : ''
      }.`,
    )
    if (s.prs > 1) parts.push(`${s.prs} neue Rekorde – du wirst stärker.`)
    else if (s.prs === 1) parts.push('Ein neuer Rekord ist dabei.')
    else parts.push('Kein neuer Rekord diesmal – steigere eine Übung um einen Schritt.')
  } else parts.push('Keine Trainings eingetragen.')
  const training = parts.join(' ')

  if (ratio >= 1) wins.push(`Wochenziel: ${s.sessions}/${goal}`)
  else if (s.sessions > 0) focus.push(`${goal} Trainings fest im Kalender eintragen`)
  else focus.push('Ein kurzes Training in den ersten zwei Tagen')
  if (s.prs > 0) wins.push(s.prs === 1 ? '1 neuer Rekord' : `${s.prs} neue Rekorde`)
  else if (s.sessions > 0) focus.push('Bei einer Übung mehr Gewicht oder Wdh.')
  if (s.streakWeeks && s.streakWeeks >= 2) wins.push(`${s.streakWeeks} Wochen am Stück dabei`)

  // Ernährung
  let nutrition: string | null = null
  if (s.daysLogged != null) {
    if (s.daysLogged === 0) {
      nutrition = 'Keine Mahlzeiten eingetragen – ohne Daten keine Auswertung.'
      focus.push('An 4 Tagen das Essen eintragen')
    } else {
      const np: string[] = []
      np.push(`${plural(s.daysLogged, 'Tag', 'Tage')} eingetragen`)
      if (s.avgKcal != null && s.kcalTarget) {
        const diff = s.avgKcal - s.kcalTarget
        const pct = Math.abs(diff) / s.kcalTarget
        if (pct <= 0.1) {
          np[np.length - 1] += `, im Schnitt ${fmt(s.avgKcal)} kcal – nah am Ziel.`
          wins.push('Kalorien im Ziel')
        } else if (diff > 0) {
          np[np.length - 1] += `, im Schnitt ${fmt(diff)} kcal über dem Ziel.`
          focus.push(s.goal === 'gain' ? 'Überschuss etwas kleiner halten' : 'Abends Snacks reduzieren')
        } else {
          np[np.length - 1] += `, im Schnitt ${fmt(-diff)} kcal unter dem Ziel.`
          if (s.goal !== 'lose') focus.push('Etwas mehr essen, vor allem an Trainingstagen')
          else wins.push('Defizit gehalten')
        }
      } else np[np.length - 1] += '.'
      if (s.avgProtein != null && s.proteinTarget) {
        const pr = s.avgProtein / s.proteinTarget
        if (pr >= 0.9) {
          np.push(`Eiweiß stark: ${fmt(s.avgProtein)} g am Tag.`)
          wins.push('Eiweißziel getroffen')
        } else if (pr >= 0.7) np.push(`Eiweiß knapp drunter (${fmt(s.avgProtein)} von ${fmt(s.proteinTarget)} g).`)
        else {
          np.push(`Eiweiß zu niedrig: ${fmt(s.avgProtein)} von ${fmt(s.proteinTarget)} g.`)
          focus.push('Zu jeder Mahlzeit eine Eiweißquelle')
        }
      }
      if (s.proteinDays != null && s.daysLogged > 0)
        np.push(`Eiweißziel an ${s.proteinDays} von ${s.daysLogged} Tagen.`)
      if (s.kcalDays != null && s.kcalDays >= 4) wins.push(`${s.kcalDays} Tage im Kalorienziel`)
      if (s.daysLogged < 4) focus.push('Öfter eintragen – mindestens 4 Tage')
      nutrition = np.join(' ')
    }
    if (s.weightDelta != null && s.weightDelta !== 0) {
      const w = `${s.weightDelta > 0 ? '+' : ''}${s.weightDelta.toLocaleString('de-DE')} kg`
      const fits =
        (s.goal === 'lose' && s.weightDelta < 0) ||
        (s.goal === 'gain' && s.weightDelta > 0) ||
        (s.goal === 'maintain' && Math.abs(s.weightDelta) <= 0.5)
      nutrition += fits ? ` Gewicht ${w} – passt zum Ziel.` : ` Gewicht ${w} diese Woche.`
    }
  }

  if (wins.length === 0) wins.push(s.sessions > 0 ? 'Drangeblieben' : 'App geöffnet – der erste Schritt')
  if (focus.length === 0) focus.push(pick(['Genau so weitermachen', 'Tempo halten', 'Schlaf im Blick behalten'], seed))

  return {
    headline,
    summary,
    training,
    nutrition,
    wins: wins.slice(0, 3),
    focus: focus.slice(0, 3),
  }
}

// ---------------------------------------------------------------------------
// Mahlzeit-Einschätzung (Datenbank/manuell, keine KI)
// ---------------------------------------------------------------------------

export interface MealTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

/** Ein Satz zur Mahlzeit aus den Nährwerten und dem Rest-Budget. */
export function mealVerdictText(
  t: MealTotals,
  ctx: { goal?: NutritionGoal | null; kcalLeft?: number | null; proteinLeft?: number | null } = {},
): string {
  const kcal = Math.max(0, t.kcal)
  if (kcal === 0) return ''
  const pShare = (t.protein * 4) / kcal
  const left = ctx.kcalLeft
  if (left != null && kcal > left + 100)
    return `Mit ${fmt(kcal)} kcal liegst du ${fmt(kcal - Math.max(0, left))} kcal über deinem Rest-Budget.`
  if (pShare >= 0.3) return `Viel Eiweiß: ${fmt(t.protein)} g bei ${fmt(kcal)} kcal – top fürs Ziel.`
  if (pShare < 0.12 && kcal >= 400)
    return ctx.goal === 'lose'
      ? `Viel Energie, wenig Eiweiß (${fmt(t.protein)} g) – dazu eine Eiweißquelle hilft.`
      : `Wenig Eiweiß (${fmt(t.protein)} g) – eine Eiweißquelle dazu gleicht das aus.`
  if ((t.fiber ?? 0) >= 8) return `Ballaststoffreich (${fmt(t.fiber ?? 0)} g) – hält lange satt.`
  if (left != null && left >= 0) return `Passt ins Budget – danach noch ${fmt(left - kcal)} kcal frei.`
  return `${fmt(kcal)} kcal mit ${fmt(t.protein)} g Eiweiß.`
}

// ---------------------------------------------------------------------------
// Training: Spruch nach dem Workout
// ---------------------------------------------------------------------------

export interface HypeCtx {
  sets: number
  exercises: number
  volumeKg: number
  /** Übung mit neuem Rekord */
  pr?: string | null
  /** Variante (z. B. Datum) */
  seed?: string
}

export function hypeLineText(c: HypeCtx): string {
  const seed = (c.seed ?? '') + c.sets + c.volumeKg
  if (c.pr)
    return pick(
      [`Neuer Rekord bei ${c.pr}! 🏆`, `${c.pr}: Rekord geknackt. 💪`, `PR bei ${c.pr} – so geht das! 🔥`],
      seed,
    )
  if (c.volumeKg >= 10000)
    return pick(
      [`${fmt(c.volumeKg)} kg bewegt – Maschine! 🔥`, `Über ${fmt(c.volumeKg / 1000)} Tonnen heute. 💪`],
      seed,
    )
  if (c.sets >= 20)
    return pick([`${c.sets} Sätze durchgezogen. Respekt! 💪`, `${c.sets} Sätze – Fleiß zahlt sich aus.`], seed)
  if (c.sets === 0) return 'Erscheinen ist der halbe Sieg. 💪'
  return pick(
    [
      `${c.sets} Sätze, ${plural(c.exercises, 'Übung', 'Übungen')} – erledigt! 💪`,
      `${fmt(c.volumeKg)} kg Volumen, sauber gemacht.`,
      'Stark durchgezogen! 💪',
      'Wieder einen Schritt weiter. 🔥',
    ],
    seed,
  )
}

// ---------------------------------------------------------------------------
// Community: Cheat-Meal-Erkennung ohne KI
// ---------------------------------------------------------------------------

export function cheatJudgeText(e: { name: string; kcal: number; protein: number; carbs: number; fat: number }): {
  indulgent: boolean
  quip: string
} {
  const kcal = Math.max(1, e.kcal)
  const pShare = (e.protein * 4) / kcal
  const fatShare = (e.fat * 9) / kcal
  const carbShare = (e.carbs * 4) / kcal
  const indulgent = e.kcal >= 400 && pShare < 0.15 && (fatShare >= 0.4 || carbShare >= 0.6)
  if (!indulgent) return { indulgent: false, quip: '' }
  const quip = pick(
    [
      `${fmt(e.kcal)} kcal – das Gym ruft morgen lauter.`,
      'Cheat erkannt, Buddy schaut weg. 👀',
      `Morgen ${Math.max(1, Math.round(e.kcal / 100))} km extra?`,
      'Gönn dir – aber nur heute. 😏',
    ],
    e.name + e.kcal,
  )
  return { indulgent: true, quip }
}

// ---------------------------------------------------------------------------
// Buddy-Chat (kostenlos): kein Chat, sondern feste Antwort
// ---------------------------------------------------------------------------

/** Kurzer Hinweis im Buddy-Sheet statt Chat. */
export function buddyFreeNote(name?: string | null): string {
  return name
    ? `${name}, chatten kann ich mit Buddy Plus. Bis dahin helfen dir meine Tipps.`
    : 'Chatten kann ich mit Buddy Plus. Bis dahin helfen dir meine Tipps.'
}
