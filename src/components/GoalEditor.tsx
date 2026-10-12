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
  type MacroTargets,
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
import {
  Activity,
  Ban,
  Check,
  Clock,
  Droplet,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  Salad,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Group, IconTile, Row } from './profile/ui'
import { PremiumSheet } from './ui/PremiumSheet'
import { ChoiceSheet, FastingSheet, MacroSheet, RestrictionSheet, Warning } from './goal/DietPickers'
import { ErrorNote } from './ui/GroupList'

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
    <div className="space-y-4">
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
              className="input tabular w-28 rounded-xl py-1.5"
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

/** Abweichung zum ausgewogenen Stil (nur bei anderem Makro-Stil). */
function Delta({ show, value }: { show: boolean; value: number }) {
  if (!show || value === 0) return null
  return (
    <span className={`tabular text-[11px] font-semibold ${value > 0 ? 'text-success' : 'text-gold'}`}>
      {value > 0 ? '+' : '−'}
      {Math.abs(value)}
    </span>
  )
}

const GOAL_ICON: Record<NutritionGoal, LucideIcon> = {
  lose: TrendingDown,
  maintain: Scale,
  gain: TrendingUp,
  recomp: RefreshCw,
}

/** Live-Ergebnis oben: Tagesziel aus allen Angaben unten. */
function TargetHero({
  t,
  base,
  showDelta,
  dietLabel,
}: {
  t: MacroTargets
  base: MacroTargets
  showDelta: boolean
  dietLabel: string
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-cocoa p-4 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            Dein Tagesziel
          </span>
          <span className="truncate rounded-full bg-bg/10 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/5">
            {dietLabel}
            {showDelta && <span className="font-normal text-bg/60 dark:text-cocoa-light"> · vs. Ausgewogen</span>}
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-4xl font-bold tracking-tight">{t.kcal.toLocaleString('de-DE')}</span>
          <span className="text-sm text-bg/70 dark:text-cocoa-light">kcal</span>
          <Delta show={showDelta} value={t.kcal - base.kcal} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ['protein', 'Eiweiß', 'bg-brand'],
              ['carbs', 'Kohlenhydrate', 'bg-gold'],
              ['fat', 'Fett', 'bg-bg/50 dark:bg-cocoa-light'],
            ] as const
          ).map(([k, label, dot]) => (
            <div key={k} className="rounded-2xl bg-bg/10 px-2.5 py-2 dark:bg-white/5">
              <div className="flex items-center gap-1.5 text-[11px] text-bg/70 dark:text-cocoa-light">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                <span className="truncate">{label}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="tabular text-lg font-bold">{t[k]}</span>
                <span className="text-xs text-bg/60 dark:text-cocoa-light">g</span>
                <Delta show={showDelta} value={t[k] - base[k]} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] text-bg/50 dark:text-cocoa-muted">Rechnet live mit, während du unten etwas änderst.</p>
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
  const [sheet, setSheet] = useState<'activity' | 'macro' | 'restrict' | 'fasting' | 'avoid' | null>(null)

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

  if (isNew) {
    const bodyErrors = [fieldError.age, fieldError.height_cm, fieldError.weight_kg].filter(Boolean) as string[]
    const numRow = (key: 'age' | 'height_cm' | 'weight_kg', label: string, unit: string, mode: 'numeric' | 'decimal') => (
      <label className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2" htmlFor={`goal-${key}`}>
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        <input
          id={`goal-${key}`}
          type="number"
          inputMode={mode}
          aria-invalid={!!fieldError[key]}
          className={`tabular w-20 rounded-xl bg-sand px-2.5 py-1.5 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-ruby ${
            fieldError[key] ? 'ring-2 ring-red-400' : ''
          }`}
          value={form[key]}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
        />
        <span className="w-10 text-sm text-cocoa-light">{unit}</span>
      </label>
    )
    const [actLabel] = ACTIVITY_LABEL[form.activity].split(' (')
    const waterSuggest = defaultWaterTarget(form.weight_kg)

    return (
      <div className="space-y-6">
        <TargetHero t={t} base={base} showDelta={showDelta} dietLabel={DIET_MACRO_LABEL[diet.macro]} />
        {diet.macro === 'psmf' && (
          <Warning>
            PSMF ist eine Crash-Diät mit sehr wenig Kalorien: höchstens 2–6 Wochen, vorher ärztlich abklären. Nicht für
            Jugendliche, Schwangere oder bei Vorerkrankungen.
          </Warning>
        )}

        <Group title="Körperdaten">
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 rounded-full bg-sand p-1" role="radiogroup" aria-label="Geschlecht">
              {(
                [
                  ['m', 'Männlich'],
                  ['f', 'Weiblich'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={form.sex === k}
                  onClick={() => setForm({ ...form, sex: k as Sex })}
                  className={`h-9 rounded-full text-sm font-semibold transition-all duration-200 ${
                    form.sex === k ? 'bg-bg text-cocoa shadow-sm' : 'text-cocoa-light'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {numRow('age', 'Alter', 'Jahre', 'numeric')}
          {numRow('height_cm', 'Größe', 'cm', 'numeric')}
          {numRow('weight_kg', 'Gewicht', 'kg', 'decimal')}
          <Row icon={Activity} label="Aktivität" value={actLabel} onClick={() => setSheet('activity')} />
        </Group>
        {bodyErrors.map((m) => (
          <FieldError key={m} msg={m} />
        ))}

        <Group title="Dein Ziel">
          {(Object.entries(GOAL_LABEL) as [NutritionGoal, string][]).map(([k, v]) => {
            const Icon = GOAL_ICON[k]
            const on = form.goal === k
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setForm({ ...form, goal: k })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-sand-light"
              >
                <IconTile icon={Icon} tint={on ? 'brand' : 'neutral'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{v}</span>
                  <span className="block text-xs leading-snug text-cocoa-light">{GOAL_HINT[k]}</span>
                </span>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    on ? 'bg-brand text-on-brand' : 'ring-2 ring-inset ring-sand-dark'
                  }`}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </Group>

        <Group title="Ernährung" footer="Tippe auf eine Zeile – bei jeder Option steht, was dahinter steckt.">
          <Row icon={Salad} label="Ernährungsweise" value={DIET_MACRO_LABEL[diet.macro]} onClick={() => setSheet('macro')} />
          <Row
            icon={Leaf}
            tint="success"
            label="Einschränkungen"
            value={diet.restrictions.length ? diet.restrictions.map((r) => DIET_RESTRICTION_LABEL[r]).join(', ') : 'Keine'}
            onClick={() => setSheet('restrict')}
          />
          <Row
            icon={Clock}
            tint="violet"
            label="Intervallfasten"
            value={diet.fasting === 'none' ? 'Aus' : diet.fasting}
            onClick={() => setSheet('fasting')}
          />
          <Row
            icon={Ban}
            tint="gold"
            label="Das esse ich nicht"
            value={avoid.trim() || 'Nichts'}
            onClick={() => setSheet('avoid')}
          />
        </Group>

        <Group
          title="Trinken"
          footer={
            form.water_target_ml !== waterSuggest ? (
              <button
                type="button"
                className="font-semibold text-brand"
                onClick={() => setForm({ ...form, water_target_ml: waterSuggest })}
              >
                Empfehlung für {form.weight_kg} kg übernehmen: {waterSuggest} ml
              </button>
            ) : (
              'Entspricht der Empfehlung für dein Gewicht (~35 ml pro kg).'
            )
          }
        >
          <div className="flex min-h-[3.5rem] items-center gap-3 px-4 py-2">
            <IconTile icon={Droplet} tint="sky" />
            <span className="flex-1 text-[15px] font-semibold">Trinkziel</span>
            <button
              type="button"
              aria-label="250 ml weniger"
              className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa active:scale-90"
              onClick={() => setForm({ ...form, water_target_ml: Math.max(0, form.water_target_ml - 250) })}
            >
              <Minus size={16} />
            </button>
            <span className="tabular w-[4.5rem] text-center text-base font-semibold">
              {(form.water_target_ml / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} l
            </span>
            <button
              type="button"
              aria-label="250 ml mehr"
              className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa active:scale-90"
              onClick={() => setForm({ ...form, water_target_ml: Math.min(10000, form.water_target_ml + 250) })}
            >
              <Plus size={16} />
            </button>
          </div>
        </Group>
        <FieldError msg={fieldError.water_target_ml} />

        <ErrorNote error={error} />

        <div className="flex gap-2">
          {onCancel && (
            <button className="btn-ghost flex-1 rounded-2xl py-3" onClick={onCancel} disabled={upsert.isPending}>
              Abbrechen
            </button>
          )}
          <button
            className="btn-primary flex-1 rounded-2xl py-3 text-base shadow-lg shadow-brand/25"
            onClick={save}
            disabled={upsert.isPending}
          >
            {upsert.isPending ? 'Speichert…' : 'Speichern'}
          </button>
        </div>

        {sheet === 'activity' && (
          <ChoiceSheet
            title="Aktivität"
            subtitle="Alltag und Sport zusammen"
            value={form.activity}
            options={(Object.entries(ACTIVITY_LABEL) as [ActivityLevel, string][]).map(([k, v]) => {
              const [label, hint] = v.split(' (')
              return { value: k, label, hint: hint?.replace(/\)$/, '') }
            })}
            onChange={(v) => setForm({ ...form, activity: v })}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'macro' && <MacroSheet diet={diet} onChange={setDiet} onClose={() => setSheet(null)} />}
        {sheet === 'restrict' && <RestrictionSheet diet={diet} onChange={setDiet} onClose={() => setSheet(null)} />}
        {sheet === 'fasting' && <FastingSheet diet={diet} onChange={setDiet} onClose={() => setSheet(null)} />}
        {sheet === 'avoid' && (
          <PremiumSheet title="Das esse ich nicht" subtitle="Allergien, Unverträglichkeiten, Abneigungen" onClose={() => setSheet(null)}>
            <textarea
              className="input rounded-2xl text-base"
              rows={4}
              autoFocus
              placeholder="z. B. keine Pilze, Erdnüsse, kein Schweinefleisch…"
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
            />
            <p className="text-xs text-cocoa-light">
              Die KI meidet diese Zutaten bei Rezepten, Essensplan, Einkaufsliste &amp; Restaurant-Vorschlägen.
            </p>
            <button className="btn-primary w-full rounded-2xl py-3" onClick={() => setSheet(null)}>
              Fertig
            </button>
          </PremiumSheet>
        )}
      </div>
    )
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
