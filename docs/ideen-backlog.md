# Ideen-Backlog

Gesammelte Ideen, die noch nicht gebaut sind. Erst Funktionen fertig machen, dann Store-Launch.

## USP-Features (aus anderen Branchen abgeschaut)

### Runde 1
| # | Feature | Vorbild | Idee | Aufwand |
|---|---------|---------|------|---------|
| 1 | Ghost-Modus | Rennspiele | Beim Satz läuft dein „Geist“ vom letzten Mal mit (Gewicht × Wdh.) – schlag ihn | klein |
| 2 | Ziel-ETA | Navi-Apps | „100 kg Bankdrücken voraussichtlich am 14. März“ aus dem Trend berechnet | klein |
| 3 | Gerät scannen | Shazam | Foto vom Gerät → KI erkennt es → passende Übungen + Figur | mittel |
| 4 | „Dein Jahr in Gains“ + „Heute vor einem Jahr“ | Spotify Wrapped / Apple Fotos | Jahresrückblick als Story; Erinnerung an alte Bestwerte | mittel / klein |
| 5 | Wochen-Kalorienbudget | Finanz-Apps | Kalorien als Wochenbudget statt starres Tagesziel, mit Ausgleich | mittel |
| 6 | Live-Training mit Freund | Lieferando-Live-Tracking | Sehen, dass der Kumpel gerade trainiert, welcher Satz, Anfeuern | mittel |
| 7 | Form-Wetter | Wetter-Apps | Tagesform-Vorhersage aus Schlaf, Pause, Volumen | klein |
| 8 | Kochmodus | Thermomix | Rezept Schritt für Schritt, große Schrift, Timer, Bildschirm bleibt an | mittel |

Empfehlung: zuerst Ghost + ETA + „Heute vor einem Jahr“, dann Scan, Wrapped zum Launch.

### Runde 2
| # | Feature | Vorbild | Idee | Aufwand |
|---|---------|---------|------|---------|
| 9 | Boxenfunk | Formel 1 | Buddy spricht im Satz/Pause wie ein Renningenieur: „Letzter Satz – 2 Wdh. mehr als letzte Woche, das ist PR“ | klein |
| 10 | Übungs-Sammelalbum | Panini / Pokémon | Jede animierte Übung wird beim ersten Mal als Karte freigeschaltet, mit Seltenheit und Stufen (Bronze → Gold über Bestwerte) | klein–mittel |
| 11 | Kronen pro Übung | Strava-Segmente | Wer im Freundeskreis den Bestwert hält, trägt die Krone – und bekommt eine Push, wenn sie geklaut wird | klein |
| 12 | Stärke-Elo | Schach / FIFA-Rating | Relative Stärke (z. B. DOTS) als eine Zahl – fairer Vergleich egal wie schwer man ist | klein |
| 13 | Fortschrittsfoto mit Zwiebelhaut | Stop-Motion-Apps | Altes Foto halbtransparent über der Kamera → gleiche Pose → automatischer Zeitraffer | mittel |
| 14 | Saisons | Fortnite / Battle Pass | Training in 6-Wochen-Saisons mit Thema, Saison-Belohnung und Rückblick; Deload als „Off-Season“ | mittel |
| 15 | Gym-Moment | BeReal | Einmal am Tag zufällige Push: 2 Minuten, Gym- oder Essensfoto an Freunde | mittel |
| 16 | Einkaufsliste aus dem Essensplan | HelloFresh | Wochenplan → Einkaufsliste nach Supermarkt-Bereichen sortiert | mittel |
| 17 | NFC-Sticker im Spind | Apple Kurzbefehle / Smart Home | Handy an den Sticker → Training startet sofort | erst native App |
| 18 | Pausentimer auf dem Sperrbildschirm | Uber Live Activities | Pause und nächster Satz auf dem Sperrbildschirm und der Dynamic Island | erst native App |

