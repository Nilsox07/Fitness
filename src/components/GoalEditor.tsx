import { useEffect, useState, type ReactNode } from 'react'
import {
  useNutritionSettings,
  useUpsertNutritionSettings,
  type NutritionSettingsInput,
} from '../hooks/useNutrition'
import {
  ACTIVITY_LABEL,
  GOAL_LABEL,
  GOAL_HINT,
  computeTargets,
  defaultWaterTarget,
} from '../lib/nutrition'
import { getDietAvoid, setDietAvoid } from '../lib/ai'
import { usePrefs } from '../lib/prefs'
import {
  DIET_MACROS,
  DIET_MACRO_HINT,
  DIET_MACRO_LABEL,
  DIET_RESTRICTIONS,
  DIET_RESTRICTION_LABEL,
  FASTING_HINT,
  FASTING_LABEL,
  FASTING_OPTIONS,
  fastingWindow,
  resolveDiet,
  toggleRestriction,
  type DietStyle,
} from '../lib/dietStyle'
import type { ActivityLevel, NutritionGoal, Sex } from '../types'

const EMPTY: NutritionSettingsInput = {
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
  water_target_ml: 2500,
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
        active ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
      }`}
    >
      {children}
    </button>
  )
}

/** Abschnitt „Ernährungsweise": Makro-Stil, Einschränkungen, Intervallfasten. */
function DietSection({ diet, onChange }: { diet: DietStyle; onChange: (d: DietStyle) => void }) {
  const win = fastingWindow(diet)
  return (
    <div className="space-y-3 rounded-xl border border-sand-dark/60 p-3">
      <div className="text-sm font-semibold text-cocoa">Ernährungsweise</div>
      <div>
        <label className="label">Makro-Stil</label>
        <div className="flex flex-wrap gap-1.5">
          {DIET_MACROS.map((m) => (
            <Chip key={m} active={diet.macro === m} onClick={() => onChange({ ...diet, macro: m })}>
              {DIET_MACRO_LABEL[m]}
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-cocoa-light">{DIET_MACRO_HINT[diet.macro]}</p>
      </div>
      <div>
        <label className="label">Einschränkungen</label>
        <div className="flex flex-wrap gap-1.5">
          {DIET_RESTRICTIONS.map((r) => (
            <Chip
              key={r}
              active={diet.restrictions.includes(r)}
              onClick={() => onChange({ ...diet, restrictions: toggleRestriction(diet.restrictions, r) })}
            >
              {DIET_RESTRICTION_LABEL[r]}
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-cocoa-light">
          Score &amp; KI achten darauf (z. B. Hinweis „Nicht vegan").
        </p>
      </div>
      <div>
        <label className="label">Intervallfasten</label>
        <div className="flex flex-wrap gap-1.5">
          {FASTING_OPTIONS.map((f) => (
            <Chip key={f} active={diet.fasting === f} onClick={() => onChange({ ...diet, fasting: f })}>
              {FASTING_LABEL[f]}
            </Chip>
          ))}
        </div>
        {diet.fasting !== 'none' && <p className="mt-1 text-xs text-cocoa-light">{FASTING_HINT[diet.fasting]}</p>}
        {win && (
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm text-cocoa-light" htmlFor="fasting-start">
              Essensfenster ab
            </label>
            <input
              id="fasting-start"
              type="time"
              step={900}
              className="input w-28 py-1.5"
              value={diet.fastingStart}
              onChange={(e) => e.target.value && onChange({ ...diet, fastingStart: e.target.value })}
            />
            <span className="tabular text-sm text-cocoa-light">bis {win.end}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldError({ msg }: { msg: string | null }) {
  return msg ? <p className="mt-1 text-xs text-red-500 dark:text-red-400">{msg}</p> : null
}

/**
 * Wiederverwendbarer Editor für Körperdaten, Ziel, Nährwerte und Trinkziel.
 * Berechnet die Makros automatisch je nach Ziel (Abnehmen/Halten/Aufbauen/Recomp)
 * und speichert sie. Wird im Profil (inline) und im Ernährungs-Setup (Modal) genutzt.
 */
export function GoalEditor({
  onSaved,
  onCancel,
}: {
  onSaved?: () => void
  onCancel?: () => void
}) {
  const { data: settings } = useNutritionSettings()
  const upsert = useUpsertNutritionSettings()
  const [form, setForm] = useState<NutritionSettingsInput>(EMPTY)
  const [avoid, setAvoid] = useState(() => getDietAvoid())
  const [loaded, setLoaded] = useState(false)
  const { isNew } = usePrefs()
  // Ernährungsweise: nur im neuen Modus wählbar; der klassische Modus rechnet
  // mit der gespeicherten Auswahl weiter (damit sich nichts unbemerkt zurücksetzt).
  const [diet, setDiet] = useState<DietStyle>(() => resolveDiet(settings ?? null))

  // Gespeicherte Körperdaten/Ziele einmalig übernehmen, sobald sie geladen sind.
  useEffect(() => {
    if (!settings || loaded) return
    // Fehlende/leere Felder (null/undefined) auf die Standardwerte zurückfallen lassen,
    // damit die berechneten Ziele nie NaN anzeigen.
    const weight = settings.weight_kg ?? EMPTY.weight_kg
    setForm({
      sex: settings.sex ?? EMPTY.sex,
      age: settings.age ?? EMPTY.age,
      height_cm: settings.height_cm ?? EMPTY.height_cm,
      weight_kg: weight,
      activity: settings.activity ?? EMPTY.activity,
      goal: settings.goal ?? EMPTY.goal,
      kcal_target: settings.kcal_target ?? EMPTY.kcal_target,
      protein_target: settings.protein_target ?? EMPTY.protein_target,
      carbs_target: settings.carbs_target ?? EMPTY.carbs_target,
      fat_target: settings.fat_target ?? EMPTY.fat_target,
      water_target_ml: settings.water_target_ml || defaultWaterTarget(weight) || EMPTY.water_target_ml,
    })
    setDiet(resolveDiet(settings))
    setLoaded(true)
  }, [settings, loaded])

  const t = computeTargets({ ...form, diet: diet.macro })
  const base = computeTargets(form)
  const showDelta = isNew && diet.macro !== 'balanced'
  const [error, setError] = useState<string | null>(null)

  // Plausibilitätsprüfung (DB: Alter 10–100, Größe/Gewicht > 0, Trinkziel ≥ 0).
  const fieldError = {
    age:
      !Number.isFinite(form.age) || form.age < 10 || form.age > 100
        ? 'Alter bitte zwischen 10 und 100 Jahren.'
        : null,
    height_cm:
      !Number.isFinite(form.height_cm) || form.height_cm < 100 || form.height_cm > 250
        ? 'Größe bitte zwischen 100 und 250 cm.'
        : null,
    weight_kg:
      !Number.isFinite(form.weight_kg) || form.weight_kg < 30 || form.weight_kg > 300
        ? 'Gewicht bitte zwischen 30 und 300 kg.'
        : null,
    water_target_ml:
      !Number.isFinite(form.water_target_ml) || form.water_target_ml < 0 || form.water_target_ml > 10000
        ? 'Trinkziel bitte zwischen 0 und 10000 ml.'
        : null,
  }
  const invalid = Object.values(fieldError).some(Boolean)

  async function save() {
    if (invalid) {
      setError('Bitte die markierten Angaben prüfen.')
      return
    }
    setError(null)
    setDietAvoid(avoid)
    try {
      await upsert.mutateAsync({
        ...form,
        age: Math.round(form.age), // DB-Spalte ist int
        kcal_target: t.kcal,
        protein_target: t.protein,
        carbs_target: t.carbs,
        fat_target: t.fat,
        water_target_ml: Math.round(form.water_target_ml || defaultWaterTarget(form.weight_kg)),
        ...(isNew ? { diet } : {}),
      })
      onSaved?.()
    } catch (e) {
      setError(
        'Speichern fehlgeschlagen' + (e instanceof Error && e.message ? `: ${e.message}` : '.') +
          ' Bitte nochmal versuchen.',
      )
    }
  }

  return (
    <div className="space-y-3">
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
          <FieldError msg={fieldError.age} />
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
          <FieldError msg={fieldError.height_cm} />
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
          <FieldError msg={fieldError.weight_kg} />
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
        <p className="mt-1 text-xs text-cocoa-light">{GOAL_HINT[form.goal]}</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label">Trinkziel (ml/Tag)</label>
          <button
            type="button"
            className="text-xs font-semibold text-brand"
            onClick={() => setForm({ ...form, water_target_ml: defaultWaterTarget(form.weight_kg) })}
          >
            Vorschlag ({defaultWaterTarget(form.weight_kg)} ml)
          </button>
        </div>
        <input
          type="number"
          inputMode="numeric"
          step={250}
          className="input"
          value={form.water_target_ml}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setForm({ ...form, water_target_ml: Number(e.target.value) })}
        />
        <FieldError msg={fieldError.water_target_ml} />
      </div>

      <div>
        <label className="label">Das esse ich nicht / Allergien</label>
        <textarea
          className="input"
          rows={2}
          placeholder="z. B. keine Pilze, Laktose, Erdnüsse, kein Schweinefleisch…"
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
        />
        <p className="mt-1 text-xs text-cocoa-light">
          Die KI meidet diese Zutaten bei Rezepten, Essensplan, Einkaufsliste &amp;
          Restaurant-Vorschlägen.
        </p>
      </div>

      {isNew && <DietSection diet={diet} onChange={setDiet} />}

      {/* Live-Vorschau der berechneten Nährwerte */}
      <div className="rounded-xl bg-sand p-3">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-cocoa-light">
          <span>Dein Tagesziel</span>
          {showDelta && <span className="truncate font-normal">vs. Ausgewogen</span>}
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          {(
            [
              ['kcal', 'kcal'],
              ['protein', 'Eiweiß'],
              ['carbs', 'KH'],
              ['fat', 'Fett'],
            ] as const
          ).map(([k, label]) => {
            const delta = t[k] - base[k]
            return (
              <div key={k}>
                <div className="tabular text-base font-bold text-cocoa">{t[k]}</div>
                <div className="text-[11px] text-cocoa-light">{label}</div>
                {showDelta && delta !== 0 && (
                  <div
                    className={`tabular text-[11px] font-semibold ${delta > 0 ? 'text-success' : 'text-gold'}`}
                  >
                    {delta > 0 ? '+' : '−'}
                    {Math.abs(delta)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button className="btn-ghost flex-1" onClick={onCancel} disabled={upsert.isPending}>
            Abbrechen
          </button>
        )}
        <button className="btn-primary flex-1" onClick={save} disabled={upsert.isPending}>
          {upsert.isPending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
