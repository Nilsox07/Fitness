// Ausführliche Erklärungen zu jeder Ernährungsweise (für die Info-Ansicht).
// Bewusst neutral und alltagsnah formuliert – keine medizinische Beratung.

import type { DietMacro, DietRestriction, Fasting } from './dietStyle'

export interface DietInfo {
  /** Ein Satz: worum geht's? */
  what: string
  /** Für wen passt das? */
  forWhom: string
  pros: string[]
  /** Worauf achten / Nachteile */
  watch: string[]
  /** Typische Lebensmittel bzw. ein Beispieltag */
  example?: string
  /** Deutlicher Warnhinweis (z. B. bei Crash-Diäten) */
  warning?: string
}

export const DIET_MACRO_INFO: Record<DietMacro, DietInfo> = {
  balanced: {
    what: 'Die klassische Verteilung: Eiweiß nach deinem Ziel, etwa 0,8 g Fett pro kg Körpergewicht, der Rest kommt aus Kohlenhydraten.',
    forWhom: 'Für fast alle – besonders, wenn du keine Lebensmittelgruppe weglassen willst.',
    pros: ['Flexibel und alltagstauglich', 'Genug Kohlenhydrate für intensives Training', 'Leicht durchzuhalten'],
    watch: ['Ohne Plan rutscht Eiweiß oft zu niedrig – Eiweißziel im Blick behalten'],
    example: 'Haferflocken mit Quark, Hähnchen mit Reis und Gemüse, Brot mit Ei, Obst.',
  },
  high_protein: {
    what: 'Mindestens 2,2 g Eiweiß pro kg Körpergewicht, Kohlenhydrate und Fett teilen sich den Rest.',
    forWhom: 'Beim Abnehmen und beim Muskelaufbau – und für alle, die schnell wieder Hunger haben.',
    pros: ['Schützt Muskeln im Kaloriendefizit', 'Sättigt am stärksten', 'Unterstützt die Regeneration'],
    watch: ['Viel trinken', 'Eiweiß auf 3–5 Mahlzeiten verteilen', 'Bei Nierenerkrankungen vorher ärztlich abklären'],
    example: 'Skyr mit Beeren, Thunfisch-Salat, Hähnchen oder Tofu, Proteinshake nach dem Training.',
  },
  low_carb: {
    what: 'Nur etwa 20–25 % der Kalorien aus Kohlenhydraten, dafür mehr Fett und Eiweiß.',
    forWhom: 'Wenn dir Brot, Nudeln und Süßes schwerfallen oder du stabilere Energie über den Tag willst.',
    pros: ['Weniger Heißhunger auf Süßes', 'Gut kombinierbar mit Abnehmen', 'Keine strikte Ketose nötig'],
    watch: ['Intensives Training kann sich anfangs zäher anfühlen', 'Ballaststoffe über Gemüse und Nüsse sichern'],
    example: 'Rührei mit Gemüse, Bowl mit Lachs und Avocado, Steak mit Salat, Nüsse als Snack.',
  },
  keto: {
    what: 'Höchstens etwa 30 g Kohlenhydrate am Tag, Fett liefert den Großteil der Energie. Der Körper stellt auf Ketonkörper um.',
    forWhom: 'Für Leute, die konsequent sein können und gern fettreich essen.',
    pros: ['Viele berichten von weniger Hunger', 'Klare Regeln', 'Schneller Wasserverlust am Anfang motiviert'],
    watch: [
      'Erste 1–2 Wochen oft „Keto-Grippe“ (müde, Kopfweh) – Salz und Wasser helfen',
      'Kraft- und Sprintleistung kann leiden',
      'Brot, Nudeln, Reis, Kartoffeln, Obst und Zucker fallen fast komplett weg',
    ],
    example: 'Eier mit Speck, Hähnchenschenkel mit Brokkoli in Butter, Käse, Oliven, Nüsse.',
  },
  mediterranean: {
    what: 'Etwa 35 % der Kalorien aus Fett – vor allem Olivenöl, Nüsse und Fisch –, viel Gemüse, Hülsenfrüchte und Vollkorn.',
    forWhom: 'Für alle, die langfristig gesund und genussvoll essen wollen.',
    pros: ['Sehr gut untersucht und herzfreundlich', 'Abwechslungsreich und lecker', 'Leicht dauerhaft durchzuhalten'],
    watch: ['Öl und Nüsse sind sehr kalorienreich – Mengen abwiegen'],
    example: 'Joghurt mit Nüssen, Linsensalat mit Feta, Lachs mit Ofengemüse und Olivenöl.',
  },
  low_fat: {
    what: 'Nur etwa 20 % der Kalorien aus Fett, magere Eiweißquellen und mehr Kohlenhydrate.',
    forWhom: 'Für Ausdauersportler und alle, die große Portionen mit wenig Kalorien mögen.',
    pros: ['Große Portionen für wenig Kalorien', 'Viel Energie fürs Training', 'Einfach bei Fertig-Kalorien zu zählen'],
    watch: ['Fett nicht unter ~0,5 g pro kg drücken (Hormone)', 'Gute Fette aus Fisch und Nüssen trotzdem einplanen'],
    example: 'Haferflocken mit Magerquark, Pute mit Kartoffeln und Gemüse, Reis-Bowl, Obst.',
  },
  zone: {
    what: 'Jede Mahlzeit besteht aus etwa 40 % Kohlenhydraten, 30 % Eiweiß und 30 % Fett.',
    forWhom: 'Für Leute, die feste Regeln pro Mahlzeit mögen und Blutzuckerspitzen vermeiden wollen.',
    pros: ['Gleichmäßige Energie über den Tag', 'Ausgewogen, nichts fällt weg', 'Viel Eiweiß ohne Extrem'],
    watch: ['Erfordert etwas Planung pro Mahlzeit'],
    example: 'Vollkornbrot mit Ei und Avocado, Hähnchen-Reis-Bowl mit Nüssen, Joghurt mit Beeren und Mandeln.',
  },
  psmf: {
    what: 'Protein-Sparing Modified Fast: fast nur mageres Eiweiß plus Gemüse, sehr wenig Fett und Kohlenhydrate – etwa 1000 kcal am Tag.',
    forWhom: 'Nur für gesunde Erwachsene mit spürbar Übergewicht, die für kurze Zeit schnell abnehmen wollen.',
    pros: ['Sehr schneller Fettverlust', 'Viel Eiweiß schützt die Muskulatur', 'Klare, einfache Regeln'],
    watch: [
      'Höchstens 2–6 Wochen, danach schrittweise zurück auf normale Kalorien',
      'Elektrolyte (Salz, Kalium, Magnesium) und ein Multivitamin einplanen',
      'Training eher leicht halten – Kraft sinkt',
      'Nicht für Jugendliche, Schwangere, Stillende oder bei Essstörungen, Diabetes, Herz- oder Nierenerkrankungen',
    ],
    example: 'Magerquark, Hähnchenbrust, Pute, weißer Fisch, Eiklar, viel grünes Gemüse.',
    warning: 'Sehr niedrige Kalorien – bitte vorher ärztlich abklären und nicht länger als 6 Wochen am Stück.',
  },
}

