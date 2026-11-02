import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Hero } from '../components/health/ui'
import { SectionLabel } from '../components/progress/ProgressHeader'

// Datenschutzerklärung (/datenschutz) – auch ohne Anmeldung erreichbar (Play Store,
// Health Connect verlinkt hierher: PrivacyActivity.kt).
// TODO(Inhaber): Alle mit „TODO“ markierten Stellen vor dem Store-Start ausfüllen
// bzw. rechtlich prüfen lassen.

const STAND = 'November 2026'

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: 'Verantwortlicher',
    body: <Todo>Name, Anschrift, E-Mail des Verantwortlichen (Art. 13 Abs. 1 lit. a DSGVO).</Todo>,
  },
  {
    title: 'Zwecke',
    body: (
      <>
        <p>
          Wir verarbeiten deine Daten, um dir Training, Ernährung, Fortschritt und – wenn du sie nutzt – Community- und
          Uhr-Funktionen anzubieten.
        </p>
        <Todo>Rechtsgrundlagen je Zweck ergänzen (Art. 6 Abs. 1 lit. b, a DSGVO).</Todo>
      </>
    ),
  },
  {
    title: 'Gesundheitsdaten (Art. 9 DSGVO)',
    body: (
      <>
        <p>
          Gewicht, Körperfett, Körperfotos, Training, Ernährung, Schlaf, Puls und Zyklus sind Gesundheitsdaten. Wir
          verarbeiten sie nur mit deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die du bei der
          Registrierung gibst.
        </p>
        <p>Du kannst sie jederzeit widerrufen: Profil → Hilfe &amp; Datenschutz → „Einwilligung widerrufen“.</p>
        <Todo>Speicherort (Supabase, Region) und Auftragsverarbeiter nennen.</Todo>
      </>
    ),
  },
  {
    title: 'Health Connect',
    body: (
      <>
        <p>
          Mit deiner Erlaubnis liest die App Daten aus Health Connect (z. B. Aktivitäten, Schritte, Schlaf, Puls, HRV,
          Gewicht, Zyklus). Sie werden nur für die Anzeige in der App genutzt, nicht für Werbung und nicht verkauft.
        </p>
        <Todo>Liste der gelesenen Datentypen mit der Play-Erklärung „Health apps“ abgleichen.</Todo>
      </>
    ),
  },
  {
    title: 'KI-Verarbeitung (Gemini)',
    body: (
      <>
        <p>
          KI-Funktionen (Buddy Plus) schicken die dafür nötigen Angaben, z. B. ein Essensfoto oder eine Frage, an Google
          Gemini in der kostenpflichtigen Stufe. Google nutzt diese Daten dort nicht zum Training.
        </p>
        <Todo>Anbieter, Serverstandort, Drittlandübermittlung und Speicherdauer bei Google ergänzen.</Todo>
      </>
    ),
  },
  {
    title: 'Nutzungs-Statistik & Feedback',
    body: (
      <>
        <p>
          Mit deiner Einwilligung zählen wir pseudonym, welche Funktionen genutzt werden (ohne Gesundheitswerte).
          Feedback, das du schickst, speichern wir mit App-Version und Gerätetyp.
        </p>
        <Todo>Speicherdauer der Statistik (aktuell bis 13 Monate) bestätigen.</Todo>
      </>
    ),
  },
  {
    title: 'Speicherdauer',
    body: (
      <>
        <p>Deine Daten bleiben gespeichert, bis du sie oder dein Konto löschst.</p>
        <Todo>Fristen für Backups und Server-Logs ergänzen.</Todo>
      </>
    ),
  },
  {
    title: 'Deine Rechte',
    body: (
      <>
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf deiner
          Einwilligung. Konto und alle Daten löschst du selbst unter Profil → Konto & Daten → „Konto & Daten löschen“.
          Export: Profil → „Daten exportieren“.
        </p>
        <Todo>Zuständige Aufsichtsbehörde nennen.</Todo>
      </>
    ),
  },
  {
    title: 'Kontakt',
    body: <Todo>E-Mail-Adresse für Datenschutz-Anfragen und Löschung ohne App.</Todo>,
  },
]

function Todo({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-gold/10 px-3 py-2 text-xs text-cocoa">TODO: {children}</p>
}

/** Inhalt der Datenschutzerklärung (auch in der Einwilligungs-Abfrage). */
export function PrivacyContent() {
  return (
    <div className="space-y-5">
      <Hero overline="Datenschutz">
        <p className="mt-1 text-2xl font-bold leading-tight tracking-tight">Deine Daten gehören dir</p>
        <p className="mt-1 text-sm text-bg/70 dark:text-cocoa-light">Stand: {STAND}</p>
      </Hero>
      {SECTIONS.map((s) => (
        <section key={s.title}>
          <SectionLabel>{s.title}</SectionLabel>
          <div className="space-y-2 rounded-2xl bg-cream p-4 text-sm leading-relaxed text-cocoa">{s.body}</div>
        </section>
      ))}
    </div>
  )
}

/** Seite /datenschutz; `standalone` = ohne Anmeldung (eigener Rahmen mit Zurück). */
export default function Privacy({ standalone = false }: { standalone?: boolean }) {
  const navigate = useNavigate()
  if (!standalone) return <PrivacyContent />
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md space-y-4 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="flex items-center gap-1 text-sm font-semibold text-brand"
        >
          <ChevronLeft size={18} /> Zurück
        </button>
        <PrivacyContent />
      </div>
    </div>
  )
}
