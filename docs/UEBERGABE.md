# Übergabe: vom PWA-Stand zur Android-App

Stand: Oktober 2026. Dieses Dokument ist der Startpunkt für die nächste Session (lokal mit Claude Code).
Die festen Regeln stehen in [`CLAUDE.md`](../CLAUDE.md).

---

## 1. Was steht und läuft

- PWA auf Vercel, Daten in Supabase. Alle Features aus den bisherigen Sessions sind live, unter anderem:
  - Training, Pläne, Fortschritt, Buddy, Level/Prestige/Erfolge, Saisons mit KI-Monatsthema
  - Ernährung mit Foto/Text/Barcode/Rezepten, Essensplan, Einkaufsliste, Supplemente mit Erinnerung
  - Restaurant: Ort eintippen; bei Ketten exakte Werte, eine „Beste Wahl“ und 2 Alternativen;
    sonst Speisekarten-Fotos (bis 4) oder KI-Vorschlag
  - Community mit Bestenliste/Podest, Duellen, Einsatz-Challenges, Kudos, Monatsrückblick als Story
  - Körperfoto mit Körperfett-Schätzung
  - Push-Erinnerungen (Web-Push, alle 15 min über pg_cron → `/api/cron/reminders`)
- KI-Schutz (neu, `api/_aiguard.js`):
  - nur angemeldete Nutzer
  - Größenlimits
  - feste Themen-Grenze (nur Fitness/Ernährung), die der Server jedem Aufruf voranstellt
  - Limits von 8 pro Minute und 100 pro Tag (Tabelle `ai_calls`)
  - ohne Limit: E-Mails in `AI_UNLIMITED_EMAILS`

### Migrationen

`0001`–`0035` und `0037`, `0039`–`0045` sind ausgeführt (Stand 04.11.2026). Nicht bestätigt: `0036_ai_calls.sql`
(KI-Limits) und `0038_health_details.sql` (Verläufe, Schlafphasen, Vitalwerte) – ggf. nachholen, danach `0044_grants.sql`
erneut ausführen. Regel für neue Migrationen: Tabellen immer mit GRANTs anlegen (siehe CLAUDE.md).

### Umgebungsvariablen (Vercel, nie ins Git)

