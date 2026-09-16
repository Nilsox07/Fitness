// „Was ist neu?" — wird beim ersten Öffnen nach einem Versions-Update gezeigt.
// Für ein neues Release: APP_VERSION erhöhen und oben ein RELEASE-Objekt ergänzen.

export const APP_VERSION = '2.0'

export interface Release {
  version: string
  title: string
  groups: { title: string; items: string[] }[]
}

export const RELEASES: Release[] = [
  {
    version: '2.0',
    title: 'Großes Update 🎉',
    groups: [
      {
        title: '✨ KI-Assistent',
        items: [
          'Neuer Assistent (✨-Button): per Text oder Sprache Fragen stellen, Essen loggen, Übungen anlegen oder navigieren.',
          'Coach-Chat & Wochen-Review auf Basis deiner echten Daten.',
        ],
      },
      {
        title: '🍎 Ernährung mit KI',
        items: [
          'Foto → Nährwerte, freie Texteingabe und Essensplan-Generator.',
          'Rezept aus Kühlschrank-Foto oder Text — speichern & mit Freunden teilen.',
          'Mahlzeiten-Gruppen, Wasser-Tracking, Körpergewicht, mehr Kalorien an Trainingstagen.',
        ],
      },
      {
        title: '🏋️ Training',
        items: [
          'Übung per Sprache anlegen; ganze Geräteliste des Studios per Foto/Text importieren.',
          'Sekundärmuskeln je Übung + automatische Muskel-Erkennung.',
          'Alternative finden, wenn ein Gerät besetzt ist.',
          'Pausentimer, Geräte-/Sitz-Notiz, dynamischer Aufwärmsatz.',
        ],
      },
      {
        title: '📈 Auswertung',
        items: [
          'Sätze pro Muskel/Woche, Drücken/Ziehen-Balance, Regeneration, Trainings-Heatmap.',
        ],
      },
      {
        title: '🎮 Gamification',
        items: [
          'XP & Level, Tages-/Wochen-Quests, Ränge, Badges & Sammlung.',
          'Monats-Season mit Battle-Pass, Streak-Freeze, Konfetti & Sounds.',
          'Freischaltbare Akzentfarben und Maskottchen-Skins.',
        ],
      },
      {
        title: '👥 Freunde',
        items: [
          'Freunde per Code, faires Leaderboard (Fortschritt statt nur Kilos), Wochen-Challenges.',
          'Aktivitäts-Feed mit 👏 und Kommentaren, „Wann Gym?" und Protein-Battle.',
        ],
      },
      {
        title: '⌚ Mehr',
        items: [
          'Fitbit-Anbindung (Gewicht, Schritte, Ruhepuls).',
          'Offline-Speicher, Trainings-Erinnerungen, CSV-Export, frisches Design.',
        ],
      },
    ],
  },
]

export function lastSeenVersion(): string | null {
  try {
    return localStorage.getItem('whatsnew_v')
  } catch {
    return null
  }
}

export function markSeen(version = APP_VERSION) {
  try {
    localStorage.setItem('whatsnew_v', version)
  } catch {
    /* ignore */
  }
}
