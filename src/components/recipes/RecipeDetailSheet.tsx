import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Ellipsis, Loader2, Minus, Plus, Share2, Trash2, TriangleAlert, X } from 'lucide-react'
import { scoreMeal } from '../../lib/mealScore'
import { MEALS, MEAL_LABEL, type Meal, type NutritionGoal, type SavedRecipe } from '../../types'
import { ScoreRing, TONE_TEXT } from '../food/ScoreRing'
import { MacroBar } from '../food/MacroBar'
import { NutrientList } from '../food/NutrientList'
import { useCountUp } from '../food/useCountUp'
import { FriendChip, RecipeCover } from './RecipeCards'
import { fmtPortions, recipeTotals } from './recipeUtils'

/** Tageskontext für Score und Nährwert-Prozente. */
export interface RecipeDayContext {
  goal: NutritionGoal | null
  /** Noch offene kcal heute (null = kein Ziel) */
  remainingKcal: number | null
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

const MIN_P = 0.5
const MAX_P = 10

/** Rezept-Detail als Bottom-Sheet: Hero, Portionen, Score, Makros, Zutaten, Schritte, Loggen. */
export function RecipeDetailSheet({
  recipe,
  mine,
  day,
  defaultMeal,
  onLog,
  onToggleShared,
  onDelete,
  onClose,
  badges = [],
  extra,
}: {
  recipe: SavedRecipe
  mine: boolean
  day: RecipeDayContext
  defaultMeal: Meal
  /** Loggt `portions` Portionen; wirft bei Fehler. */
  onLog: (portions: number, meal: Meal) => Promise<unknown>
  onToggleShared: () => void
  onDelete: () => void
  onClose: () => void
  /** Zusätzliche Chips im Kopf (z. B. „15 Min", „Vegan") */
  badges?: string[]
  /** Zusätzlicher Inhalt oben im Sheet (z. B. Empfehlungsgrund, Speichern) */
  extra?: ReactNode
}) {
  const titleId = useId()
  const [portions, setPortions] = useState(1)
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  const [menu, setMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totals = useMemo(() => recipeTotals(recipe, portions), [recipe, portions])
  const score = useMemo(
    () => scoreMeal(totals, { goal: day.goal, remainingKcal: day.remainingKcal }),
    [totals, day.goal, day.remainingKcal],
  )
  const bigKcal = Math.round(useCountUp(totals.kcal))

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(saving)
  busyRef.current = saving

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busyRef.current) return
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Nach dem Loggen kurz den Haken zeigen, dann schließen
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => closeRef.current(), 700)
    return () => clearTimeout(t)
  }, [done])

  async function log() {
    if (saving || done) return
    setError(null)
    setSaving(true)
    try {
      await onLog(portions, meal)
      try {
        navigator.vibrate?.(10)
      } catch {
        /* ignore */
      }
      setDone(true)
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
      setError(`Hinzufügen fehlgeschlagen${detail}. Bitte nochmal versuchen.`)
    } finally {
      setSaving(false)
    }
  }

  const step = (d: number) => setPortions((p) => Math.min(MAX_P, Math.max(MIN_P, p + d)))
  const overlayBtn =
    'grid h-9 w-9 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md transition active:scale-90'

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-bg shadow-2xl"
        onClick={(e) => {
          e.stopPropagation()
          if (menu) setMenu(false)
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Hero */}
          <RecipeCover recipe={recipe} iconSize={64} iconClassName="-translate-y-5" className="h-56 w-full">
            <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-2.5">
              <div className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/60" />
              <button className={`${overlayBtn} mt-2`} onClick={onClose} disabled={saving} aria-label="Schließen">
                <X size={18} strokeWidth={2.5} />
              </button>
              {mine && (
                <div className="relative mt-2">
                  <button
                    className={overlayBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenu((m) => !m)
                    }}
                    aria-label="Rezept-Aktionen"
                    aria-haspopup="menu"
                    aria-expanded={menu}
                  >
                    <Ellipsis size={18} strokeWidth={2.5} />
                  </button>
                  {menu && (
                    <div
                      role="menu"
                      className="anim-fade absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-2xl bg-bg py-1 text-sm text-cocoa shadow-xl ring-1 ring-sand-dark/50"
                    >
                      <button
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-sand-light"
                        onClick={() => {
                          onToggleShared()
                          setMenu(false)
                        }}
                      >
                        {recipe.shared ? (
                          <Check size={16} className="text-success" />
                        ) : (
                          <Share2 size={16} className="text-cocoa-light" />
                        )}
                        {recipe.shared ? 'Nicht mehr teilen' : 'Mit Freunden teilen'}
                      </button>
                      <button
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-red-500 hover:bg-sand-light dark:text-red-400"
                        onClick={() => {
                          setMenu(false)
                          if (confirm(`„${recipe.title}" löschen?`)) onDelete()
                        }}
                      >
                        <Trash2 size={16} />
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-5 pb-4 pt-16">
              <h2 id={titleId} className="line-clamp-2 text-2xl font-bold leading-tight text-white drop-shadow-sm">
                {recipe.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="tabular rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  {bigKcal} kcal
                </span>
                {mine && recipe.shared && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    geteilt
                  </span>
                )}
                {badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </RecipeCover>

          <div className="space-y-7 px-5 pb-6 pt-5">
            {extra}
            {!mine && recipe.author_name && (
              <div className="-mt-1 flex items-center gap-1.5 text-xs text-cocoa-light">
                Geteilt von <FriendChip name={recipe.author_name} className="text-xs font-semibold text-cocoa" />
              </div>
            )}

            {/* Portionen */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-cocoa">Portionen</div>
                <div className="text-xs text-cocoa-muted">
                  Rezept ergibt {fmtPortions(Math.max(1, recipe.servings || 1))}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-sand p-1">
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-bg text-cocoa shadow-sm transition active:scale-90 disabled:opacity-40"
                  onClick={() => step(-0.5)}
                  disabled={portions <= MIN_P}
                  aria-label="Weniger Portionen"
                >
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <span className="tabular min-w-[2.5rem] text-center text-base font-bold text-cocoa" aria-live="polite">
                  {fmtPortions(portions)}
                </span>
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-bg text-cocoa shadow-sm transition active:scale-90 disabled:opacity-40"
                  onClick={() => step(0.5)}
                  disabled={portions >= MAX_P}
                  aria-label="Mehr Portionen"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Score */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={score.score} tone={score.tone} />
                <div className="min-w-0 flex-1">
                  <div className={`text-lg font-bold ${TONE_TEXT[score.tone]}`}>{score.label}</div>
                  <p className="mt-0.5 text-sm leading-snug text-cocoa-light">
                    Mahlzeit-Score für {fmtPortions(portions)} {portions === 1 ? 'Portion' : 'Portionen'}
                  </p>
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

            <Section title="Nährwerte">
              <NutrientList
                totals={totals}
                targets={{ protein: day.proteinTarget, carbs: day.carbsTarget, fat: day.fatTarget }}
              />
            </Section>

            {recipe.ingredients.length > 0 && (
              <Section
                title="Zutaten"
                right={
                  <span className="text-xs text-cocoa-muted">
                    für {fmtPortions(Math.max(1, recipe.servings || 1))}{' '}
                    {(recipe.servings || 1) === 1 ? 'Portion' : 'Portionen'}
                  </span>
                }
              >
                <ul className="divide-y divide-sand-dark/60 rounded-2xl bg-cream px-4">
                  {recipe.ingredients.map((it, i) => (
                    <li key={i} className="flex items-start gap-3 py-3 text-sm text-cocoa">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      <span className="min-w-0 flex-1">{it}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {recipe.steps.length > 0 && (
              <Section title="Zubereitung">
                <ol className="space-y-4">
                  {recipe.steps.map((st, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-cocoa">{st}</p>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-3 border-t border-sand-dark/50 bg-bg/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Mahlzeit">
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
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full gap-2 py-3 disabled:opacity-60" onClick={log} disabled={saving || done}>
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
              <>
                Zum Tagebuch hinzufügen
                <span className="tabular font-normal opacity-80">· {totals.kcal} kcal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

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
