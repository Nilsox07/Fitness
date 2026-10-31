// Buddy begleitet durch die App: pro Seite ein kurzer, passender Tipp aus den echten
// Daten (sofort, ohne KI). „Frag Buddy“ schickt eine passende Frage an die KI.
// Reine Logik – getestet in buddyTips.test.ts.

import type { BuddyMood } from './buddyMood'

export type TipPage = 'today' | 'training' | 'nutrition' | 'progress' | 'cardio' | 'sleep' | 'vitals' | 'social'

export interface TipContext {
  hour: number
  kcalEaten: number
  kcalTarget: number
  proteinEaten: number
  proteinTarget: number
  waterMl: number
  waterTarget: number
  trainedToday: boolean
  restDay: boolean
  nextWorkout: string | null
  weekDone: number
  weekGoal: number
  streakWeeks: number
  readiness: number | null
  sleepMin: number | null
  restingHr: number | null
  restingHrNormal: number | null
  friends: number
  showNutrition: boolean
  hasWatch: boolean
  /** Anteil Zeit in Zone 4/5 der letzten Ausdauer-Einheiten (0–1) */
  hardShare: number | null
}

export interface Tip {
  /** stabiler Schlüssel (zum Wegtippen für heute) */
  key: string
  text: string
  mood: BuddyMood
  action?: { label: string; to: string }
  /** Frage an die KI für „Frag Buddy“ */
  ask?: string
}

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')

