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
- Der **klassische Modus** (`pref_app_mode = 'classic'`) bleibt erhalten – nichts davon löschen.
- Bestehende Dateien nicht blind überschreiben (vorher lesen). Keine fremden Dateien umformatieren.
- Sprache in der App: Deutsch, du-Form, kurz und freundlich.

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

- Tabs: Ernährung `/nutrition`, Training `/`, Fortschritt `/analytics` `/history` `/badges` `/body`, Community `/social`.
- Nutzer-Einstellungen geräteübergreifend in `profiles.prefs` (jsonb) über `useUserPrefs`;
  immer über `normalizePrefs` lesen (alte Caches ohne neue Felder haben schon mal die App abstürzen lassen).
- Serverfunktionen (noch Vercel) in `api/`: `ai.js` (KI-Vermittler mit Schutz aus `_aiguard.js`),
  `season.js`, `recipe-import.js`, `cron/reminders.js`, `push/*`, `fitbit/*`.
- KI-Prompts liegen clientseitig in `src/lib/ai.ts`; der Server hängt die Themen-Grenze an und begrenzt Nutzung.
