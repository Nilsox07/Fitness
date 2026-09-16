import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNutritionSettings } from '../hooks/useNutrition'
import { shoppingList, type ShoppingCategory } from '../lib/ai'
import { MicButton } from '../components/MicButton'

function loadChecked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('shopping_checked') || '[]'))
  } catch {
    return new Set()
  }
}
function saveChecked(s: Set<string>) {
  try {
    localStorage.setItem('shopping_checked', JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

export default function Shopping() {
  const navigate = useNavigate()
  const { data: settings } = useNutritionSettings()
  const [days, setDays] = useState(7)
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{ note: string; categories: ShoppingCategory[] } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(loadChecked)

  async function generate() {
    setBusy(true)
    setErr(null)
    try {
      const res = await shoppingList(
        days,
        { kcal: settings?.kcal_target ?? 2000, protein: settings?.protein_target ?? 130 },
        wish,
      )
      if (res.categories.length === 0) setErr('Keine Liste erzeugt.')
      else setResult(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setBusy(false)
    }
  }

  function toggle(item: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      saveChecked(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
        </button>
        <h1 className="text-xl font-bold">Einkaufsassistent</h1>
      </header>

      <div className="card space-y-3">
        <div>
          <label className="label">Für wie lange?</label>
          <div className="flex gap-2">
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`btn flex-1 text-sm ${
                  days === d ? 'bg-ruby text-white' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                }`}
              >
                {d} Tage
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Wünsche (optional)</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="z. B. proteinreich, wenig Zucker, vegetarisch, gern was Süßes"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generate()}
            />
            <MicButton onResult={(t) => setWish((v) => (v ? v + ' ' + t : t))} />
          </div>
        </div>
        {err && <p className="text-sm text-red-500 dark:text-red-400">⚠️ {err}</p>}
        <button className="btn-primary w-full" onClick={generate} disabled={busy}>
          {busy ? 'Erstelle Liste…' : result ? 'Neu erstellen' : 'Einkaufsliste erstellen'}
        </button>
      </div>

      {result && (
        <>
          {result.note && <p className="px-1 text-sm text-cocoa-light">{result.note}</p>}
          {result.categories.map((c) => (
            <div key={c.category} className="card">
              <h2 className="mb-2 font-semibold">{c.category}</h2>
              <ul className="space-y-1">
                {c.items.map((it) => {
                  const done = checked.has(it)
                  return (
                    <li key={it}>
                      <button
                        className="flex w-full items-center gap-2 text-left text-sm"
                        onClick={() => toggle(it)}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] ${
                            done ? 'bg-brand text-white' : 'ring-1 ring-sand-dark text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span className={done ? 'text-cocoa-muted line-through' : 'text-cocoa'}>{it}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
