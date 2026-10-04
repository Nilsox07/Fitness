import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, ChevronRight, Share2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { localDate } from '../../lib/day'
import { kcalTargetFor, trainedOn } from '../../lib/dayTarget'
import { scoreMeal } from '../../lib/mealScore'
import { useRecipes } from '../../hooks/useRecipes'
import { useAddFoodEntry, useFoodEntries, useNutritionSettings } from '../../hooks/useNutrition'
import { useAllSets } from '../../hooks/useWorkouts'
import type { Meal, SavedRecipe } from '../../types'
import { FriendChip, RecipeCover, ScoreBadge } from '../recipes/RecipeCards'
import { RecipeDetailSheet, type RecipeDayContext } from '../recipes/RecipeDetailSheet'
import { currentMeal, recipeLogEntry, recipeTotals } from '../recipes/recipeUtils'
import { SectionTitle } from '../community/ui'

/** Karussell der Rezepte, die Freunde geteilt haben; Tippen öffnet das Rezept-Detail. */
export function SharedRecipesRow({ style }: { style?: CSSProperties }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: recipes, isLoading } = useRecipes()
  const [openId, setOpenId] = useState<string | null>(null)

  const shared = useMemo(
    () => (recipes ?? []).filter((r) => r.user_id !== user?.id && r.shared),
    [recipes, user?.id],
  )
  const ownCount = (recipes ?? []).filter((r) => r.user_id === user?.id).length
  const open = openId ? shared.find((r) => r.id === openId) ?? null : null

  if (isLoading) return null

  return (
    <section style={style}>
      <SectionTitle
        right={
          <button className="flex items-center text-sm font-semibold text-brand" onClick={() => navigate('/recipes')}>
            Rezepte
            <ChevronRight size={16} />
          </button>
        }
      >
        Von Freunden geteilt
      </SectionTitle>

      {shared.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]">
          {shared.map((r, i) => (
            <SharedCard
              key={r.id}
              recipe={r}
              onOpen={() => setOpenId(r.id)}
              style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${Math.min(i, 6) * 50}ms` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-cream p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success/10 text-success">
            <ChefHat size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Noch keine geteilten Rezepte</div>
            <p className="text-xs text-cocoa-light">
              {ownCount > 0
                ? 'Teile eins deiner Rezepte — dann ziehen deine Freunde vielleicht nach.'
                : 'Leg ein Rezept an und teile es mit deinen Freunden.'}
            </p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
            onClick={() => navigate('/recipes')}
            aria-label="Zu den Rezepten"
          >
            <Share2 size={16} />
          </button>
        </div>
      )}

      {open && <SharedRecipeSheet recipe={open} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function SharedCard({ recipe, onOpen, style }: { recipe: SavedRecipe; onOpen: () => void; style?: CSSProperties }) {
  const score = useMemo(() => scoreMeal(recipeTotals(recipe)), [recipe])
  return (
    <button
      className="flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-cream text-left transition active:scale-[0.98]"
      onClick={onOpen}
      style={style}
    >
      <RecipeCover recipe={recipe} iconSize={36} className="h-24 w-full">
        <ScoreBadge score={score} className="absolute left-2 top-2" />
      </RecipeCover>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-cocoa">{recipe.title}</div>
        <div className="tabular text-xs text-cocoa-light">
          {Math.round(recipe.kcal)} kcal · {Math.round(recipe.protein)} g E
        </div>
        {recipe.author_name && <FriendChip name={recipe.author_name} className="mt-0.5" />}
      </div>
    </button>
  )
}

/** Rezept-Detail mit Tageskontext (wie auf der Rezeptseite) — nur Loggen, kein Teilen/Löschen. */
function SharedRecipeSheet({ recipe, onClose }: { recipe: SavedRecipe; onClose: () => void }) {
  const date = localDate()
  const { data: settings } = useNutritionSettings()
  const { data: entries } = useFoodEntries(date)
  const { data: allSets } = useAllSets()
  const addEntry = useAddFoodEntry()

  const day = useMemo<RecipeDayContext>(() => {
    const eaten = (entries ?? []).reduce((s, e) => s + (Number(e.kcal) || 0), 0)
    const target = kcalTargetFor(settings, trainedOn(date, allSets))
    return {
      goal: settings?.goal ?? null,
      remainingKcal: target > 0 ? Math.round(target - eaten) : null,
      proteinTarget: settings?.protein_target ?? 0,
      carbsTarget: settings?.carbs_target ?? 0,
      fatTarget: settings?.fat_target ?? 0,
    }
  }, [entries, settings, allSets, date])

  return (
    <RecipeDetailSheet
      key={recipe.id}
      recipe={recipe}
      mine={false}
      day={day}
      defaultMeal={currentMeal()}
      onLog={(p: number, m: Meal) => addEntry.mutateAsync(recipeLogEntry(recipe, p, m, localDate()))}
      onToggleShared={() => {}}
      onDelete={() => {}}
      onClose={onClose}
    />
  )
}
