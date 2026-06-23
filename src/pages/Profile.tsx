import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemeMode } from '../lib/theme'
import { usePrefs } from '../lib/prefs'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-ruby' : 'bg-sand-dark'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

const MODES: { v: ThemeMode; label: string }[] = [
  { v: 'system', label: 'System' },
  { v: 'light', label: 'Hell' },
  { v: 'dark', label: 'Dunkel' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode, setMode } = useTheme()
  const { showNutrition, setShowNutrition } = usePrefs()

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
        </button>
        <h1 className="text-xl font-bold">Profil</h1>
      </header>

      <div className="card">
        <div className="label">Angemeldet als</div>
        <div className="font-medium break-all">{user?.email ?? '—'}</div>
      </div>

      <div className="card space-y-2">
        <div className="label">Darstellung</div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className={`btn ${
                mode === m.v
                  ? 'bg-ruby text-white'
                  : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Ernährungstracking</div>
          <div className="text-xs text-cocoa-light">
            Zeigt den „Essen"-Tab und die Ernährungs-Auswertung.
          </div>
        </div>
        <Toggle checked={showNutrition} onChange={setShowNutrition} />
      </div>

      <button className="btn-ghost w-full" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </button>
    </div>
  )
}
