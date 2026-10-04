import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Loader2, RotateCcw, TriangleAlert, UtensilsCrossed, X } from 'lucide-react'
import type { FoodEstimate, MealAnalysis } from '../../lib/ai'
import { scoreMeal } from '../../lib/mealScore'
import { useDietStyle } from '../../hooks/useNutrition'
import { MEALS, MEAL_LABEL, type Meal, type NutritionGoal } from '../../types'
import { ScoreRing, TONE_TEXT } from './ScoreRing'
import { MacroBar } from './MacroBar'
import { DayFit } from './DayFit'
import { NutrientList } from './NutrientList'
import { IngredientRow } from './IngredientRow'
import { effective, PORTIONS, toItems, totalsOf, type MealItem } from './mealItems'
import { useCountUp } from './useCountUp'

export type AnalysisStatus = 'loading' | 'ready' | 'error'

/** Tageskontext für Score und „Für deinen Tag". */
export interface MealDayContext {
  /** Kalorienziel des Tages inkl. Trainingsbonus (0 = kein Ziel). */
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  goal: NutritionGoal | null
  /** Am Tag bereits gegessen (ohne diese Mahlzeit). */
  eaten: { kcal: number; protein: number }
}

export interface MealAnalysisSheetProps {
  /** Foto als Data-URL (wird nur angezeigt, nicht gespeichert); null = Text-Analyse. */
  photo: string | null
  status: AnalysisStatus
  result: MealAnalysis | null
  /** Eindeutige ID des Ergebnisses — neue ID setzt Bearbeitungen zurück. */
  resultId: string
  error: string | null
  onRetry: () => void
  onClose: () => void
  /** Speichert die Zutaten; wirft bei Fehler (Sheet bleibt dann offen). */
  onSave: (items: FoodEstimate[], meal: Meal) => Promise<void>
  defaultMeal: Meal
  day: MealDayContext
}

/**
 * „Mahlzeit-Analyse": öffnet sofort nach der Fotoauswahl (Ladezustand), zeigt dann
 * Score, Makros, Tagesbezug, Nährwerte und editierbare Zutaten. Alles darunter
 * rechnet live mit, wenn Portion oder Zutaten geändert werden.
 */
