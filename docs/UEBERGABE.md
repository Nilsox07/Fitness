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

`0001`–`0035` sind ausgeführt. **`0036_ai_calls.sql` (KI-Limits), `0037_health.sql` (Uhr-Daten) und
`0038_health_details.sql` (Verläufe, Schlafphasen, Vitalwerte) müssen noch im Supabase-SQL-Editor laufen.** Bis dahin zählt der Server keine KI-Aufrufe und die Uhr-Seiten bleiben
leer – Fehler gibt es keine.

### Umgebungsvariablen (Vercel, nie ins Git)

| Variable | Zweck |
| --- | --- |
| `GEMINI_API_KEY` | KI |
| `GEMINI_MODEL` | optional, kommagetrennt mit Ausweichmodellen |
| `AI_PROVIDER` | optional (`gemini`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web-Push |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron, Push, KI-Limits |
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
- **Fortschritt-Tab** mit einer Leiste: Kraft · Ausdauer · Schlaf · Herz & Körper · Ernährung · Erfolge
  (Uhr-Bereiche nur mit `hasWatch`).
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
  - Homescreen-Widgets (`widgets/`): „Ernährung heute“ mit +250-ml-Knopf (bucht ohne App-Öffnen, wird beim
    nächsten Start übernommen), „Training“ (nächstes Training, Serie), „Tagesform“ (Uhr)
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
- Datenschutzseite `/datenschutz` anlegen – Health Connect verlinkt darauf (`PrivacyActivity.kt`).
- Teilen-Menü (Rezept-Links) in der App: braucht ein Plugin für eingehende `SEND`-Intents.
- Paketname `de.fitnessbuddy.app` vor dem ersten Play-Upload final festlegen (danach unveränderbar).
- Eigenes GPS-Tracking (Lauf/Rad ohne Uhr) und Wear-OS-Kachel: später.

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
5. UI:
   - einheitliches „KI freischalten“-Sheet mit den Optionen „Video ansehen“ und „Pro testen“
   - Paywall-Seite
   - Pro-Badge im Profil
   - Werbung nie mitten im Training

### Phase 5 – Missbrauchsschutz

- Supabase Auth: E-Mail-Bestätigung an, Captcha an (hCaptcha oder Turnstile), Passwortregeln.
- **Play Integrity API:** Das Token wird in der KI-Function geprüft. Nur echte App-Installationen bekommen KI.
- Fair-Use-Limits beibehalten (`ai_calls`). Für Pro gilt ein höheres Tageslimit.

### Phase 6 – Store-Voraussetzungen

- **Konto löschen**, in der App und über eine Web-URL (Play-Pflicht): löscht Auth-User, alle Tabellen
  (`on delete cascade`) und die Storage-Dateien (Körperfotos).
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
  (`sb-<projekt>-auth-token`), Modus über `pref_app_mode = 'new'`.
- Android: `npx cap sync android`, `npx cap run android` (Gerät/Emulator), Logs mit `adb logcat`.