### Runde 3
| # | Feature | Vorbild | Idee | Aufwand |
|---|---------|---------|------|---------|
| 19 | Sprach-Logging | Siri / Alexa | Im Satz sagen: „80 Kilo, 8 Wiederholungen“ → wird eingetragen, Hände bleiben an der Hantel | mittel |
| 20 | Umleitung | Google Maps | Gerät besetzt → ein Tipp → gleichwertige Ersatzübung für dieselben Muskeln, Plan läuft weiter | klein |
| 21 | Satz-Gefühl | Uber-Bewertung | Nach jedem Satz ein Emoji-Tipp (leicht/okay/hart/Limit) → App schlägt nächstes Mal das Gewicht vor | klein |
| 22 | Pläne teilen per Link/QR | Spotify-Playlists | Plan als Link oder QR verschicken, Freund übernimmt ihn mit einem Tipp – wächst die App ganz nebenbei | klein–mittel |
| 23 | Kühlschrank-Koch | Too Good To Go / Resteküche | Foto vom Kühlschrank → KI schlägt ein Gericht vor, das zu den restlichen Makros des Tages passt | mittel |
| 24 | Kalorien-Kontoauszug | Banking-Apps | Monatsauswertung: „34 % deiner Kalorien kamen aus Snacks, 12 % aus Getränken“ | klein |
| 25 | Gym-Auslastung | Google Maps Stoßzeiten / Waze | Nutzer melden, wie voll ihr Studio ist → beste Trainingszeit | mittel, braucht viele Nutzer |
| 26 | Überraschungs-Belohnung | Überraschungsei | Nach dem Training manchmal ein zufälliges Extra (Buddy-Outfit, Sticker) – nie kaufbar | klein |
| 27 | Technik-Häppchen | Duolingo | 1-Minuten-Lektionen pro Übung mit kurzer Frage, passend zu den Figuren | mittel |

## Native App vor dem Store – Updates
- Capacitor-Hülle lädt die Web-App (Vercel-URL oder Live-Update-Plugin) → jedes Deploy kommt automatisch an, wie jetzt
- Neu installieren nur bei Änderungen an der Hülle selbst (neue native Plugins wie Health Connect)
- Android: Play Console (einmalig 25 $), interner Test-Track → nicht öffentlich, aber Auto-Updates über den Play Store; alternativ APK drüberinstallieren
- iOS: TestFlight braucht Apple-Entwicklerkonto (99 €/Jahr), Builds laufen nach 90 Tagen ab

## Server / Hosting für den Launch
- Supabase (PostgreSQL) bleibt – Branchenstandard, Open Source, später selbst hostbar (z. B. Hetzner) ohne App-Umbau. Kein Wechsel auf MySQL.
- Supabase-Projekt in EU-Region (Frankfurt), AVV/DPA abschließen, Pro-Plan (Free pausiert bei Inaktivität, keine Backups)
- Ein gemeinsames Projekt in einer Supabase-Organisation statt zwei Privatkonten
- Vercel Hobby ist nur nicht-kommerziell → beim Launch Vercel Pro oder Frontend zu Cloudflare Pages / Hetzner
- Gemini: bezahlte Stufe nutzen (Gratis-Stufe darf Daten zum Training verwenden – bei Gesundheitsdaten tabu)

## Im Hinterkopf (nicht jetzt)
- **Einsatz-Challenge** unter Freunden (statt Krypto-Token)
- **Store-Launch:**
  - Capacitor-App mit Health Connect/HealthKit, Onboarding
  - KI-Kostenlimits, Melden/Blockieren
  - Recht: DSGVO für Gesundheitsdaten, Impressum, Einwilligung, keine Heilversprechen, Konto löschen, Markencheck
  - Freemium/Pro-Idee
- Name + Logo (Markenrecht prüfen)
- Gymvisual-Lizenz als Option; Uhren-App ganz zum Schluss
