import { useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { AuthNote, AuthShell } from '../components/ui/AuthShell'

export default function ResetPassword() {
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      mood={done ? 'proud' : error ? 'sad' : 'focus'}
      title={done ? 'Passwort geändert' : 'Neues Passwort'}
      subtitle={done ? 'Alles erledigt — weiter geht’s.' : 'Lege dein neues Passwort fest.'}
    >
      {done ? (
        <div className="space-y-4 rounded-3xl bg-cream p-5 text-center shadow-sm">
          <div className="anim-check mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
            <Check size={24} strokeWidth={2.75} />
          </div>
          <p className="text-sm text-cocoa-light">Du kannst dich ab jetzt mit dem neuen Passwort anmelden.</p>
          <button
            className="btn-primary w-full rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25"
            onClick={() => clearRecovery()}
          >
            Weiter zur App
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-cream p-5 shadow-sm">
          <div>
            <label className="label" htmlFor="new-password">
              Neues Passwort
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Mindestens 6 Zeichen"
              className="input rounded-2xl py-3.5 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <AuthNote kind="error">{error}</AuthNote>}

          <button
            type="submit"
            className="btn-primary w-full gap-2 rounded-2xl py-3.5 text-base shadow-lg shadow-brand/25"
            disabled={busy}
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            Passwort speichern
          </button>
        </form>
      )}
    </AuthShell>
  )
}
