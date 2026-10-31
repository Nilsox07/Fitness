// App-weite Suche (wie die Suche in den iPhone-Einstellungen): jede Funktion mit
// Stichwörtern, die Menschen wirklich tippen. Reine Logik – getestet in searchIndex.test.ts.

export type SearchSection = 'Heute' | 'Training' | 'Ernährung' | 'Fortschritt' | 'Community' | 'Einstellungen' | 'Buddy'

export interface SearchEntry {
  id: string
  label: string
  sub: string
  section: SearchSection
  /** Ziel-Route; 'buddy' öffnet den Buddy, 'intro' das Intro */
  to: string
  keywords: string
  /** nur sichtbar, wenn das Modul an ist */
  needs?: 'nutrition' | 'social' | 'watch'
}

export const SEARCH_ENTRIES: SearchEntry[] = [
  // Heute
  {
    id: 'today',
    label: 'Heute',
    sub: 'Dein Tag auf einen Blick',
    section: 'Heute',
    to: '/today',
    keywords: 'start übersicht dashboard tag',
  },
  {
    id: 'today-edit',
    label: 'Heute anpassen',
    sub: 'Widgets hinzufügen, entfernen, sortieren',
    section: 'Heute',
    to: '/today?edit=1',
    keywords: 'widgets anordnen reihenfolge karten dashboard bearbeiten',
  },

  // Training
  {
    id: 'train',
    label: 'Training starten',
    sub: 'Nächstes Training oder frei',
    section: 'Training',
    to: '/',
    keywords: 'workout gym los start satz sätze',
  },
  {
    id: 'plans',
    label: 'Pläne',
    sub: 'Trainingspläne erstellen & bearbeiten',
    section: 'Training',
    to: '/plans',
    keywords: 'plan split push pull beine ganzkörper ki plan',
  },
  {
    id: 'intro',
    label: 'Plan neu erstellen',
    sub: 'Ziel, Tage & Ausdauer – Buddy fragt kurz nach',
    section: 'Training',
    to: 'intro',
    keywords: 'einrichtung intro neu anfangen ziel trainingsplan cardio ausdauer plan erstellen',
  },
  {
    id: 'rhythm',
    label: 'Trainingsrhythmus',
    sub: 'Welche Tage du trainierst',
    section: 'Training',
    to: '/plans?rhythm=1',
    keywords: 'wochentage zeitplan ruhetag rotation rhythmus',
  },
  {
    id: 'exercises',
    label: 'Übungen',
    sub: 'Deine Übungen & Bestwerte',
    section: 'Training',
    to: '/exercises',
    keywords: 'übung bankdrücken kniebeuge rekord 1rm',
  },
  {
    id: 'library',
    label: 'Übungsbibliothek',
    sub: 'Hunderte Übungen mit Anleitung',
    section: 'Training',
    to: '/exercises?view=library',
    keywords: 'bibliothek anleitung technik neue übung',
  },
  {
    id: 'quick',
    label: 'Home-Workout',
    sub: 'Ohne Geräte, mit Timer',
    section: 'Training',
    to: '/quick',
    keywords: 'zuhause hiit timer ohne geräte schnell',
  },
  {
    id: 'history',
    label: 'Verlauf',
    sub: 'Alle bisherigen Trainings',
    section: 'Training',
    to: '/history',
    keywords: 'historie vergangene trainings kalender',
  },

  // Ernährung
  {
    id: 'food-add',
    label: 'Essen eintragen',
    sub: 'Suchen, scannen oder per Foto',
    section: 'Ernährung',
    to: '/nutrition?add=menu',
    keywords: 'mahlzeit loggen kalorien hinzufügen tracken',
    needs: 'nutrition',
  },
  {
    id: 'food-photo',
    label: 'Essen fotografieren',
    sub: 'KI schätzt die Nährwerte',
    section: 'Ernährung',
    to: '/nutrition?add=photo',
    keywords: 'foto kamera bild ki teller',
    needs: 'nutrition',
  },
  {
    id: 'food-search',
    label: 'Lebensmittel suchen',
    sub: 'Datenbank & Barcode',
    section: 'Ernährung',
    to: '/nutrition?add=search',
    keywords: 'barcode scannen produkt suchen datenbank',
    needs: 'nutrition',
  },
  {
    id: 'restaurant',
    label: 'Restaurant & unterwegs',
    sub: 'Beste Wahl bei McDonald’s & Co.',
    section: 'Ernährung',
    to: '/nutrition?add=restaurant',
    keywords: 'restaurant fastfood mcdonalds burger king speisekarte unterwegs',
    needs: 'nutrition',
  },
  {
    id: 'nutrition',
    label: 'Ernährung heute',
    sub: 'Kalorien, Eiweiß, Mahlzeiten',
    section: 'Ernährung',
    to: '/nutrition',
    keywords: 'kalorien kcal makros tagebuch protein eiweiß',
    needs: 'nutrition',
  },
  {
    id: 'water',
    label: 'Wasser',
    sub: 'Trinken eintragen',
    section: 'Ernährung',
    to: '/nutrition',
    keywords: 'trinken wasser liter glas',
    needs: 'nutrition',
  },
  {
    id: 'supplements',
    label: 'Supplemente',
    sub: 'Kreatin & Co. mit Erinnerung',
    section: 'Ernährung',
    to: '/nutrition',
    keywords: 'kreatin vitamin d omega magnesium tabletten pillen',
    needs: 'nutrition',
  },
  {
    id: 'recipes',
    label: 'Rezepte',
    sub: 'Entdecken, importieren, eigene',
    section: 'Ernährung',
    to: '/recipes',
    keywords: 'kochen rezept tiktok instagram import gericht',
    needs: 'nutrition',
  },
  {
    id: 'mealplan',
    label: 'Wochenplan',
    sub: 'Essen für die Woche planen',
    section: 'Ernährung',
    to: '/shopping?view=plan',
    keywords: 'essensplan mealprep woche planen',
    needs: 'nutrition',
  },
  {
    id: 'shopping',
    label: 'Einkaufsliste',
    sub: 'Aus deinem Wochenplan',
    section: 'Ernährung',
    to: '/shopping?view=shopping',
    keywords: 'einkaufen supermarkt liste',
    needs: 'nutrition',
  },
  {
    id: 'goal',
    label: 'Ziel & Körperdaten',
    sub: 'Abnehmen, Aufbauen, Kalorienziel',
    section: 'Ernährung',
    to: '/profile?s=goal',
    keywords: 'ziel abnehmen zunehmen muskelaufbau kalorienziel diät defizit größe alter ernährungsweise fasten',
    needs: 'nutrition',
  },

  // Fortschritt
  {
    id: 'strength',
    label: 'Kraft-Fortschritt',
    sub: 'Volumen, Muskelbalance, Rekorde',
    section: 'Fortschritt',
    to: '/analytics',
    keywords: 'statistik auswertung volumen kraft rekorde muskeln',
  },
  {
    id: 'cardio',
    label: 'Ausdauer',
    sub: 'Läufe, Radtouren von der Uhr',
    section: 'Fortschritt',
    to: '/cardio',
    keywords: 'laufen joggen rad fahrrad km pace strecke',
    needs: 'watch',
  },
  {
    id: 'sleep',
    label: 'Schlaf & Erholung',
    sub: 'Schlafphasen, Tagesform',
    section: 'Fortschritt',
    to: '/sleep',
    keywords: 'schlaf tiefschlaf rem nacht tagesform erholung müde',
    needs: 'watch',
  },
  {
    id: 'vitals',
    label: 'Herz & Körper',
    sub: 'Puls, HRV, Sauerstoff, VO₂max',
    section: 'Fortschritt',
    to: '/vitals',
    keywords: 'puls ruhepuls hrv herz sauerstoff spo2 blutdruck vo2max schritte',
    needs: 'watch',
  },
  {
    id: 'body',
    label: 'Körperfoto & Körperfett',
    sub: 'KI-Schätzung, Vergleich',
    section: 'Fortschritt',
    to: '/body',
    keywords: 'körperfett foto vorher nachher figur',
  },
  {
    id: 'weight',
    label: 'Gewicht',
    sub: 'Gewicht eintragen & Verlauf',
    section: 'Fortschritt',
    to: '/nutrition?weigh=1',
    keywords: 'waage wiegen kg gewicht trend',
  },
  {
    id: 'badges',
    label: 'Erfolge',
    sub: 'Abzeichen & Meilensteine',
    section: 'Fortschritt',
    to: '/badges',
    keywords: 'abzeichen badges trophäen meilensteine level',
  },
  {
    id: 'recap',
    label: 'Wochenfazit',
    sub: 'Buddy wertet deine Woche aus',
    section: 'Fortschritt',
    to: '/profile?s=review',
    keywords: 'woche zusammenfassung fazit rückblick',
  },

  // Community
  {
    id: 'social',
    label: 'Freunde & Bestenliste',
    sub: 'Wer ist vorne?',
    section: 'Community',
    to: '/social',
    keywords: 'freunde rangliste bestenliste vergleich duell',
    needs: 'social',
  },
  {
    id: 'challenges',
    label: 'Challenges',
    sub: 'Wetten mit Einsatz unter Freunden',
    section: 'Community',
    to: '/social',
    keywords: 'challenge wette einsatz duell',
    needs: 'social',
  },
  {
    id: 'feed',
    label: 'Aktivitäten',
    sub: 'Was deine Freunde machen',
    section: 'Community',
    to: '/feed',
    keywords: 'feed neuigkeiten kudos',
    needs: 'social',
  },

  // Einstellungen
  {
    id: 'profile',
    label: 'Profil',
    sub: 'Name, Level, Konto',
    section: 'Einstellungen',
    to: '/profile',
    keywords: 'konto name email abmelden',
  },
  {
    id: 'modules',
    label: 'Bereiche',
    sub: 'Ernährung, Community, Smartwatch ein/aus',
    section: 'Einstellungen',
    to: '/profile?s=modules',
    keywords: 'ausblenden einblenden module tabs',
  },
  {
    id: 'watch',
    label: 'Smartwatch verbinden',
    sub: 'Health Connect, Garmin, Samsung & Co.',
    section: 'Einstellungen',
    to: '/profile?s=modules',
    keywords: 'uhr smartwatch health connect garmin samsung fitbit pixel verbinden',
  },
  {
    id: 'notify',
    label: 'Benachrichtigungen',
    sub: 'Erinnerungen einstellen',
    section: 'Einstellungen',
    to: '/profile?s=push',
    keywords: 'erinnerung push mitteilung benachrichtigung',
  },
  {
    id: 'appearance',
    label: 'Darstellung',
    sub: 'Hell, Dunkel, Ton',
    section: 'Einstellungen',
    to: '/profile?s=appearance',
    keywords: 'dunkelmodus darkmode hell dunkel sound ton',
  },
  {
    id: 'color',
    label: 'App-Farbe & Buddy-Aussehen',
    sub: 'Farben, Outfits, Freischaltungen',
    section: 'Einstellungen',
    to: '/badges',
    keywords: 'farbe theme design outfit kleidung skin freischaltungen akzent',
  },
  {
    id: 'settings',
    label: 'Meine Einstellungen',
    sub: 'Kalorien-Bonus, Mahlzeiten, Tageswechsel',
    section: 'Einstellungen',
    to: '/profile?s=settings',
    keywords: 'einstellungen bonus mahlzeiten aufteilung tageswechsel',
  },
  {
    id: 'export',
    label: 'Daten exportieren',
    sub: 'CSV-Download',
    section: 'Einstellungen',
    to: '/profile?s=export',
    keywords: 'export csv backup daten herunterladen',
  },

  // Buddy
  {
    id: 'buddy',
    label: 'Buddy fragen',
    sub: 'Dein KI-Coach',
    section: 'Buddy',
    to: 'buddy',
    keywords: 'ki coach frage hilfe chat assistent',
  },
  {
    id: 'buddy-tone',
    label: 'Buddy-Ton',
    sub: 'So spricht dein Buddy',
    section: 'Buddy',
    to: '/profile?s=coach',
    keywords: 'ton sprache coach locker streng',
  },
]

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')

