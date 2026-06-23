import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

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
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-4xl">🔑</div>
        <h1 className="mt-2 text-2xl font-bold">Neues Passwort</h1>
        <p className="text-sm text-cocoa-light">Lege dein neues Passwort fest.</p>
      </div>

      {done ? (
        <div className="card space-y-3 text-center">
          <p className="text-brand">✓ Passwort geändert.</p>
          <button className="btn-primary w-full" onClick={() => clearRecovery()}>
            Weiter zur App
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
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
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : 'Passwort speichern'}
          </button>
        </form>
      )}
    </div>
  )
}
