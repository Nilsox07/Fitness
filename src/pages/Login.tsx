import { useState, type FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
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

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-4xl">🏋️</div>
        <h1 className="mt-2 text-2xl font-bold">Fitness Tracker</h1>
        <p className="text-sm text-cocoa-light">Tracke deine Gym-Performance.</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="card mb-4 text-sm text-amber-600 dark:text-amber-400">
          ⚠️ Supabase ist nicht konfiguriert. Lege eine <code>.env</code> nach Vorlage
          <code> .env.example</code> an (siehe README).
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {info && <p className="text-sm text-brand">{info}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="w-full text-center text-sm text-cocoa-light underline"
          >
            Passwort vergessen?
          </button>
        )}
      </form>

      <button
        type="button"
        className="mt-4 text-center text-sm text-cocoa-light underline"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'login' ? 'Noch keinen Account? Registrieren' : 'Schon registriert? Anmelden'}
      </button>
    </div>
  )
}