export const DIET_RESTRICTION_INFO: Record<DietRestriction, DietInfo> = {
  vegetarian: {
    what: 'Kein Fleisch und kein Fisch. Eier und Milchprodukte sind erlaubt.',
    forWhom: 'Aus Überzeugung, für die Umwelt oder einfach aus Geschmack.',
    pros: ['Eiweiß gut über Eier, Skyr, Quark, Käse und Hülsenfrüchte erreichbar'],
    watch: ['Eisen und B12 im Blick behalten'],
  },
  vegan: {
    what: 'Keinerlei tierische Produkte: kein Fleisch, Fisch, Milch, Käse, Ei oder Honig.',
    forWhom: 'Für alle, die komplett pflanzlich essen.',
    pros: ['Viele Ballaststoffe', 'Eiweiß über Tofu, Tempeh, Seitan, Hülsenfrüchte und veganes Proteinpulver'],
    watch: ['Vitamin B12 immer ergänzen', 'Eiweißquellen kombinieren (z. B. Hülsenfrüchte + Getreide)'],
  },
  pescetarian: {
    what: 'Kein Fleisch, aber Fisch und Meeresfrüchte sind erlaubt.',
    forWhom: 'Wenn du auf Fleisch verzichten, aber Omega-3 aus Fisch behalten willst.',
    pros: ['Fisch liefert mageres Eiweiß und Omega-3'],
    watch: ['Raubfische wie Thunfisch nicht täglich (Quecksilber)'],
  },
  unprocessed: {
    what: 'Möglichst unverarbeitete Lebensmittel, keine stark verarbeiteten Fertigprodukte.',
    forWhom: 'Für alle, die bewusster und „sauberer“ essen wollen.',
    pros: ['Mehr Sättigung pro Kalorie', 'Weniger Zucker, Salz und Zusatzstoffe'],
    watch: ['Braucht mehr Zeit zum Kochen'],
  },
  gluten_free: {
    what: 'Kein Weizen, Dinkel, Roggen oder Gerste. Reis, Kartoffeln, Hirse, Quinoa und glutenfreier Hafer gehen.',
    forWhom: 'Bei Zöliakie oder Gluten-Unverträglichkeit.',
    pros: ['Die KI schlägt nur passende Rezepte und Lebensmittel vor'],
    watch: ['Bei Zöliakie auf Spuren achten – Verpackung prüfen'],
  },
  lactose_free: {
    what: 'Keine laktosehaltigen Milchprodukte. Laktosefreie Varianten und Hartkäse sind meist in Ordnung.',
    forWhom: 'Bei Laktoseintoleranz.',
    pros: ['Skyr, Quark und Whey gibt es laktosefrei – Eiweißziel bleibt gut erreichbar'],
    watch: ['Calcium über laktosefreie Milchprodukte, Mineralwasser oder Grünkohl sichern'],
  },
}

