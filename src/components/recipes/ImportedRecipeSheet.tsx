import { useState } from 'react'
import { BookmarkCheck, BookmarkPlus, ExternalLink, Loader2, TriangleAlert } from 'lucide-react'
import type { ImportedRecipe } from '../../lib/ai'
import { useAuth } from '../../lib/auth'
import { localDate } from '../../lib/day'
import { useAddRecipe } from '../../hooks/useRecipes'
import { useAddFoodEntry } from '../../hooks/useNutrition'
import type { SavedRecipe } from '../../types'
import { RecipeDetailSheet, type RecipeDayContext } from './RecipeDetailSheet'
import { currentMeal, recipeLogEntry } from './recipeUtils'

function asSaved(r: ImportedRecipe): SavedRecipe {
  return {
    id: 'import',
    user_id: 'import',
    author_name: null,
    title: r.title,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    kcal: r.nutrition.kcal,
    protein: r.nutrition.protein,
    carbs: r.nutrition.carbs,
    fat: r.nutrition.fat,
    fiber: r.nutrition.fiber,
    sugar: r.nutrition.sugar,
    sat_fat: r.nutrition.sat_fat,
    salt: r.nutrition.salt,
    shared: false,
    created_at: '',
  }
}

/** Erkanntes Rezept (TikTok, Insta, Screenshot …) in der großen Ansicht mit Score, Makros & Speichern. */
export function ImportedRecipeSheet({
  recipe,
  day,
  onClose,
}: {
  recipe: ImportedRecipe
  day: RecipeDayContext
  onClose: () => void
}) {
  const { user } = useAuth()
  const addRecipe = useAddRecipe()
  const addEntry = useAddFoodEntry()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved0 = asSaved(recipe)

  async function save() {
    if (saved || addRecipe.isPending) return
    setError(null)
    try {
      await addRecipe.mutateAsync({
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.url ? [...recipe.steps, `Original: ${recipe.source} – ${recipe.url}`] : recipe.steps,
        kcal: recipe.nutrition.kcal,
        protein: recipe.nutrition.protein,
        carbs: recipe.nutrition.carbs,
        fat: recipe.nutrition.fat,
        fiber: recipe.nutrition.fiber,
        sugar: recipe.nutrition.sugar,
        sat_fat: recipe.nutrition.sat_fat,
        salt: recipe.nutrition.salt,
        shared: false,
        author_name: user?.email?.split('@')[0] ?? null,
      })
      setSaved(true)
      try {
        navigator.vibrate?.(10)
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <RecipeDetailSheet
      recipe={saved0}
      mine={false}
      day={day}
      defaultMeal={currentMeal()}
      onLog={(p, m) => addEntry.mutateAsync(recipeLogEntry(saved0, p, m, localDate()))}
      onToggleShared={() => {}}
      onDelete={() => {}}
      onClose={onClose}
      heroImage={recipe.image}
      badges={[recipe.source, ...(recipe.guessed ? ['Mengen ergänzt'] : [])]}
      extra={
        <div className="space-y-2">
          {recipe.guessed && (
            <p className="flex gap-2 rounded-2xl bg-gold/10 p-3 text-sm text-cocoa">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-gold" />
              Im Beitrag standen keine vollständigen Mengen – Buddy hat ein typisches Rezept ergänzt. Kurz prüfen.
            </p>
          )}
          {recipe.url && (
            <a
              href={recipe.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
            >
              <ExternalLink size={14} /> Original auf {recipe.source} ansehen
            </a>
          )}
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>
      }
      footerAction={
        <button
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-95 ${
            saved ? 'bg-success/10 text-success' : 'bg-sand text-cocoa'
          }`}
          onClick={save}
          disabled={saved || addRecipe.isPending}
          aria-label={saved ? 'Gespeichert' : 'In meine Rezepte speichern'}
        >
          {addRecipe.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : saved ? (
            <BookmarkCheck size={18} />
          ) : (
            <BookmarkPlus size={18} />
          )}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      }
    />
  )
}