| Variable | Zweck |
| --- | --- |
| `GEMINI_API_KEY` | KI |
| `GEMINI_MODEL` | optional, kommagetrennt mit Ausweichmodellen |
| `AI_PROVIDER` | optional (`gemini`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web-Push |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron, Push, KI-Limits, Konto löschen (`api/account/delete.js`, ohne Key → 503) |
| `CRON_SECRET` | schützt `/api/cron/reminders`; pg_cron schickt `Authorization: Bearer …` |
| `AI_UNLIMITED_EMAILS` | **neu, noch eintragen:** eure beiden E-Mails, kommagetrennt |
| `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` | Fitbit (optional) |

### Backup

Der Stand vor dem Umbau zur All-in-One-App liegt im Branch **`backup/vor-umbau-2026-10-30`** (Commit `be0d2f8`).

---

## 1b. Umbau zur All-in-One-App (Oktober 2026)

Positionierung: **All-in-One für den Fitness-/Gym-Hype** – Kraft, Ausdauer, Ernährung, Schlaf und Freunde in
einer App, aber nur das sichtbar, was man nutzt.

- **Tab „Heute“** (Startseite, `src/pages/Today.tsx`): Widgets frei hinzufügen, entfernen und per Ziehen
  sortieren („Heute anpassen“). Katalog und Logik in `src/lib/dashboard.ts`, Inhalte in
  `src/components/today/Widgets.tsx`, Daten aus `src/hooks/useToday.ts`. Reihenfolge in `profiles.prefs.dashboard`.
- **Module** (Profil → Bereiche, `ModuleSettings.tsx`): Ernährung, Community, Smartwatch. Aus = Tab, Widgets
  und Seiten verschwinden. Flags in `src/lib/prefs.tsx` (`showNutrition`, `showSocial`, `hasWatch`).
- **Fortschritt-Tab** (`/progress`, `src/pages/Progress.tsx`): Kachel-Übersicht wie Apple Health/Whoop – Wochen-Ring, Buddy-Tipp,
  Kacheln mit großer Zahl + Mini-Verlauf (Kraft, Ausdauer, Schlaf, Herz, Ernährung, Gewicht, Verlauf; Reihen in
  `src/lib/progressSeries.ts`); jede Kachel führt auf ihre Detailseite
  (`/analytics?view=strength|food`, `/cardio`, `/sleep`, `/vitals`, `/body`, `/badges`) mit „‹ Fortschritt“ zurück.
  Keine Wisch-Leiste mehr. Uhr-Bereiche nur mit `hasWatch`.
- **Aussehen** (Profil → Aussehen, `AppearanceSettings.tsx`): App-Farbe, Buddy (Figur, Variante, Accessoire,
  Hintergrund, Rahmen, Titel je als Sheet) und Hell/Dunkel an einem Ort. App ist auf Hochformat fixiert.
- **Intro beim ersten Start** (`components/onboarding/Onboarding.tsx`, Logik in `src/lib/onboarding.ts`, getestet):
  Ziel, Erfahrung, Gym/Zuhause, Trainingstage, Ausdauer (Art + Häufigkeit), Bereiche, Körperdaten → legt Übungen,
  Pläne und den Wochen-Rhythmus an, berechnet das Kalorienziel und speichert einen Ausdauer-Plan
  (`prefs.cardioPlan`, abhaken über `prefs.cardioDone`, mit Uhr automatisch). Erneut: Profil → „Plan neu erstellen“.
- **Texte:** Übersichten zeigen nur kurze Zeilen; Erklärungen liegen hinter einem (i) (`components/ui/InfoTip.tsx`).
- **Zurück** folgt dem Verlauf (`src/lib/navHistory.ts`, TopBar): man landet dort, wo man herkam. Android-Zurück
  schließt zuerst offene Sheets (`src/lib/backStack.ts`, `useBackClose`). Deep Links (Widgets, Erinnerungen,
  Teilen) gehen auch beim Kaltstart (`src/lib/deepLink.ts`).
- **Erinnerungen in der App:** Web-Push gibt es in der Android-App nicht – die App plant die Erinnerungen für heute
  und morgen selbst (`src/lib/localReminders.ts`, getestet; geplant in `NativeSync`), nach Profil →
  Benachrichtigungen und nur, wenn noch etwas fehlt. Tippen öffnet die passende Seite.
- **Kalorien-Schätzung:** Prompt schätzt Komponenten einzeln (Gewicht über Größenvergleich, Werte im gegarten
  Zustand) und führt Fett/Soßen als eigene Posten (`kind`); kcal werden gegen die Makros geprüft
  (`consistentKcal`). Zubereitungsfett rechnet die KI selbst ein (nur bei Gebratenem; Restaurant = übliche, höhere Menge) – keine Rückfrage, der Posten steht löschbar in der Zutatenliste.
- **Tagesform** (`readiness` in `health.ts`): Schlaf + Tiefschlaf, HRV, Ruhepuls, Kraft- und Ausdauer-Belastung der
  letzten 2 Tage, Ernährung, Eiweiß und Trinken von gestern. KI-Briefing direkt in der Tagesform-Karte (`useBriefing`).
- **Buddy oben auf jeder Hauptseite** (`<BuddyTip page=…/>`): ganze Figur mit Sprechblase (Tipp aus den Daten,
  Knöpfe, „Frag Buddy“, auf Heute ohne Uhr das Tagesbriefing), für heute wegtippbar.
- **KI-Knopf** unten rechts über der Menüleiste (`FloatingBuddy.tsx`, wie bei Google Health): öffnet den Assistenten,
  blendet sich bei offenen Sheets (`useOverlayOpen`), beim Scrollen und im laufenden Training aus.
- **Animationen:** Seitenwechsel (`.anim-page`), Zahlen zählen hoch (`CountUp`), Ringe/Balken laufen von 0 an
  (`useMounted`), Lade-Schimmer, Drück-Feedback auf Karten, Haptik in der App (`haptic()` in `native.ts`).
- **Nährwerte:** Ballaststoffe gleichrangig mit den Makros (Ziel 14 g/1000 kcal), Zucker/Salz/ges. Fett unter „Mehr“,
  Zucker/Salz in den Einstellungen anpinnbar. KI-Analyse liefert Nährstoff-Highlights (z. B. „Viel Vitamin C“).
- **Zyklus** (Bereich, Standard aus, nur angeboten wenn nicht „Mann“; Einwilligung beim Einschalten): `/cycle`,
  Logik `src/lib/cycle.ts` (Ø Zyklus/Periode, Phase, nächste Periode, Trainings-Hinweis, Tagesform-Effekt,
  Wassereinlagerung), Daten `cycle_periods`/`cycle_logs` (Migration 0039, RLS nur eigene Zeilen), Health Connect
  `READ_MENSTRUATION` (Perioden + Blutungstage → `mergePeriods`). Widget „Zyklus“, Kachel im Fortschritt,
  Faktor in der Tagesform, Hinweis beim Gewicht. Keine Fruchtbarkeits-/Verhütungsaussagen; nie in der Community.
- **Store-Pflichten:** Einwilligung + 18+ bei der Registrierung (`prefs.consent`, `src/lib/consent.ts`; neue Abfrage
  durch Erhöhen von `CONSENT_VERSION`, Bestandsnutzer sehen einmal `ConsentGate`), Konto & Daten löschen (Profil →
  Konto & Daten, `api/account/delete.js`: Körperfotos, `app_events`, dann Auth-User; Rest per `on delete cascade`),
  Feedback (Tabelle `feedback`, optional mit Screenshot), anonyme Statistik (`src/lib/track.ts` → `app_events`,
  nur mit Einwilligung, gehashte Nutzer-ID).
- **Zielgewicht & Körpermaße** (`/body`): `prefs.targetWeight`/`targetWeightSince`, ungefährer Weg als Spanne
  (`src/lib/goalPath.ts`, auch Untertitel der Gewichts-Kachel), Körpermaße `body_measurements` (`measurements.ts`).
- **Mahlzeiten & Kochen:** „Als Mahlzeit speichern“ (`saved_meals`, Chips im Hinzufügen-Sheet, ein Tipp trägt alles
  ein), Nachkochen-Modus (`CookMode.tsx`: Portionen, Zutaten mit „Fehlt mir“, Schritte mit Timer, Eintragen;
  „Fehlt mir“-Liste nur auf dem Gerät), Supplement-Vorrat mit Reichweite (`supplementStock.ts`).
- **Intro erweitert:** Ort (Mehrfachwahl) + Geräte zuhause, Zeit pro Training (Übungszahl), Schwerpunkt,
  Einschränkungen (höhere Wdh., Anfänger ohne schwere Langhantel), Alltag (Aktivitätsfaktor).
- **Erkenntnisse** (`/insights`, `src/lib/insights.ts`, Top 3 im Fortschritt): Belastungsverhältnis 7/28 Tage,
  VO₂max-Trend und Fitnessalter, Ruhepuls/HRV-Trend, Schlafschuld und Schlafrhythmus, WHO-Intensitätsminuten,
  Schritte-Trend, echter Verbrauch aus Essen + Gewichtsverlauf (`adaptiveTdee`, auch ohne Uhr). Health Connect
  liest zusätzlich Wasser, Ernährung, Achtsamkeit und Krafteinheiten anderer Apps; Waagen-Gewichte nur an Tagen
  ohne eigenen Eintrag (`source: 'health'`), Wasser nur nach oben angeglichen. Play Console: Health-Apps-Erklärung
  um `READ_HYDRATION`, `READ_NUTRITION`, `READ_MINDFULNESS` ergänzen.
- **Gewichts-Vorschlag** (`progressionSuggestion` in `analytics.ts`, Double Progression): Stillstand im Wdh.-Bereich
  = Gewicht halten (Plateau-Hinweis erst nach 4 Trainings/4 Wochen, kein Zurücksetzen). Runter (−10 %) nur bei echtem
  Rücksetzer: Leistung sinkt zweimal in Folge, insgesamt ≥ 4 %. **Vorermüdung** (`src/lib/fatigue.ts`): harte Sätze
  für denselben Muskel davor (Hauptmuskel 1, Hilfsmuskel 0,5) → Schätzfaktor −1,5 %/Satz, max. −15 %. Leistung im
  Verlauf wird damit bereinigt; ist man heute deutlich vorbelasteter als letztes Mal, startet der Vorschlag
  niedriger. Übungs-Verlauf markiert solche Tage mit „vorbelastet“.
- **Übung bearbeiten** (`ExerciseForm.tsx`): Abschnitte Übung (Muskel-Chips, Hilfsmuskeln eingeklappt), Ziel-Wdh.
  (Kraft/Aufbau/Ausdauer/Eigene), Gewicht verstellen (Freie Gewichte: Schritt 1/2,5/5 kg; Maschine: leichteste/Abstand/
  schwerste mit Live-Vorschau, unregelmäßige Stufen als Liste), Einseitig + Geräte-Notiz. Neue Übung ohne Verlauf
  startet mit leerem Gewicht (kein pauschales 20 kg). Fasten-Einstellungen nur bei Intervallfasten sichtbar.
- **Übungs-Bibliothek** (`public/exercise-library.json`, Version 3): 848 Übungen (683 + 165 neue `X_…`), je mit
  präziser Ausführung (`steps_de`), „Darauf achten“ (`cues_de`) und häufigen Fehlern (`mistakes_de`, Anzeige `Cues` in
  `ExerciseHowTo.tsx`). Animationen (`src/lib/figure/`) decken 99 % ab (114 Figuren). Rezepte: 166 in `recipeCatalog.ts`.
- **Erinnerungstexte** gemeinsam für App und Web-Push in `api/_reminderCopy.js` (+ `.d.ts`): echte Zahlen, kleine
  nächste Schritte, kein schlechtes Gewissen, keine bestimmten Lebensmittel, täglich wechselnde Varianten.
- **Maschinen-Gewichte:** `weight_steps` = „Grundstufen | Zusatzgewichte“ (z. B. „5 10 15 | 2.5 5 7.5“), je ein
  Zusatzgewicht pro Stufe (`withAddons`); einzelne Stufen im Formular antippbar (Rest verschiebt sich mit).
- **Tagesform** (`ReadinessFactors.tsx`): Faktoren als Balken (hebt/senkt) mit Bereichs-Balken; Wochenleiste
  `ui/WeekPicker.tsx` (gemeinsam mit Ernährung).
- **Satz-Schema** (`src/lib/setScheme.ts`, `prefs.setScheme`): bekannte Übungen starten mit der Struktur vom
  letzten Mal (Anzahl Arbeitssätze, Drop, Aufwärmen), neue nach eigenem Schema (Standard 3 Sätze, Aufwärmen
  automatisch = erste Übung je Muskel, kein Drop). Einstellbar unter Profil → Einstellungen. Die KI prüft den
  Aufwärmsatz nur bei „Auto“ und wenn bei der Übung sonst aufgewärmt wird.
- **Vitamine & Mineralstoffe** (`src/lib/micros.ts`, Karte `MicroCard`): KI schätzt je Lebensmittel Vitamin C, D,
  B12, Folat, Eisen, Calcium, Magnesium, Zink, Kalium (`food_entries.micros` jsonb, Migration 0045); Barcode-Produkte
  nehmen OFF-Angaben. Tagessumme gegen DGE-Referenz (Frauen eigene Werte), Hinweis „Noch wenig: …“ (ohne Vitamin D).
  Fehlt die Spalte, wird ohne Vitamine gespeichert.
- **Zuletzt gegessen** (`src/lib/recentFoods.ts`, `RecentFoods.tsx`): passend zur Mahlzeit gerankt (Häufigkeit,
  Aktualität, heute schon Gegessenes ganz oben), „+“ trägt sofort mit derselben Menge ein (Menü bleibt offen, mehrere
  nacheinander), Zeile antippen = Menge anpassen. Im Hinzufügen-Menü oben, in der Suche und optional auf der
  Ernährungsseite. Leere Mahlzeiten-Karte zeigt „Wie gestern“ (ganze Mahlzeit vom letzten Mal, max. 7 Tage zurück).
- **Spracheingabe in der App** über die System-Spracherkennung (`SpeechPlugin.kt`, `MicButton`); im Browser weiter
  die Web-Spracherkennung.
- **Teilen-Bilder** nach dem Training (`ShareSheet`, Inhalte `src/lib/shareCard.ts`, Zeichnen `shareRender.ts`):
  „Buddy-Karte“ (durchsichtiger Sticker, Buddy ragt aus der Karte, große Zahl im Hintergrund, goldenes Siegel für
  Serie/Rekord, App-Farbe), „Clean“ (nur weiße Schrift + Buddy-Silhouette, durchsichtig, zum Drüberlegen) und
  „Story“ (Karte auf 1080×1920). In der App zusätzlich „Speichern“ in die Galerie (`AppWidgets.saveImage`,
  Bilder/Fitness, ab Android 10). Offen: Level-up/Rückblick auf denselben Look umstellen, Widgets im neuen Stil.
- **Navigation wie bei iOS:** globale Suche (Lupe oben in jedem Tab, `components/search/SearchSheet.tsx`,
  Einträge + Stichwörter in `src/lib/searchIndex.ts`, Module beachten). Profil gruppiert: Ich ·
  Personalisieren · Buddy · Mitteilungen & Geräte · Konto & Daten. Deep Links für die Suche:
  `/nutrition?add=photo|search|restaurant|…`, `/today?edit=1`, `/profile?s=appearance|goal|…`.
- **Buddy begleitet überall:** einheitlich in allen Tabs: Buddy lugt über die große dunkle Karte
  (Hero), sein Spruch steht oben in der Karte (`BuddyLine`, antippbar → Aktion bzw. „Frag Buddy“), Inhalt aus
  `useHeroBuddy(page)` + `buddyTips.ts`. Gemeinsames `Hero` (`health/ui.tsx`) hat dafür `buddy`. Keine separaten
  Buddy-Karten mehr. „Heute“: `TodayHero` mit Tagesbriefing (Antippen), Kennzahlen und Essen-Schnelleintrag
  (Foto/Sagen/Scannen/Suchen + „Nochmal“ mit einem Tipp)
  mit regelbasiertem Tipp aus `src/lib/buddyTips.ts` (getestet), „Frag Buddy“ öffnet den Chat mit passender
  Frage (`openBuddySheet(frage)`), auf Heute zusätzlich KI-„Tagesbriefing“ (`dailyBriefing` in `ai.ts`, 1×/Tag).
- **Dunkelmodus:** Standard = neutrales Fast-Schwarz (`.dark` in `index.css`), wählbar „Mitternacht“ (früheres
  Blaugrau, Klasse `.dark.midnight`) unter Profil → Aussehen (`theme_dark_style`, nur auf dem Gerät).
- **Farben:** `success` = App-Farbe (erledigt, Fortschritt, Schalter). Nur echte Bewertungen („gut“) nutzen
  das neue Token `good` (grün). Rot nur für Fehler/Löschen, `gold` für Hinweise.
- **Tiefe Auswertung** (alles, was Health Connect liefert, `HealthBridgePlugin.kt`): Aktivität im Detail
  `/cardio/:id` (Puls-Verlauf mit Zonen, Zeit in Zonen, Pace, Höhenprofil, Kilometer-Zeiten, Belastung/TRIMP,
  Erholungszeit), jede Nacht mit Schlafphasen-Verlauf, Score und Körperwerten (Puls, HRV, SpO₂, Atmung,
  Hauttemperatur), `/vitals` mit Puls heute, Ruhepuls/HRV mit persönlichem Normalbereich, VO₂max, Aktivität,
  Gewicht/Körperfett/Blutdruck/Blutzucker. Tagesform-Faktoren in Klartext (Wert, Vergleich, Gut/Normal/Achtung).
- **Smartwatch** (nur mit `hasWatch` sichtbar): Ausdauer-Seite `/cardio`, Schlaf & Erholung `/sleep`,
  Tagesform aus Schlaf, HRV, Ruhepuls, Belastung **und Ernährung** (`src/lib/health.ts`, getestet).
  Daten in `health_activities`, `health_sleep`, `health_daily` (Migration 0037), befüllt von der Android-App.
- **Android-App** (`android/`, Capacitor 8, Paket `de.fitnessbuddy.app`):
  - `HealthBridgePlugin.kt` – Health Connect lesen (Aktivitäten mit Strecke, Schlafphasen, Schritte,
    Ruhepuls, HRV, VO2max); Abgleich beim Start und bei Rückkehr in die App (`useHealthSync`)
  - 11 Homescreen-Widgets (`widgets/`, Zeichnen in `WidgetArt.kt`, Basis in `WidgetKit.kt`, Liste in
    `WidgetStore.ALL`): Buddy (Bild + Sprechblase + Level), Ernährung heute, Wasser (1×1/2×1, +250 ml bucht ohne
    App-Öffnen), Kalorien, Training, Tagesform, Schritte, Schlaf, Fasten (Live-Countdown), Quests, Supplemente.
    Alle in der gewählten App-Farbe (`accent`/`accentLight`/`onAccent` im Snapshot) und hell/dunkel; ohne Modul
    bzw. Uhr zeigen sie einen Hinweis. Den Buddy rendert `NativeSync` als PNG (`setBuddyImage`).
  - Einzel-Widgets mit einer Aufgabe (`widgets/ActionWidgets.kt`): „Essen eintragen“ (Foto/Sagen/Scannen/Suchen →
    `/nutrition?add=…`), „Training starten“ (→ `/`), „Gewicht eintragen“ (→ `/body?weigh=1`, Eingabefeld fokussiert).
    Snapshot liefert dafür `weightKg`, `aiAvailable`, `trainedToday`.
  - `LiveActivityPlugin.kt` – laufende Benachrichtigung mit Countdown auf dem Sperrbildschirm
    (Satzpause automatisch, Fasten optional unter Bereiche); Android 16 hebt sie als Live-Update hervor
  - „Pause vorbei“-Benachrichtigung, Deep Links `fitnessbuddy://open/<pfad>`, Zurück-Taste
  - Kein Service Worker in der App (`BUILD_TARGET=android`), API-Aufrufe absolut an Vercel (`src/lib/native.ts`,
    CORS in `api/_cors.js`)
- **Build:** GitHub Action `.github/workflows/android.yml` baut bei jedem Push eine Debug-APK
  (Actions → Lauf → Artifacts). Mit den Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` zusätzlich ein signiertes AAB für den Play Store.
  Lokal: `npm run build:android`, dann `cd android && ./gradlew assembleDebug` (oder in Android Studio öffnen).

**Noch offen für die App:**
- Sperrbildschirm-*Widgets* gibt es auf normalen Android-Handys nicht mehr (nur Tablets/einzelne Hersteller) –
  auf dem Sperrbildschirm arbeiten wir mit Live-Benachrichtigungen. Widgets sind trotzdem als `keyguard` markiert.
- Push-Erinnerungen in der App brauchen **Firebase (FCM)**: `google-services.json` in `android/app/` legen
  (nicht geheim, aber projektbezogen) und den Cron auf FCM umstellen (Phase 3). Bis dahin kommen in der App nur
  lokale Benachrichtigungen (Pause, Countdown).
- Datenschutzerklärung: TODO-Stellen in `src/pages/Privacy.tsx` (`/datenschutz`) ausfüllen bzw. prüfen lassen.
- Teilen-Menü (Rezept-Links) in der App: braucht ein Plugin für eingehende `SEND`-Intents.
- Paketname `de.fitnessbuddy.app` vor dem ersten Play-Upload final festlegen (danach unveränderbar).
- Eigenes GPS-Tracking (Lauf/Rad ohne Uhr) und Wear-OS-Kachel: später.

---

## 1c. Buddy Plus – kostenlos vs. Plus (vorbereitet, noch ohne Abrechnung)

**Kostenlos:** alles ohne KI – Lebensmittel-Suche, Barcode, manuell, Rezept-Katalog, Ketten-Speisekarten,
Training, Pläne, Statistiken, Uhr-Daten, Community, Widgets, Erinnerungen, Körperfoto mit eigenem Wert.
**Buddy Plus (Abo):** alles, was über `src/lib/ai.ts` läuft – Foto-Analyse, Essen beschreiben, Tagesplan/Ideen,
Restaurant-Schätzung und Speisekarten-Foto, Kühlschrank-/KI-Rezept, Rezept-Import (Link/Screenshot), Essensplan
(erstellen, anpassen, Rezepte, Routinen schätzen), KI-Trainingsplan, Übung beschreiben/Geräte importieren,
Muskeln vorschlagen, Übungs-Abgleich per KI, beste Alternative, KI-Aufwärm-Check, Körperfett per Foto,
Buddy-Chat, KI-Tagesbriefing, KI-Wochenfazit, KI-Spruch, KI-Cheat-Erkennung.

- **Status:** `src/lib/premium.ts` (getestet) + `usePremium()` in `src/hooks/usePremium.ts`. Bis zum Start sind
  alle Plus. Test-Schalter: Profil → Konto & Daten → „Kostenlose Version testen“ (localStorage `plus_test_free`).
- **Sperre:** `useAiGate()` → `{ enabled, canUse, locked, requirePlus(), guard }`. KI-Funktionen bleiben
  sichtbar (mit `PlusBadge`), Tippen öffnet das Sheet `components/premium/PlusSheet.tsx` (`openPlusSheet()`,
  Event `open-plus`, auch über die Suche „Buddy Plus“). Hintergrund-KI (Aufwärmen, Übungs-Abgleich, Cheat)
  läuft ohne Plus einfach nicht bzw. regelbasiert.
- **Feste Texte statt KI:** `src/lib/freeTexts.ts` (getestet) – `dailyBriefingText`, `weeklyReviewText`,
  `mealVerdictText`, `hypeLineText`, `cheatJudgeText`, `buddyFreeNote`. Sie dienen auch als Ersatz, wenn die KI
  nicht erreichbar ist (z. B. Wochenfazit). Ein festes Wochenfazit (`free: true`) wird mit Plus einmal durch das
  KI-Fazit ersetzt.
- **Abrechnung anschließen:** nur `setBillingEntitlement(active)` in `src/lib/premium.ts` aufrufen – z. B. nach
  dem App-Start und im RevenueCat-`addCustomerInfoUpdateListener` mit dem Entitlement „plus“ (`null` = keine
  Abrechnung, alle Plus). Danach im Plus-Sheet „Plus freischalten“ auf den Kauf umstellen. Der Server sollte das
  Abo zusätzlich prüfen (Phase 4, Tabelle `entitlements`), sonst ist die Sperre nur clientseitig.

---

## 2. Entscheidungen

- **Nur Android zuerst.** Die Web-Version bleibt intern zum Testen und wird nicht offiziell angeboten.
- **Kostenarm bleiben:**
  - Supabase Free-Tarif
  - Vercel fällt weg, die Serverfunktionen ziehen in **Supabase Edge Functions** um
- **Monetarisierung:**
  - **Keine kostenlose KI.** KI gibt es nur so:
    - Werbevideo ansehen (Rewarded Ad): 1 Video = 1 KI-Aktion
    - Testphase (z. B. 7 Tage Pro)
    - Pro-Abo
  - **Pro** = KI unbegrenzt (innerhalb des Fair-Use-Limits) und keine Werbung.
  - Keine Banner-Werbung.
  - Rechnung grob: Ein Rewarded-Video bringt in DE etwa 0,5–1,5 ct. Eine Gemini-Flash-Analyse kostet etwa
    0,05–0,3 ct. Damit verdient man pro Video, auch im Gratis-Plan. Die Zahlen sind Schätzungen; nach dem
    Start mit echten AdMob-Daten prüfen.
- **Gemini nur in der bezahlten Stufe.** In der Gratis-Stufe darf Google die Daten zum Training nutzen,
  bei Gesundheitsdaten geht das nicht.

---

## 3. Lokal einrichten (neue Session auf dem eigenen Rechner)

Warum lokal: Für den Android-Build braucht man Android SDK, Gradle, Emulator oder echtes Handy. Widgets,
Sperrbildschirm und Benachrichtigungen lassen sich nur auf dem Gerät testen. Der Signing-Key bleibt
lokal bzw. in GitHub-Secrets.

1. Installieren:
   - Node 20+
   - Git
   - Android Studio (mit SDK, Platform-Tools, Emulator)
   - JDK 21 (bringt Android Studio mit)
   - Claude Code
2. Repo klonen, `npm ci`, `.env` aus `.env.example` anlegen (nur die öffentlichen `VITE_SUPABASE_*`-Werte).
3. Handy: Entwickleroptionen und USB-Debugging an, dann `adb devices` prüfen.
4. Neue Claude-Code-Session im Repo starten. Erste Nachricht z. B.:
   „Lies docs/UEBERGABE.md und fang mit Phase 1 an.“

---

## 4. Fahrplan

### Phase 1 – Backend zu Supabase Edge Functions (Vercel ablösen)

1. Jede Funktion aus `api/` als Edge Function (Deno) nachbauen. Die Logik in `api/_*.js` ist absichtlich
   ohne Node-Spezifika, sodass sie übernommen werden kann:

   | Vercel heute | Edge Function |
   | --- | --- |
   | `api/ai.js`, `_aiguard.js` | `ai` |
   | `api/season.js`, `_season.js` | `season` |
   | `api/recipe-import.js` | `recipe-import` |
   | `api/cron/reminders.js`, `_notify.js` | `reminders` |
   | `api/push/test.js`, `api/push/cheat.js` | `push-test`, `push-cheat` |
   | `api/fitbit/*` | `fitbit-*` (oder streichen, Health Connect ersetzt es) |

2. Secrets mit `supabase secrets set …` setzen (nicht ins Git).
3. Im Client die Aufrufe von `/api/...` auf `supabase.functions.invoke(...)` umstellen (eine zentrale
   Stelle, z. B. `src/lib/api.ts`).
4. pg_cron (Migration 0032) auf die Edge-Function-URL umstellen.
5. **KI weiter absichern:**
   - Prompts aus `src/lib/ai.ts` auf den Server verschieben
   - der Client schickt nur noch `feature` und die Daten, keinen freien Prompt mehr
   - der Buddy-Chat bekommt Längenlimits für Nachricht und Verlauf
6. Danach das Vercel-Projekt stilllegen.

### Phase 2 – Capacitor-Hülle

1. Installieren: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, dann
   `npx cap init` und `npx cap add android`.
2. Den **Build mitliefern** (kein Laden einer Web-URL), damit die App offline startet und den Play-Regeln
   entspricht. Updates später optional per Live-Update.
3. Service Worker bzw. PWA-Update-Banner in der App-Hülle abschalten.
4. Plugins:
   - Kamera: `@capacitor/camera` statt `<input type=file capture>`
   - `@capacitor/haptics`
   - `@capacitor/status-bar`
   - `@capacitor/splash-screen`
   - `@capacitor/app`, für den Zurück-Button: Sheets schließen statt App beenden
   - `@capacitor/preferences`
5. Auth: Supabase-Session in Preferences speichern. E-Mail-Bestätigung über Deep Link (App Links) in die
   App zurückführen.

### Phase 3 – Native Android-Funktionen

- **Push über FCM** statt Web-Push:
  - `@capacitor/push-notifications`
  - Tabelle `push_subscriptions` um `fcm_token` erweitern
  - Reminders-Function sendet über die FCM-HTTP-v1-API
  - Aktionen wie „+250 ml“ oder „✓ Genommen“ als Notification-Actions, die die App per Deep Link öffnen
    oder still im Hintergrund buchen
- **Homescreen-Widgets** (Kotlin, Jetpack Glance):
  1. Kalorien-/Eiweiß-Ring mit „noch offen“
  2. Wasser mit Knopf „+250 ml“, der direkt bucht
  3. Training: nächster Plan und Serie
  4. Supplemente: heute offen, abhaken

  Datenweg: Die App schreibt nach jeder Änderung eine kleine Zusammenfassung über ein eigenes
  Capacitor-Plugin in SharedPreferences und stößt ein Widget-Update an. Klicks im Widget gehen per
  Deep Link oder `BroadcastReceiver` mit direktem Supabase-Aufruf.
- **Sperrbildschirm / laufende Benachrichtigungen:**
  - Pausentimer im Training und Fasten-Countdown als laufende Benachrichtigung mit Countdown
    (`setUsesChronometer` + `setChronometerCountDown`)
  - kein Foreground-Service nötig, solange nur der Timer angezeigt wird
  - Sichtbarkeit auf dem Sperrbildschirm: `VISIBILITY_PUBLIC`
- **Health Connect:** Schritte, Gewicht, Training und Kalorien lesen/schreiben. Das braucht die
  Erklärung im Play-Formular „Health apps“.
- Benachrichtigungs-Berechtigung (Android 13+) erst im passenden Moment abfragen, nicht beim ersten Start.

### Phase 4 – Monetarisierung

1. Tabelle `entitlements`, nur vom Server beschreibbar: `user_id`, `pro_until`, `trial_used`, `ai_credits`.
2. Die KI-Function prüft vor jedem Aufruf: Pro aktiv, dann frei (Fair-Use-Limit bleibt). Sonst wird ein
   `ai_credit` verbraucht. Ohne Credit gibt sie den Hinweis „Video ansehen oder Pro“ zurück.
3. **AdMob Rewarded** mit **Server-Side-Verification (SSV)**:
   - AdMob ruft eine Edge Function auf, die den Credit gutschreibt
   - der Client allein kann sich keine Credits geben
   - EU-Einwilligung über Google UMP (Consent-Dialog)
4. **RevenueCat** (Play Billing) für das Pro-Abo mit Testphase. Der RevenueCat-Webhook ruft eine Edge
   Function auf, die `pro_until` setzt.
5. UI (Grundlage steht, siehe 1b „Buddy Plus“):
   - einheitliches „KI freischalten“-Sheet (`PlusSheet.tsx`) um „Video ansehen“ und „Plus testen“ erweitern
   - Paywall-Seite
   - Pro-Badge im Profil
   - Werbung nie mitten im Training

### Phase 5 – Missbrauchsschutz

- Supabase Auth: E-Mail-Bestätigung an, Captcha an (hCaptcha oder Turnstile), Passwortregeln.
- **Play Integrity API:** Das Token wird in der KI-Function geprüft. Nur echte App-Installationen bekommen KI.
- Fair-Use-Limits beibehalten (`ai_calls`). Für Pro gilt ein höheres Tageslimit.

### Phase 6 – Store-Voraussetzungen

- **Konto löschen** ✅ in der App (Profil → Konto & Daten). Für das Play-Formular als Web-URL `<vercel>/datenschutz`
  angeben; dort den Kontakt-Abschnitt noch ausfüllen.
- **Rechtliches:**
  - Impressum, Datenschutzerklärung (Gesundheitsdaten nach Art. 9 DSGVO, ausdrückliche Einwilligung),
    AGB/Abo-Bedingungen
  - keine Heilversprechen, KI-Hinweis
- **Play Console** (einmalig 25 $):
  - Datensicherheits-Formular, Health-Apps-Erklärung, Altersfreigabe, Werbe-Kennzeichnung
  - Für neue private Konten Pflicht: **geschlossener Test mit mindestens 12 Testern über 14 Tage** vor der
    Produktion
- **Build:**
  - GitHub Action baut das signierte AAB
  - Keystore als Base64 plus Passwörter in GitHub-Secrets
  - Keystore zusätzlich sicher offline aufbewahren, sonst sind keine Updates mehr möglich (Play App
    Signing nutzen)
- **Backup:** wöchentliche GitHub Action mit `pg_dump` (der Free-Tarif hat keine Backups). Datenbank-URL als
  Secret, Dump verschlüsselt ablegen.
- **Speicher sparen:** Körperfotos stärker komprimieren (Ziel ~150 KB).

---

## 5. Offene Ideen (nicht Android-gebunden, optional)

Aus [`ideen-backlog.md`](ideen-backlog.md), noch nicht gebaut:

- Ghost-Modus
- Ziel-ETA
- „Heute vor einem Jahr“
- Gerät scannen
- Kochmodus
- Live-Training mit Freund
- Boxenfunk
- Übungs-Sammelalbum
- Kronen pro Übung
- Stärke-Elo
- Zwiebelhaut-Foto
- Gym-Moment
- Sprach-Logging im Satz
- Satz-Gefühl
- Pläne per Link/QR teilen
- Kalorien-Kontoauszug
- Überraschungs-Belohnung
- Technik-Häppchen

Kleinere offene Punkte:

- Push an den Gegner, wenn eine Einsatz-Challenge erstellt wird.
- Ketten-Speisekarten (`src/lib/fastfoodMenus.json`) vervollständigen bzw. regelmäßig aktualisieren.

---

## 6. Tests & Werkzeuge

- `npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run` (ca. 400 Tests), `npm run build`.
- UI-Prüfung mit Playwright gegen `npx vite preview --port 4190`. Supabase und `/api/ai` werden im
  Skript gemockt (`page.route`), Login über einen Fake-Token in `localStorage`
  (`sb-<projekt>-auth-token`).
- Android: `npx cap sync android`, `npx cap run android` (Gerät/Emulator), Logs mit `adb logcat`.