export function MealAnalysisSheet(props: MealAnalysisSheetProps) {
  const { onClose, status } = props
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const savingRef = useRef(saving)
  savingRef.current = saving

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={status === 'loading'}
        className="anim-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kopfzeile */}
        <div className="relative shrink-0 px-5 pb-2 pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-sand-dark" />
          <div className="mt-2 flex items-center justify-between">
            <h2 id={titleId} className="text-base font-semibold text-cocoa">
              Mahlzeit-Analyse
            </h2>
            <button
              className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light transition-colors hover:bg-sand-dark/60 disabled:opacity-40"
              onClick={onClose}
              disabled={saving}
              aria-label="Schließen"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {status === 'ready' && props.result ? (
          <ReadyBody key={props.resultId} {...props} result={props.result} saving={saving} setSaving={setSaving} />
        ) : (
          <PendingBody {...props} />
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function Hero({
  photo,
  title,
  kcal,
  loading,
}: {
  photo: string | null
  title?: string
  kcal?: number
  loading?: boolean
}) {
  const shownKcal = Math.round(useCountUp(kcal ?? 0))
  if (!photo) {
    return (
      <div className="relative flex aspect-[4/3] max-h-56 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-sand px-5 text-center">
        <div
          className={`grid h-16 w-16 place-items-center rounded-full bg-sand-light text-cocoa-light ${loading ? 'animate-pulse' : ''}`}
        >
          <UtensilsCrossed size={30} strokeWidth={1.75} />
        </div>
        {title && <div className="line-clamp-2 text-lg font-bold leading-snug text-cocoa">{title}</div>}
        {kcal != null && (
          <span className="tabular rounded-full bg-cream px-3 py-1 text-xs font-semibold text-cocoa">
            ≈ {shownKcal} kcal
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-sand">
      <img src={photo} alt={title ? `Foto: ${title}` : 'Foto deiner Mahlzeit'} className="h-full w-full object-cover" />
      {loading && <div className="absolute inset-0 animate-pulse bg-white/25 dark:bg-black/25" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pb-4 pt-16">
        {title && (
          <div className="anim-fade line-clamp-2 text-xl font-bold leading-snug text-white drop-shadow-sm">{title}</div>
        )}
        {kcal != null && (
          <span className="tabular mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            ≈ {shownKcal} kcal
          </span>
        )}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-sand ${className}`} />
}

/** Lade- und Fehlerzustand: Foto sofort sichtbar, darunter Platzhalter. */
function PendingBody({ photo, status, error, onRetry, onClose }: MealAnalysisSheetProps) {
  const failed = status === 'error'
  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-1">
        <div className="relative">
          <Hero photo={photo} loading={!failed} />
          {!failed && (
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur-md"
                role="status"
              >
                <Loader2 size={16} className="animate-spin" />
                Analysiere deine Mahlzeit…
              </div>
            </div>
          )}
        </div>

        {failed ? (
          <div className="anim-fade space-y-3 rounded-2xl bg-cream p-5 text-center" role="alert">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/15 text-gold">
              <TriangleAlert size={20} />
            </div>
            <p className="text-sm text-cocoa">{error || 'Die Analyse hat nicht geklappt.'}</p>
            <button className="btn-primary gap-1.5" onClick={onRetry}>
              <RotateCcw size={16} />
              Nochmal versuchen
            </button>
          </div>
        ) : (
          <div className="space-y-6" aria-hidden="true">
            <div className="flex items-center gap-4">
              <div className="h-[84px] w-[84px] shrink-0 animate-pulse rounded-full border-8 border-sand" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="space-y-px overflow-hidden rounded-2xl bg-cream">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between px-4 py-3.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer>
        <button className="btn-ghost w-full" onClick={onClose}>
          Abbrechen
        </button>
      </Footer>
    </>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-sand-dark/50 bg-bg/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {children}
    </div>
  )
}

function ReadyBody({
  photo,
  result,
  resultId,
  onSave,
  onClose,
  defaultMeal,
  day,
  saving,
  setSaving,
}: MealAnalysisSheetProps & {
  result: MealAnalysis
  saving: boolean
  setSaving: (v: boolean) => void
}) {
  const [items, setItems] = useState<MealItem[]>(() => toItems(result.items, resultId))
  const [portion, setPortion] = useState(1)
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  const [showItems, setShowItems] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const values = useMemo(() => items.map((it) => effective(it, portion)), [items, portion])
  const totals = useMemo(() => totalsOf(values), [values])
  const remainingKcal = day.kcalTarget > 0 ? day.kcalTarget - day.eaten.kcal : null
  const diet = useDietStyle()
  const flags = result.flags
  const score = useMemo(
    () => scoreMeal(totals, { goal: day.goal, remainingKcal, grams: totals.grams, diet, flags }),
    [totals, day.goal, remainingKcal, diet, flags],
  )
  const bigKcal = Math.round(useCountUp(totals.kcal))

  // Nach dem Speichern kurz den Haken zeigen, dann schließen
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => closeRef.current(), 700)
    return () => clearTimeout(t)
  }, [done])

  async function save() {
    if (saving || done || values.length === 0) return
    setSaveError(null)
    setSaving(true)
    try {
      await onSave(values, meal)
      try {
        navigator.vibrate?.(10)
      } catch {
        /* ignore */
      }
      setDone(true)
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
      setSaveError(`Hinzufügen fehlgeschlagen${detail}. Bitte nochmal versuchen.`)
    } finally {
      setSaving(false)
    }
  }

  const empty = items.length === 0

  return (
    <>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-6 pt-1">
        <Hero photo={photo} title={result.title} kcal={totals.kcal} />

        {/* Portion & Mahlzeit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-cocoa-light">Portion</span>
            <div className="flex rounded-full bg-sand p-0.5" role="radiogroup" aria-label="Portion">
              {PORTIONS.map((p) => (
                <button
                  key={p.value}
                  role="radio"
                  aria-checked={portion === p.value}
                  onClick={() => setPortion(p.value)}
                  className={`tabular h-8 min-w-[2.75rem] rounded-full px-2 text-sm font-semibold transition-all duration-200 ${
                    portion === p.value ? 'bg-bg text-cocoa shadow-sm' : 'text-cocoa-light'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5" role="radiogroup" aria-label="Mahlzeit">
            {MEALS.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={meal === m}
                onClick={() => setMeal(m)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-200 ${
                  meal === m ? 'bg-brand font-semibold text-on-brand' : 'bg-sand text-cocoa-light'
                }`}
              >
                {MEAL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {empty ? (
          <div className="rounded-2xl bg-cream p-5 text-center text-sm text-cocoa-light">
            Keine Zutaten mehr übrig. Schließ die Analyse oder versuch ein neues Foto.
          </div>
        ) : (
          <>
            {/* Score */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={score.score} tone={score.tone} />
                <div className="min-w-0 flex-1">
                  <div className={`text-lg font-bold ${TONE_TEXT[score.tone]}`}>{score.label}</div>
                  {result.verdict && <p className="mt-0.5 text-sm leading-snug text-cocoa-light">{result.verdict}</p>}
                </div>
              </div>

              {score.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {score.highlights.map((h) => (
                    <span
                      key={h.text}
                      className={`anim-fade inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        h.kind === 'good' ? 'bg-success/10 text-success' : 'bg-gold/15 text-gold'
                      }`}
                    >
                      {h.kind === 'good' ? <Check size={13} strokeWidth={2.75} /> : <TriangleAlert size={13} />}
                      {h.text}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Section title="Kalorien & Makros">
              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-4xl font-bold tracking-tight text-cocoa">{bigKcal}</span>
                <span className="text-sm text-cocoa-light">kcal</span>
              </div>
              <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
            </Section>

            <Section title="Für deinen Tag">
              <div className="rounded-2xl bg-cream p-4">
                <DayFit
                  kcalTarget={day.kcalTarget}
                  proteinTarget={day.proteinTarget}
                  eatenKcal={day.eaten.kcal}
                  eatenProtein={day.eaten.protein}
                  mealKcal={totals.kcal}
                  mealProtein={totals.protein}
                />
              </div>
            </Section>

            <Section title="Nährwerte">
              <NutrientList
                totals={totals}
                targets={{
                  protein: day.proteinTarget,
                  carbs: day.carbsTarget,
                  fat: day.fatTarget,
                }}
              />
            </Section>
          </>
        )}

        <section className="space-y-1">
          <button
            className="flex w-full items-center justify-between py-1 text-left"
            onClick={() => setShowItems((v) => !v)}
            aria-expanded={showItems}
          >
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-cocoa-muted">
              Erkannte Zutaten ({items.length})
            </h3>
            <ChevronDown
              size={18}
              className={`text-cocoa-muted transition-transform duration-200 ${showItems ? 'rotate-180' : ''}`}
            />
          </button>
          {showItems && items.length > 0 && (
            <ul className="anim-fade divide-y divide-sand-dark/60 rounded-2xl bg-cream px-4">
              {items.map((it, i) => (
                <IngredientRow
                  key={it.key}
                  item={it}
                  value={values[i]}
                  portion={portion}
                  onFactor={(f) => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, factor: f } : x)))}
                  onRemove={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                />
              ))}
            </ul>
          )}
          {showItems && (
            <p className="pt-1 text-[11px] text-cocoa-muted">
              KI-Schätzung — Mengen kurz prüfen, alles oben rechnet live mit.
            </p>
          )}
        </section>
      </div>

      <Footer>
        {saveError && (
          <p className="mb-2 text-sm text-red-500 dark:text-red-400" role="alert">
            {saveError}
          </p>
        )}
        <button
          className="btn-primary w-full gap-2 py-3 disabled:opacity-60"
          onClick={save}
          disabled={saving || done || empty}
        >
          {done ? (
            <>
              <Check size={18} strokeWidth={3} className="anim-check" />
              Hinzugefügt
            </>
          ) : saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Speichert…
            </>
          ) : (
            'Zum Tagebuch hinzufügen'
          )}
        </button>
      </Footer>
    </>
  )
}
