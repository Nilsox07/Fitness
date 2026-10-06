import { useMemo, useState } from 'react'
import { BookmarkPlus, Check, Clock, Sparkles } from 'lucide-react'
import { RECIPE_CATALOG, type CatalogRecipe } from '../../lib/recipeCatalog'
import {
  catalogAsSaved,
  dietSummary,
  fitsDiet,
  recommendReason,
  recommendRecipes,
  type RecommendContext,
} from '../../lib/recipeRecommend'
import { DIET_RESTRICTION_LABEL } from '../../lib/dietStyle'
import { scoreMeal } from '../../lib/mealScore'
import { GOAL_LABEL } from '../../lib/nutrition'
import { useAddRecipe } from '../../hooks/useRecipes'
import { stagger } from '../nutrition-home/motion'
import { RecipeCover, RecipeGridCard } from './RecipeCards'
import { RecipeDetailSheet, type RecipeDayContext } from './RecipeDetailSheet'
import { currentMeal, recipeLogEntry, recipeTotals } from './recipeUtils'
import { localDate } from '../../lib/day'
import type { Meal } from '../../types'

type Filter = 'all' | 'breakfast' | 'main' | 'snack' | 'quick'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'main', label: 'Mittag & Abend' },
  { id: 'snack', label: 'Snacks' },
  { id: 'quick', label: 'Bis 15 Min' },
]

function matches(r: CatalogRecipe, f: Filter): boolean {
  if (f === 'breakfast') return r.meal.includes('breakfast')
  if (f === 'main') return r.meal.includes('lunch') || r.meal.includes('dinner')
  if (f === 'snack') return r.meal.includes('snack')
  if (f === 'quick') return r.minutes <= 15
  return true
}

/** „Entdecken": kuratierte Rezepte zum direkt Nachkochen, passend zu Ziel & Ernährungsweise. */
export function RecipeDiscover({
  ctx,
  day,
  query,
  savedTitles,
  onLog,
}: {
  ctx: RecommendContext
  day: RecipeDayContext
  query: string
  /** Titel bereits gespeicherter Rezepte (für „gespeichert") */
  savedTitles: Set<string>
  onLog: (entry: ReturnType<typeof recipeLogEntry>) => Promise<unknown>
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const addRecipe = useAddRecipe()

  const suitable = useMemo(() => RECIPE_CATALOG.filter((r) => showAll || fitsDiet(r, ctx.diet)), [ctx.diet, showAll])
  const hiddenCount = RECIPE_CATALOG.length - RECIPE_CATALOG.filter((r) => fitsDiet(r, ctx.diet)).length
  const forYou = useMemo(() => recommendRecipes(RECIPE_CATALOG, ctx, 6), [ctx])

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      suitable.filter(
        (r) =>
          matches(r, filter) &&
          (!q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q))),
      ),
    [suitable, filter, q],
  )

  const open = openId ? (RECIPE_CATALOG.find((r) => r.id === openId) ?? null) : null
  const log = (r: CatalogRecipe, portions: number, meal: Meal) =>
    onLog(recipeLogEntry(catalogAsSaved(r), portions, meal, localDate()))

  return (
    <div className="space-y-5">
      <p className="text-xs text-cocoa-light" style={stagger(1)}>
        Passend zu <span className="font-semibold text-cocoa">{dietSummary(ctx.diet)}</span>
        {ctx.goal && (
          <>
            {' · Ziel '}
            <span className="font-semibold text-cocoa">{GOAL_LABEL[ctx.goal]}</span>
          </>
        )}
      </p>

      {!q && forYou.length > 0 && (
        <section className="space-y-2.5" style={stagger(1)}>
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-cocoa-muted">
              <Sparkles size={13} className="text-brand" /> Für dich jetzt
            </h2>
            {ctx.remainingKcal != null && (
              <span className="tabular text-xs text-cocoa-muted">noch {ctx.remainingKcal} kcal heute</span>
            )}
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {forYou.map((r, i) => (
              <button
                key={r.id}
                className="flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-cream text-left transition active:scale-[0.98]"
                onClick={() => setOpenId(r.id)}
                style={stagger(i + 1, 50)}
              >
                <RecipeCover recipe={r} iconSize={44} className="h-28 w-full">
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-semibold text-cocoa shadow-sm backdrop-blur">
                    <Clock size={11} /> {r.minutes} Min
                  </span>
                </RecipeCover>
                <div className="space-y-1.5 p-3">
                  <div className="truncate text-sm font-semibold text-cocoa">{r.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular truncate text-xs text-cocoa-light">
                      {Math.round(r.kcal)} kcal · {Math.round(r.protein)} g E
                    </span>
                  </div>
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    <Check size={11} strokeWidth={3} className="shrink-0" />
                    <span className="truncate">{recommendReason(r, ctx)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" style={stagger(2)}>
        {FILTERS.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            aria-pressed={filter === c.id}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              filter === c.id ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3">
          {visible.map((r, i) => {
            const saved = catalogAsSaved(r)
            return (
              <RecipeGridCard
                key={r.id}
                recipe={saved}
                score={scoreMeal(recipeTotals(saved), { goal: day.goal, remainingKcal: day.remainingKcal })}
                mine
                onOpen={() => setOpenId(r.id)}
                onQuickLog={() => log(r, 1, currentMeal())}
                style={stagger(Math.min(i, 8) + 3, 45)}
              />
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-cream px-5 py-8 text-center text-sm text-cocoa-light">
          Keine passenden Rezepte für diesen Filter.
        </p>
      )}

      {hiddenCount > 0 && (
        <button
          className="w-full text-center text-xs font-semibold text-cocoa-light"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll
            ? 'Nur passende Rezepte zeigen'
            : `${hiddenCount} weitere Rezepte passen nicht zu deiner Ernährungsweise – trotzdem zeigen`}
        </button>
      )}

      {open && (
        <RecipeDetailSheet
          key={open.id}
          recipe={catalogAsSaved(open)}
          mine={false}
          day={day}
          defaultMeal={currentMeal()}
          onLog={(p, m) => log(open, p, m)}
          onToggleShared={() => {}}
          onDelete={() => {}}
          onClose={() => setOpenId(null)}
          badges={[`${open.minutes} Min`, ...open.restrictions.map((x) => DIET_RESTRICTION_LABEL[x])].filter(
            (b, i, a) => a.indexOf(b) === i && !(b === 'Pescetarisch' && a.includes('Vegetarisch')),
          )}
          extra={
            <div className="flex items-center gap-3 rounded-2xl bg-sand-light p-3">
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold text-cocoa">{recommendReason(open, ctx)}</div>
                <div className="text-xs text-cocoa-light">
                  {fitsDiet(open, ctx.diet)
                    ? `Passt zu ${dietSummary(ctx.diet)}`
                    : 'Passt nicht ganz zu deiner Ernährungsweise'}
                </div>
              </div>
              {savedTitles.has(open.title) ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                  <Check size={14} strokeWidth={3} /> Gespeichert
                </span>
              ) : (
                <button
                  className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand disabled:opacity-60"
                  disabled={addRecipe.isPending}
                  onClick={() => {
                    const { id: _id, user_id: _u, created_at: _c, ...input } = catalogAsSaved(open)
                    addRecipe.mutate(input)
                  }}
                >
                  <BookmarkPlus size={14} /> {addRecipe.isPending ? 'Speichere…' : 'Speichern'}
                </button>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}
