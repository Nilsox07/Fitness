import { useEffect, useState } from 'react'
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

  // Gespeicherte Körperdaten/Ziele einmalig übernehmen, sobald sie geladen sind.
  useEffect(() => {
    if (!settings || loaded) return
    setForm({
      sex: settings.sex,
      age: settings.age,
      height_cm: settings.height_cm,
      weight_kg: settings.weight_kg,
      activity: settings.activity,
      goal: settings.goal,
      kcal_target: settings.kcal_target,
      protein_target: settings.protein_target,
      carbs_target: settings.carbs_target,
      fat_target: settings.fat_target,
      water_target_ml: settings.water_target_ml || defaultWaterTarget(settings.weight_kg),
    })
    setLoaded(true)
  }, [settings, loaded])

  const t = computeTargets(form)

  async function save() {
    setDietAvoid(avoid)
    await upsert.mutateAsync({
      ...form,
      kcal_target: t.kcal,
      protein_target: t.protein,
      carbs_target: t.carbs,
      fat_target: t.fat,
      water_target_ml: form.water_target_ml || defaultWaterTarget(form.weight_kg),
    })
    onSaved?.()
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

      {/* Live-Vorschau der berechneten Nährwerte */}
      <div className="rounded-xl bg-sand/50 p-3 ring-1 ring-sand-dark">
        <div className="mb-1 text-xs font-semibold text-cocoa-light">Dein Tagesziel</div>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div>
            <div className="text-base font-bold text-cocoa">{t.kcal}</div>
            <div className="text-[11px] text-cocoa-light">kcal</div>
          </div>
          <div>
            <div className="text-base font-bold text-cocoa">{t.protein}</div>
            <div className="text-[11px] text-cocoa-light">Eiweiß</div>
          </div>
          <div>
            <div className="text-base font-bold text-cocoa">{t.carbs}</div>
            <div className="text-[11px] text-cocoa-light">KH</div>
          </div>
          <div>
            <div className="text-base font-bold text-cocoa">{t.fat}</div>
            <div className="text-[11px] text-cocoa-light">Fett</div>
          </div>
        </div>
      </div>

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