export function pageTip(page: TipPage, c: TipContext): Tip | null {
  const proteinLeft = Math.max(0, c.proteinTarget - c.proteinEaten)
  const kcalLeft = c.kcalTarget - c.kcalEaten
  const weekLeft = Math.max(0, c.weekGoal - c.weekDone)

  switch (page) {
    case 'today': {
      if (c.readiness != null && c.readiness < 50)
        return {
          key: 'today-low',
          mood: 'tired',
          text: `Tagesform ${c.readiness} – dein Körper braucht heute eher Erholung. Locker bewegen statt Rekorde.`,
          action: { label: 'Warum?', to: '/sleep' },
          ask: `Meine Tagesform ist heute ${c.readiness}/100. Was soll ich heute trainieren und worauf achten?`,
        }
      if (c.readiness != null && c.readiness >= 80 && !c.trainedToday && !c.restDay)
        return {
          key: 'today-high',
          mood: 'cheer',
          text: `Tagesform ${c.readiness} – heute ist ein Tag für Bestleistungen! ${c.nextWorkout ? `${c.nextWorkout} wartet.` : ''}`.trim(),
          action: { label: 'Training starten', to: '/' },
        }
      if (!c.trainedToday && !c.restDay && c.hour >= 16 && weekLeft > 0)
        return {
          key: 'today-train',
          mood: 'focus',
          text: c.nextWorkout
            ? `Heute steht noch ${c.nextWorkout} an – ${weekLeft} Training${weekLeft === 1 ? '' : 's'} bis zum Wochenziel.`
            : `Noch ${weekLeft} Training${weekLeft === 1 ? '' : 's'} bis zum Wochenziel. Schaffen wir heute eins?`,
          action: { label: 'Los geht’s', to: '/' },
        }
      if (c.showNutrition && c.hour >= 18 && proteinLeft >= 40) return nutritionProtein(proteinLeft, kcalLeft)
      return {
        key: 'today-hello',
        mood: 'happy',
        text:
          c.hour < 11
            ? 'Guten Morgen! Hier siehst du alles für heute – tipp „Heute anpassen“, um Widgets zu ändern.'
            : c.streakWeeks >= 2
              ? `${c.streakWeeks} Wochen Serie – stark! Bleib dran.`
              : 'Alles im Blick? Tipp auf ein Widget, um mehr zu sehen.',
      }
    }
    case 'training': {
      if (c.trainedToday)
        return {
          key: 'train-done',
          mood: 'proud',
          text: 'Training heute erledigt 💪 Jetzt Eiweiß und Schlaf – da wachsen die Muskeln.',
        }
      if (c.readiness != null && c.readiness < 50)
        return {
          key: 'train-low',
          mood: 'tired',
          text: 'Deine Tagesform ist niedrig. Mach heute weniger Sätze oder leichter – Technik vor Gewicht.',
          ask: 'Meine Tagesform ist niedrig. Wie passe ich mein heutiges Training an?',
        }
      if (c.restDay)
        return {
          key: 'train-rest',
          mood: 'sleepy',
          text: 'Ruhetag laut Rhythmus. Lust auf Bewegung? Ein lockeres Home-Workout geht immer.',
          action: { label: 'Home-Workout', to: '/quick' },
        }
      if (weekLeft > 0 && c.weekDone === 0 && c.hour >= 12)
        return {
          key: 'train-week',
          mood: 'focus',
          text: `Diese Woche noch kein Training – ${c.weekGoal} sind dein Ziel. Heute ist ein guter Start!`,
        }
      return {
        key: 'train-tip',
        mood: 'happy',
        text: 'Tipp: Schaffst du in allen Sätzen das obere Wiederholungsziel, steigere beim nächsten Mal das Gewicht.',
        ask: 'Wie steigere ich am besten meine Gewichte, ohne mich zu verletzen?',
      }
    }
    case 'nutrition': {
      if (!c.showNutrition) return null
      if (c.kcalEaten === 0 && c.hour >= 11)
        return {
          key: 'food-empty',
          mood: 'hungry',
          text: 'Noch nichts eingetragen heute. Ein Foto vom Teller reicht – den Rest mache ich.',
          action: { label: 'Foto', to: '/nutrition?add=photo' },
        }
      if (c.hour >= 17 && proteinLeft >= 30) return nutritionProtein(proteinLeft, kcalLeft)
      if (c.waterTarget > 0 && c.waterMl < c.waterTarget * 0.4 && c.hour >= 14)
        return {
          key: 'food-water',
          mood: 'tired',
          text: `Erst ${(c.waterMl / 1000).toLocaleString('de-DE')} l getrunken. Ein großes Glas jetzt?`,
        }
      if (kcalLeft < -200)
        return {
          key: 'food-over',
          mood: 'happy',
          text: `${fmt(-kcalLeft)} kcal über dem Ziel – kein Drama. Morgen einfach wieder normal weiter.`,
        }
      return {
        key: 'food-out',
        mood: 'happy',
        text: 'Unterwegs essen? Unter „Restaurant“ sage ich dir, was bei McDonald’s & Co. am besten passt.',
        action: { label: 'Restaurant', to: '/nutrition?add=restaurant' },
      }
    }
    case 'progress':
      if (weekLeft === 0 && c.weekGoal > 0)
        return {
          key: 'prog-goal',
          mood: 'proud',
          text: `Wochenziel geschafft (${c.weekDone}/${c.weekGoal})! Alles darüber ist Bonus.`,
        }
      return {
        key: 'prog-tip',
        mood: 'focus',
        text: 'Fortschritt sieht man über Wochen, nicht Tage. Vergleich am besten Monat mit Monat.',
        ask: 'Wie bewerte ich meinen Trainingsfortschritt der letzten Wochen?',
      }
    case 'cardio':
      if (c.hardShare != null && c.hardShare > 0.4)
        return {
          key: 'cardio-hard',
          mood: 'focus',
          text: 'Du läufst oft im harten Bereich. Profis machen ~80 % locker (Zone 2) – das bringt mehr Ausdauer.',
          ask: 'Wie baue ich mit Zone-2-Training meine Ausdauer auf?',
        }
      return {
        key: 'cardio-tip',
        mood: 'happy',
        text: 'Tipp auf eine Aktivität für Puls-Zonen, Kilometer-Zeiten und Höhenprofil.',
      }
    case 'sleep':
      if (c.sleepMin != null && c.sleepMin < 390)
        return {
          key: 'sleep-short',
          mood: 'sleepy',
          text: 'Kurze Nacht. Heute 30 Minuten früher ins Bett – das bringt mehr als jedes Supplement.',
          ask: 'Wie schlafe ich schneller ein und tiefer durch?',
        }
      return {
        key: 'sleep-tip',
        mood: 'happy',
        text: 'Gleiche Schlafenszeit jeden Tag verbessert den Tiefschlaf – auch am Wochenende.',
      }
    case 'vitals':
      if (c.restingHr != null && c.restingHrNormal != null && c.restingHr - c.restingHrNormal >= 4)
        return {
          key: 'vitals-rhr',
          mood: 'tired',
          text: `Ruhepuls ${c.restingHr} statt ~${Math.round(c.restingHrNormal)}. Oft ein Zeichen für Stress oder einen Infekt – heute ruhig angehen.`,
        }
      return {
        key: 'vitals-tip',
        mood: 'happy',
        text: 'Wichtig ist dein eigener Verlauf – vergleich dich mit dir, nicht mit anderen.',
      }
    case 'social':
      if (c.friends === 0)
        return {
          key: 'social-invite',
          mood: 'cheer',
          text: 'Zusammen bleibt man dran! Lade Freunde ein und tretet in Duellen gegeneinander an.',
        }
      return {
        key: 'social-tip',
        mood: 'happy',
        text: 'Ein Kudos kostet nichts und motiviert enorm – zeig deinen Freunden, dass du sie siehst.',
      }
  }
}

function nutritionProtein(proteinLeft: number, kcalLeft: number): Tip {
  return {
    key: 'food-protein',
    mood: 'hungry',
    text: `Noch ${fmt(proteinLeft)} g Eiweiß offen${kcalLeft > 0 ? ` bei ${fmt(kcalLeft)} kcal` : ''}. Skyr, Quark oder ein Shake?`,
    ask: `Ich brauche heute noch ${fmt(proteinLeft)} g Eiweiß und habe ${fmt(Math.max(0, kcalLeft))} kcal übrig. Was soll ich essen?`,
  }
}