export interface Modules {
  nutrition: boolean
  social: boolean
  watch: boolean
}

/** Treffer sortiert: Titel-Anfang > Titel enthält > Stichwort. Alle Wörter müssen vorkommen. */
export function searchEntries(
  query: string,
  mods: Modules,
  list: readonly SearchEntry[] = SEARCH_ENTRIES,
): SearchEntry[] {
  const visible = list.filter((e) => !e.needs || mods[e.needs])
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored: { e: SearchEntry; score: number }[] = []
  for (const e of visible) {
    const label = normalize(e.label)
    const hay = `${label} ${normalize(e.sub)} ${normalize(e.keywords)} ${normalize(e.section)}`
    if (!words.every((w) => hay.includes(w))) continue
    let score = 0
    for (const w of words) {
      if (label.startsWith(w)) score += 30
      else if (label.split(' ').some((t) => t.startsWith(w))) score += 20
      else if (label.includes(w)) score += 10
      else score += 2
    }
    scored.push({ e, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.e)
}

/** Vorschläge ohne Eingabe (häufigste Ziele). */
export function suggestions(mods: Modules): SearchEntry[] {
  const ids = ['food-add', 'train', 'goal', 'sleep', 'recipes', 'watch', 'today-edit', 'color']
  return ids
    .map((id) => SEARCH_ENTRIES.find((e) => e.id === id)!)
    .filter((e) => e && (!e.needs || mods[e.needs]))
    .slice(0, 6)
}
