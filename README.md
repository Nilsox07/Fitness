# Fitness Tracker 🏋️

Eine installierbare **PWA**, um deine Gym-Performance zu tracken: Übungen
anlegen, im Gym schnell Sätze/Wdh./Gewicht erfassen und eine starke
**Auswertung** bekommen (Kraft-Fortschritt, Volumen, persönliche Rekorde,
Trainingshäufigkeit) – inklusive eines **Tipps, wann du das Gewicht steigern
solltest** (Double-Progression, basierend auf deinen letzten Trainings).

Daten liegen in **Supabase** (Postgres + Auth), sind also automatisch gesichert,
auf jedem Gerät verfügbar (kein Datenverlust beim Handywechsel) und pro Account
getrennt – du kannst die App also auch Freunden geben, jeder hat seine eigenen
Daten.

## Tech-Stack

React + TypeScript + Vite · Tailwind CSS · TanStack Query · Recharts ·
Supabase · vite-plugin-pwa · Vitest

## Setup

### 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt erstellen.
2. Im Dashboard unter **SQL Editor → New query** den Inhalt von
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   einfügen und ausführen. Das legt die Tabellen, Enums und die Row-Level-
   Security-Policies an.
3. Optional: gängige Übungen vorab anlegen mit
   [`supabase/seed.sql`](supabase/seed.sql) – darin `<DEINE_USER_ID>` durch deine
   User-ID ersetzen (Dashboard → **Authentication → Users**). Alternativ legst du
   Übungen direkt in der App an.
4. Optional fürs schnelle Testen: unter **Authentication → Providers → Email**
   die Bestätigungs-Mail deaktivieren („Confirm email" aus).

### 2. Zugangsdaten eintragen

```bash
cp .env.example .env
```

In `.env` die Werte aus **Project Settings → API** eintragen:

```
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-public-key
```

### 3. App starten

```bash
npm install
npm run dev
```

Die App läuft dann unter `http://localhost:5173`. Am Handy lässt sie sich über
den Browser („Zum Startbildschirm hinzufügen") als App installieren.

## Befehle

| Befehl           | Beschreibung                              |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Dev-Server starten                        |
| `npm run build`  | Typecheck + Produktions-Build             |
| `npm run preview`| Produktions-Build lokal testen            |
| `npm test`       | Tests der Auswertungs-Logik (Vitest)      |

## Benutzung

1. **Registrieren / Anmelden** mit E-Mail + Passwort.
2. **Übungen** anlegen (Muskelgruppe, Ziel-Wdh.-Bereich, kg-Schritt für den Tipp).
3. **Training** starten und Sätze schnell über die +/- Stepper erfassen. Beim
   Wählen einer Übung siehst du deine letzte Leistung und einen konkreten
   Gewichts-Tipp.
4. **Verlauf** zeigt alle vergangenen Trainings.
5. **Auswertung** zeigt Trainingshäufigkeit, Wochen-Volumen, Volumen je
   Muskelgruppe sowie Kraft-Fortschritt und persönliche Rekorde je Übung.

## Wie der Steigerungs-Tipp funktioniert

Prinzip der **Double Progression**: Schaffst du in deinem letzten Training alle
Arbeitssätze am oberen Ende des Ziel-Wdh.-Bereichs, wird das Gewicht um den bei
der Übung hinterlegten Schritt erhöht. Innerhalb des Bereichs lautet die
Empfehlung, das Gewicht zu halten und die Wdh. zu steigern. Stagnierst du über
mehrere Trainings beim selben Gewicht, wird ein Deload vorgeschlagen. Das
geschätzte 1RM wird per Epley-Formel berechnet (`Gewicht × (1 + Wdh/30)`).

## Spätere Erweiterungen

- Echtes Offline-First-Sync (Erfassung ohne Netz, Konfliktauflösung)
- Trainingspläne/Templates, Supersätze, RPE, Aufwärmsätze
- Teilen einzelner Auswertungen mit Freunden
