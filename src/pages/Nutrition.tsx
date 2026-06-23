import { useState } from 'react'
import { Stepper } from '../components/Stepper'
import { BarcodeScanner } from '../components/BarcodeScanner'
import {
  useAddFoodEntry,
  useDeleteFoodEntry,
  useFoodEntries,
  useNutritionSettings,
  useUpsertNutritionSettings,
  type NutritionSettingsInput,
} from '../hooks/useNutrition'
import {
  ACTIVITY_LABEL,
  GOAL_LABEL,
  computeTargets,
  scalePer100,
  sumEntries,
} from '../lib/nutrition'
import { fetchProductByBarcode, searchProducts, type FoodProduct } from '../lib/openfoodfacts'
import type { ActivityLevel, NutritionGoal, Sex } from '../types'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const emptySettings: NutritionSettingsInput = {
  sex: 'm',
  age: 30,
  height_cm: 175,
  weight_kg: 75,
  activity: 'moderate',
  goal: 'maintain',
  kcal_target: 0,
  protein_target: 0,
  carbs_target: 0,
  fat_target: 0,
}

function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sand-dark/50">
      <div className="h-full rounded-full bg-ruby" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Nutrition() {
  const today = todayLocal()
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(today)
  const upsertSettings = useUpsertNutritionSettings()
  const addEntry = useAddFoodEntry()
  const deleteEntry = useDeleteFoodEntry()

  const totals = sumEntries(entries ?? [])

  // Modal-Status
  const [setupOpen, setSetupOpen] = useState(false)
  const [form, setForm] = useState<NutritionSettingsInput>(emptySettings)
  const [addMode, setAddMode] = useState<null | 'menu' | 'manual' | 'search'>(null)
  const [scanning, setScanning] = useState(false)

  // gewähltes Produkt → Mengen-Bestätigung
  const [pending, setPending] = useState<FoodProduct | null>(null)
  const [amount, setAmount] = useState(100)

  // Suche
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodProduct[]>([])
  const [searching, setSearching] = useState(false)

  // manuelle Eingabe
  const [manual, setManual] = useState({ name: '', amount_g: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const [error, setError] = useState<string | null>(null)

  function openSetup() {
    setForm(settings ? { ...settings } : emptySettings)
    setSetupOpen(true)
  }

  async function saveSetup() {
    const t = computeTargets(form)
    await upsertSettings.mutateAsync({
      ...form,
      kcal_target: t.kcal,
      protein_target: t.protein,
      carbs_target: t.carbs,
      fat_target: t.fat,
    })
    setSetupOpen(false)
  }

  async function handleBarcode(code: string) {
    setScanning(false)
    setError(null)
    try {
      const product = await fetchProductByBarcode(code)
      if (!product) {
        setError(`Kein Produkt zu Barcode ${code} gefunden. Versuch die Suche oder manuelle Eingabe.`)
        setAddMode('menu')
        return
      }
      setPending(product)
      setAmount(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Abruf')
    }
  }

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchProducts(query.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler bei der Suche')
    } finally {
      setSearching(false)
    }
  }

  async function confirmPending() {
    if (!pending) return
    const m = scalePer100(pending.per100, amount)
    await addEntry.mutateAsync({
      date: today,
      name: pending.name,
      amount_g: amount,
      kcal: m.kcal,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      barcode: pending.barcode,
    })
    setPending(null)
    setAddMode(null)
    setQuery('')
    setResults([])
  }

  async function addManual() {
    if (!manual.name.trim()) return
    await addEntry.mutateAsync({
      date: today,
      name: manual.name.trim(),
      amount_g: manual.amount_g || null,
      kcal: manual.kcal,
      protein: manual.protein,
      carbs: manual.carbs,
      fat: manual.fat,
      barcode: null,
    })
    setManual({ name: '', amount_g: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 })
    setAddMode(null)
  }

  const hasTarget = settings && settings.kcal_target > 0
  const kcalLeft = hasTarget ? settings!.kcal_target - totals.kcal : 0

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ernährung</h1>
        <button className="btn-ghost text-sm" onClick={openSetup}>
          {hasTarget ? 'Ziel ändern' : 'Ziel einstellen'}
        </button>
      </header>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {/* Tagesübersicht */}
      <div className="card space-y-3">
        {hasTarget ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-brand">{totals.kcal}</div>
                <div className="text-xs text-cocoa-light">von {settings!.kcal_target} kcal</div>
              </div>
              <div className="text-right text-sm text-cocoa-light">
                {kcalLeft >= 0 ? `${kcalLeft} kcal übrig` : `${-kcalLeft} kcal drüber`}
              </div>
            </div>
            <Bar value={totals.kcal} target={settings!.kcal_target} />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-cocoa">{totals.protein} g</div>
                <div className="text-cocoa-light">Eiweiß / {settings!.protein_target} g</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">{totals.carbs} g</div>
                <div className="text-cocoa-light">Kohlh. / {settings!.carbs_target} g</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">{totals.fat} g</div>
                <div className="text-cocoa-light">Fett / {settings!.fat_target} g</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-sm text-cocoa-light">
            Stell zuerst dein Kalorienziel ein, um deinen Tagesfortschritt zu sehen.
          </div>
        )}
      </div>

      {/* Erfassen */}
      <button className="btn-primary w-full" onClick={() => setAddMode('menu')}>
        + Lebensmittel hinzufügen
      </button>

      {/* Heutige Einträge */}
      <div className="space-y-2">
        {entries?.map((e) => (
          <div key={e.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-cocoa-light">
                {e.amount_g ? `${e.amount_g} g · ` : ''}
                {Math.round(e.kcal)} kcal · E {e.protein} / K {e.carbs} / F {e.fat}
              </div>
            </div>
            <button
              className="ml-2 px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
              aria-label="Eintrag löschen"
              onClick={() => deleteEntry.mutate(e)}
            >
              ✕
            </button>
          </div>
        ))}
        {entries?.length === 0 && (
          <p className="text-center text-sm text-cocoa-light">Heute noch nichts erfasst.</p>
        )}
      </div>

      {/* ----- Ziel-Setup ----- */}
      {setupOpen && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Kalorienziel</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Geschlecht</label>
                <select
                  className="input"
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}
                >
                  <option value="m">männlich</option>
                  <option value="f">weiblich</option>
                </select>
              </div>
              <div>
                <label className="label">Alter</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  value={form.age}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Größe (cm)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  value={form.height_cm}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, height_cm: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Gewicht (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  value={form.weight_kg}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="label">Aktivität</label>
              <select
                className="input"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value as ActivityLevel })}
              >
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ziel</label>
              <select
                className="input"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value as NutritionGoal })}
              >
                {Object.entries(GOAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-cocoa-light">
              Ergibt ~{computeTargets(form).kcal} kcal/Tag · Eiweiß {computeTargets(form).protein} g
            </p>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setSetupOpen(false)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={saveSetup}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Hinzufügen: Menü ----- */}
      {addMode === 'menu' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-2">
            <h2 className="text-lg font-bold">Hinzufügen</h2>
            <button
              className="btn-primary w-full"
              onClick={() => {
                setError(null)
                setScanning(true)
              }}
            >
              📷 Barcode scannen
            </button>
            <button className="btn-ghost w-full" onClick={() => setAddMode('search')}>
              🔎 In Datenbank suchen
            </button>
            <button className="btn-ghost w-full" onClick={() => setAddMode('manual')}>
              ✍️ Manuell eingeben
            </button>
            <button
              className="w-full pt-1 text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode(null)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* ----- Suche ----- */}
      {addMode === 'search' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Suchen</h2>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="z. B. Magerquark"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <button className="btn-primary" onClick={runSearch} disabled={searching}>
                {searching ? '…' : 'Los'}
              </button>
            </div>
            <ul className="space-y-1">
              {results.map((p, i) => (
                <li key={i}>
                  <button
                    className="w-full rounded-lg bg-sand/40 px-3 py-2 text-left ring-1 ring-sand-dark/50"
                    onClick={() => {
                      setPending(p)
                      setAmount(100)
                    }}
                  >
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-cocoa-light">
                      {p.brand ? `${p.brand} · ` : ''}
                      {p.per100.kcal} kcal /100 g
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="w-full text-center text-sm text-cocoa-light underline"
              onClick={() => setAddMode('menu')}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ----- Mengen-Bestätigung (Barcode/Suche) ----- */}
      {pending && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold">{pending.name}</h2>
            <p className="text-xs text-cocoa-light">
              {pending.brand ? `${pending.brand} · ` : ''}
              pro 100 g: {pending.per100.kcal} kcal · E {pending.per100.protein} / K{' '}
              {pending.per100.carbs} / F {pending.per100.fat}
            </p>
            <Stepper label="Menge (g)" value={amount} onChange={setAmount} step={10} min={0} suffix="g" />
            <p className="text-sm">
              = <strong>{scalePer100(pending.per100, amount).kcal} kcal</strong>, Eiweiß{' '}
              {scalePer100(pending.per100, amount).protein} g
            </p>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setPending(null)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={confirmPending} disabled={addEntry.isPending}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Manuelle Eingabe ----- */}
      {addMode === 'manual' && !pending && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto">
            <h2 className="text-lg font-bold">Manuell eingeben</h2>
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                autoFocus
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['kcal', 'kcal'],
                  ['amount_g', 'Menge (g)'],
                  ['protein', 'Eiweiß (g)'],
                  ['carbs', 'Kohlenhydrate (g)'],
                  ['fat', 'Fett (g)'],
                ] as const
              ).map(([key, lbl]) => (
                <div key={key}>
                  <label className="label">{lbl}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="input"
                    value={manual[key]}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setManual({ ...manual, [key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setAddMode('menu')}>
                Zurück
              </button>
              <button className="btn-primary flex-1" onClick={addManual} disabled={addEntry.isPending}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Kamera-Scanner ----- */}
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  )
}
