// Buddy begleitet durch die App: pro Seite ein kurzer, passender Tipp aus den echten
// Daten (sofort, ohne KI). „Frag Buddy“ schickt eine passende Frage an die KI.
// Reine Logik – getestet in buddyTips.test.ts.

import type { BuddyMood } from './buddyMood'

export type TipPage =
  | 'today'
  | 'training'
  | 'nutrition'
  | 'progress'
  | 'cardio'
  | 'sleep'
  | 'vitals'
  | 'social'
  | 'cycle'
  | 'insights'

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
  /** KI nutzbar (Buddy Plus); false = Tipps ohne KI-Funktionen. Fehlt = ja. */
  aiPlus?: boolean
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
          text: `Tagesform ${c.readiness} – heute lieber locker.`,
          action: { label: 'Warum?', to: '/sleep' },
          ask: `Meine Tagesform ist heute ${c.readiness}/100. Was soll ich heute trainieren und worauf achten?`,
        }
      if (c.readiness != null && c.readiness >= 80 && !c.trainedToday && !c.restDay)
        return {
          key: 'today-high',
          mood: 'cheer',
          text: `Tagesform ${c.readiness} – Zeit für Bestleistungen!`,
          action: { label: 'Training starten', to: '/' },
        }
      if (!c.trainedToday && !c.restDay && c.hour >= 16 && weekLeft > 0)
        return {
          key: 'today-train',
          mood: 'focus',
          text: c.nextWorkout
            ? `Heute noch ${c.nextWorkout}?`
            : `Noch ${weekLeft} Training${weekLeft === 1 ? '' : 's'} bis zum Wochenziel.`,
          action: { label: 'Los geht’s', to: '/' },
        }
      if (c.showNutrition && c.hour >= 18 && proteinLeft >= 40) return nutritionProtein(proteinLeft, kcalLeft)
      return {
        key: 'today-hello',
        mood: 'happy',
        text:
          c.hour < 11
            ? 'Guten Morgen! Auf geht’s.'
            : c.streakWeeks >= 2
              ? `${c.streakWeeks} Wochen Serie – stark!`
              : 'Tipp auf ein Widget für Details.',
      }
    }
    case 'training': {
      if (c.trainedToday)
        return {
          key: 'train-done',
          mood: 'proud',
          text: 'Training erledigt 💪 Jetzt Eiweiß & Schlaf.',
        }
      if (c.readiness != null && c.readiness < 50)
        return {
          key: 'train-low',
          mood: 'tired',
          text: 'Tagesform niedrig – heute etwas leichter.',
          ask: 'Meine Tagesform ist niedrig. Wie passe ich mein heutiges Training an?',
        }
      if (c.restDay)
        return {
          key: 'train-rest',
          mood: 'sleepy',
          text: 'Ruhetag. Lust auf ein kurzes Home-Workout?',
          action: { label: 'Home-Workout', to: '/quick' },
        }
      if (weekLeft > 0 && c.weekDone === 0 && c.hour >= 12)
        return {
          key: 'train-week',
          mood: 'focus',
          text: 'Heute ist ein guter Tag für dein erstes Training der Woche.',
        }
      return {
        key: 'train-tip',
        mood: 'happy',
        text: 'Alle Sätze geschafft? Nächstes Mal mehr Gewicht.',
        ask: 'Wie steigere ich am besten meine Gewichte, ohne mich zu verletzen?',
      }
    }
    case 'nutrition': {
      if (!c.showNutrition) return null
      if (c.kcalEaten === 0 && c.hour >= 11)
        return {
          key: 'food-empty',
          mood: 'hungry',
          ...(c.aiPlus === false
            ? {
                text: 'Noch nichts eingetragen – scannen oder suchen geht schnell.',
                action: { label: 'Suchen', to: '/nutrition?add=search' },
              }
            : {
                text: 'Noch nichts eingetragen – ein Foto reicht.',
                action: { label: 'Foto', to: '/nutrition?add=photo' },
              }),
        }
      if (c.hour >= 17 && proteinLeft >= 30) return nutritionProtein(proteinLeft, kcalLeft)
      if (c.waterTarget > 0 && c.waterMl < c.waterTarget * 0.4 && c.hour >= 14)
        return {
          key: 'food-water',
          mood: 'tired',
          text: `Erst ${(c.waterMl / 1000).toLocaleString('de-DE')} l – ein Glas Wasser?`,
        }
      if (kcalLeft < -200)
        return {
          key: 'food-over',
          mood: 'happy',
          text: `${fmt(-kcalLeft)} kcal drüber – kein Drama.`,
        }
      return {
        key: 'food-out',
        mood: 'happy',
        text: 'Unterwegs? Ich finde das Beste auf der Karte.',
        action: { label: 'Restaurant', to: '/nutrition?add=restaurant' },
      }
    }
    case 'progress':
      if (weekLeft === 0 && c.weekGoal > 0)
        return {
          key: 'prog-goal',
          mood: 'proud',
          text: `Wochenziel geschafft (${c.weekDone}/${c.weekGoal})!`,
        }
      return {
        key: 'prog-tip',
        mood: 'focus',
        text: 'Fortschritt zeigt sich über Wochen.',
        ask: 'Wie bewerte ich meinen Trainingsfortschritt der letzten Wochen?',
      }
    case 'cardio':
      if (c.hardShare != null && c.hardShare > 0.4)
        return {
          key: 'cardio-hard',
          mood: 'focus',
          text: 'Oft zu hart unterwegs – mehr locker (Zone 2).',
          ask: 'Wie baue ich mit Zone-2-Training meine Ausdauer auf?',
        }
      return {
        key: 'cardio-tip',
        mood: 'happy',
        text: 'Tipp auf eine Aktivität für Details.',
      }
    case 'sleep':
      if (c.sleepMin != null && c.sleepMin < 390)
        return {
          key: 'sleep-short',
          mood: 'sleepy',
          text: 'Kurze Nacht – heute früher ins Bett.',
          ask: 'Wie schlafe ich schneller ein und tiefer durch?',
        }
      return {
        key: 'sleep-tip',
        mood: 'happy',
        text: 'Feste Schlafenszeit = besserer Tiefschlaf.',
      }
    case 'vitals':
      if (c.restingHr != null && c.restingHrNormal != null && c.restingHr - c.restingHrNormal >= 4)
        return {
          key: 'vitals-rhr',
          mood: 'tired',
          text: `Ruhepuls ${c.restingHr} statt ~${Math.round(c.restingHrNormal)} – heute ruhig angehen.`,
        }
      return {
        key: 'vitals-tip',
        mood: 'happy',
        text: 'Vergleich dich mit dir, nicht mit anderen.',
      }
    case 'insights':
      return {
        key: 'insights-tip',
        mood: 'focus',
        text: 'Je länger du dabei bist, desto genauer werden die Muster.',
        ask: 'Welche Muster siehst du in meinem Training, Schlaf und meiner Ernährung?',
      }
    case 'cycle':
      return {
        key: 'cycle-tip',
        mood: 'happy',
        text: 'Trag den ersten Tag deiner Periode ein – der Rest rechnet sich von selbst.',
        ask: 'Wie passe ich mein Training an meinen Zyklus an?',
      }
    case 'social':
      if (c.friends === 0)
        return {
          key: 'social-invite',
          mood: 'cheer',
          text: 'Lade Freunde ein – zusammen bleibt man dran.',
        }
      return {
        key: 'social-tip',
        mood: 'happy',
        text: 'Ein Kudos motiviert enorm.',
      }
  }
}

function nutritionProtein(proteinLeft: number, kcalLeft: number): Tip {
  return {
    key: 'food-protein',
    mood: 'hungry',
    text: `Noch ${fmt(proteinLeft)} g Eiweiß offen – plan die nächste Mahlzeit eiweißreich.`,
    ask: `Ich brauche heute noch ${fmt(proteinLeft)} g Eiweiß und habe ${fmt(Math.max(0, kcalLeft))} kcal übrig. Was soll ich essen?`,
  }
}
