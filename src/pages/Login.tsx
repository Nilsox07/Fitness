import { useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { APP_TAGLINE, AuthNote, AuthShell } from '../components/ui/AuthShell'

type Mode = 'login' | 'signup'

const MODES: { id: Mode; label: string }[] = [
  { id: 'login', label: 'Anmelden' },
  { id: 'signup', label: 'Registrieren' },
]

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Account erstellt. Falls E-Mail-Bestätigung aktiv ist, prüfe dein Postfach.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Bitte zuerst deine E-Mail eingeben.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setInfo('E-Mail zum Zurücksetzen verschickt – prüfe dein Postfach (auch Spam).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  return (
    <AuthShell
      mood={error ? 'sad' : 'happy'}
      title={APP_TAGLINE}
      subtitle={mode === 'login' ? 'Schön, dass du da bist.' : 'Leg los — dein Buddy wartet schon.'}
    >
      {!isSupabaseConfigured && (
        <div className="mb-4 flex gap-2 rounded-2xl bg-cream p-4 text-sm text-cocoa">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
          <span>
            Supabase ist nicht konfiguriert. Lege eine <code>.env</code> nach Vorlage
            <code> .env.example</code> an (siehe README).
          </span>
        </div>
      )}

      {/* Anmelden | Registrieren */}
      <div className="mb-4 grid grid-cols-2 rounded-full bg-sand p-1" role="tablist" aria-label="Anmelden oder registrieren">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => switchMode(m.id)}
            className={`h-10 rounded-full text-sm font-semibold transition-all duration-200 ${
              mode === m.id ? 'bg-bg text-cocoa shadow-sm' : 'text-cocoa-light'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-cream p-5 shadow-sm">
        <div>
          <label className="label" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="du@beispiel.de"
            className="input rounded-2xl py-3.5 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Passwort
            </label>
            {mode === 'login' && (
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="mb-1 text-xs font-semibold text-brand disabled:opacity-50"
              >
                Passwort vergessen?
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            placeholder={mode === 'signup' ? 'Mindestens 6 Zeichen' : undefined}
            className="input rounded-2xl py-3.5 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <AuthNote kind="error">{error}</AuthNote>}
        {info && <AuthNote kind="info">{info}</AuthNote>}

        <button
          type="submit"
          className="btn-primary w-full gap-2 rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25"
          disabled={busy}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {mode === 'login' ? 'Anmelden' : 'Registrieren'}
        </button>
      </form>
    </AuthShell>
  )
}