export const FASTING_INFO: Record<Exclude<Fasting, 'none'>, DietInfo> = {
  '16:8': {
    what: '16 Stunden nichts essen, innerhalb von 8 Stunden die Mahlzeiten – z. B. 12 bis 20 Uhr.',
    forWhom: 'Der einfachste Einstieg: meist reicht es, das Frühstück wegzulassen.',
    pros: ['Weniger Gelegenheiten für Snacks', 'Leicht in den Alltag einzubauen'],
    watch: [
      'Wasser, Tee und schwarzer Kaffee sind in der Fastenzeit erlaubt',
      'Eiweiß in weniger Mahlzeiten unterbringen',
    ],
  },
  '18:6': {
    what: '18 Stunden fasten, 6 Stunden Essensfenster.',
    forWhom: 'Wenn 16:8 schon gut klappt.',
    pros: ['Noch weniger Snack-Gelegenheiten'],
    watch: ['Eiweißziel in 2–3 Mahlzeiten unterbringen kann schwer werden'],
  },
  '20:4': {
    what: '20 Stunden fasten, nur 4 Stunden Essensfenster („Warrior Diet“).',
    forWhom: 'Für Erfahrene mit wenig Hunger tagsüber.',
    pros: ['Sehr einfach, kaum Mahlzeiten zu planen'],
    watch: ['Hohe Kalorien- und Eiweißziele sind kaum zu schaffen', 'Nicht vor intensivem Training ohne Essen'],
  },
  '5:2': {
    what: '5 Tage normal essen, an 2 nicht aufeinanderfolgenden Tagen nur etwa 500–600 kcal.',
    forWhom: 'Wenn du lieber zwei harte Tage hast als jeden Tag ein Defizit.',
    pros: ['An normalen Tagen keine Einschränkung'],
    watch: ['Fastentage nicht auf Trainingstage legen', 'An Fastentagen eiweißreich essen'],
  },
}
