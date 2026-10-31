# CLAUDE.md – Regeln für dieses Projekt

Deutsche Fitness- & Ernährungs-App (React 18 + TS + Vite-PWA, Tailwind, TanStack Query, Supabase).
Ziel: **Android-App im Play Store** (erst nur Android, keine offizielle Web-Version).
Ausführliche Übergabe und Plan: [`docs/UEBERGABE.md`](docs/UEBERGABE.md).

## Harte Regeln

- **Keine Secrets ins Git** (Gemini-Key, Supabase-Service-Role-Key, VAPID-Private-Key, CRON_SECRET,
  Android-Signing-Key/Passwörter). Die gehören nur in Vercel/Supabase-Secrets bzw. GitHub-Secrets / lokal.
  Nie den Nutzer bitten, Secrets in den Chat zu kopieren.
- Kein Modellname/Modell-ID in Commits, PRs oder Code-Kommentaren.
- Keine PRs, außer ausdrücklich gewünscht. Deploy = Arbeitsbranch per Fast-Forward nach `main` mergen und pushen.
- Bestehende Dateien nicht blind überschreiben (vorher lesen). Keine fremden Dateien umformatieren.
- Sprache in der App: Deutsch, du-Form, kurz und freundlich.
- **Design einheitlich:** Rubin (`brand`) ist die einzige Akzentfarbe, Abstufungen über Transparenz; `success` nur für
  „erledigt“ (folgt der App-Farbe), `good` (grün) nur für echte Bewertungen „gut“, `gold` für Hinweise. Keine weiteren Farben (kein Blau/Orange/Lila …). Seiten beginnen mit der dunklen
  Hero-Karte, Abschnitte mit `SectionLabel`, Listen gruppiert, Symbole neutral (`bg-sand`). Bausteine:
  `src/components/health/ui.tsx`.

## Arbeitsweise

- Umsetzen → testen → deployen. Nach jeder Änderung:
  - `npx tsc -p tsconfig.app.json --noEmit`
  - `npx vitest run`
  - `npm run build`
  - UI-Änderungen mit Playwright-Screenshots prüfen (390×844, hell + dunkel).
- Formatierung nur für neue/geänderte Dateien:
  `npx prettier --no-semi --single-quote --print-width 120 --write <dateien>`
- **SQL-Migrationen führt der Nutzer selbst** im Supabase-SQL-Editor aus: SQL im Chat in Teilen
  liefern, mit dem Hinweis, den Editor vorher zu leeren. Neue Migrationen fortlaufend nummerieren
  (`supabase/migrations/00NN_name.sql`).
- Reine Logik in `src/lib/*.ts` bzw. `api/_*.js` halten und mit Vitest testen.

## Architektur in Kürze

- Nutzer-Einstellungen geräteübergreifend in `profiles.prefs` (jsonb) über `useUserPrefs`;
  immer über `normalizePrefs` lesen (alte Caches ohne neue Felder haben schon mal die App abstürzen lassen).
- Übersichten: nur kurze Texte (eine Zeile); Erklärungen hinter `InfoTip` (erst beim Antippen).
- Neue Funktion = auch einen Eintrag in `src/lib/searchIndex.ts` (globale Suche) anlegen; Buddy-Tipps je Seite in
  `src/lib/buddyTips.ts`.
- Tabs: Heute `/today` (anpassbare Widgets), Training `/`, Ernährung `/nutrition`, Fortschritt `/progress` (Übersicht → Detailseiten `/analytics`, `/cardio`, `/sleep`
  nur mit Uhr), Community. Module (Ernährung/Community/Smartwatch) blenden alles Zugehörige aus – neue Features
  immer einem Modul zuordnen; Uhr-Funktionen nie ohne `hasWatch` zeigen.
- **Nicht jede Uhr liefert alle Werte** (HRV, Schlafphasen, SpO₂, Leistung …): jeden Wert optional behandeln,
  Fehlendes ausblenden statt „keine Daten“ zu zeigen. `capabilities()` in `src/lib/health.ts` sagt, was die Uhr
  liefert; Widgets deklarieren `needs`. Im Kotlin-Plugin darf ein fehlender Datentyp nie den ganzen Abgleich abbrechen.
- Android-App in `android/` (Capacitor): eigene Kotlin-Plugins `HealthBridge`, `AppWidgets`, `LiveActivity`;
  JS-Brücke `src/lib/native.ts` (im Browser No-ops). Build: `npm run build:android`, APK per GitHub Action.
- Serverfunktionen (noch Vercel) in `api/`: `ai.js` (KI-Vermittler mit Schutz aus `_aiguard.js`),
  `season.js`, `recipe-import.js`, `cron/reminders.js`, `push/*`, `fitbit/*`.
- KI-Prompts liegen clientseitig in `src/lib/ai.ts`; der Server hängt die Themen-Grenze an und begrenzt Nutzung.
