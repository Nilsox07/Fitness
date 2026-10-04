import type { ReactNode } from 'react'
import { Buddy } from '../buddy/Buddy'
import type { BuddyMood } from '../../lib/buddyMood'

/** Tagline der App (noch ohne App-Namen). */
export const APP_TAGLINE = 'Training & Ernährung – mit deinem Buddy'

/**
 * Vollbild-Willkommen für Anmeldung/Passwort: großer Buddy auf sanftem
 * Brand-Schimmer, darunter Überschrift und Inhalt. Gilt für alle Nutzer
 * (noch nicht eingeloggt → kein Modus bekannt).
 */
export function AuthShell({
  mood = 'happy',
  title,
  subtitle,
  children,
}: {
  mood?: BuddyMood
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden bg-bg">
      {/* sanfter Brand-Schimmer */}
      <div className="pointer-events-none absolute left-1/2 top-[8%] h-72 w-72 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="mb-7 flex flex-col items-center text-center" style={{ animation: 'fade-in .35s ease-out both' }}>
          <Buddy size={120} mood={mood} stage={2} title="Buddy" />
          <h1 className="mt-3 max-w-[18rem] text-2xl font-bold leading-tight tracking-tight text-cocoa">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-[20rem] text-sm text-cocoa-light">{subtitle}</p>}
        </div>
        <div style={{ animation: 'fade-in .35s ease-out both', animationDelay: '80ms' }}>{children}</div>
      </div>
    </div>
  )
}

/** Hinweis-Box (Fehler dezent rot, Info grün). */
export function AuthNote({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`anim-fade rounded-xl px-3 py-2.5 text-sm ${
        kind === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-success/10 text-success'
      }`}
    >
      {children}
    </p>
  )
}
