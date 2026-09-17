import { useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useRecipes, useToggleRecipeShared, useDeleteRecipe } from '../hooks/useRecipes'
import { useAddFoodEntry } from '../hooks/useNutrition'
import type { Meal, SavedRecipe } from '../types'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
function currentMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

function RecipeCard({ r, mine }: { r: SavedRecipe; mine: boolean }) {
  const [open, setOpen] = useState(false)
  const toggle = useToggleRecipeShared()
  const del = useDeleteRecipe()
  const addEntry = useAddFoodEntry()

  function log() {
    addEntry.mutate({
      date: today(),
      name: `🍽️ ${r.title}`,
      amount_g: null,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber: r.fiber ?? 0,
      sugar: r.sugar ?? 0,
      sat_fat: r.sat_fat ?? 0,
      salt: r.salt ?? 0,
      barcode: null,
      meal: currentMeal(),
    })
  }

  return (
    <li className="card space-y-2">
      <button className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="font-semibold">{r.title}</div>
        <div className="text-xs text-cocoa-light">
          {!mine && r.author_name ? `von ${r.author_name} · ` : ''}
          {r.kcal} kcal · E {r.protein} / K {r.carbs} / F {r.fat} · {r.servings} Portion(en)
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-sand-dark pt-2">
          {r.ingredients.length > 0 && (
            <div>
              <div className="text-sm font-semibold">Zutaten</div>
              <ul className="list-disc pl-5 text-sm text-cocoa">
                {r.ingredients.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          )}
          {r.steps.length > 0 && (
            <div>
              <div className="text-sm font-semibold">Zubereitung</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-cocoa">
                {r.steps.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost text-sm" onClick={log} disabled={addEntry.isPending}>
          + Loggen
        </button>
        {mine && (
          <>
            <button
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                r.shared ? 'bg-brand text-white' : 'bg-sand-light text-cocoa-light ring-1 ring-sand-dark'
              }`}
              onClick={() => toggle.mutate({ id: r.id, shared: !r.shared })}
            >
              {r.shared ? '✓ geteilt' : 'Teilen'}
            </button>
            <button
              className="ml-auto px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
              aria-label="Rezept löschen"
              onClick={() => {
                if (confirm(`„${r.title}" löschen?`)) del.mutate(r.id)
              }}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export default function Recipes() {
  const { user } = useAuth()
  const { data: recipes, isLoading } = useRecipes()

  const { mine, friends } = useMemo(() => {
    const mine: SavedRecipe[] = []
    const friends: SavedRecipe[] = []
    for (const r of recipes ?? []) (r.user_id === user?.id ? mine : friends).push(r)
    return { mine, friends }
  }, [recipes, user])

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="text-xl font-bold">Rezepte</h1>
      </header>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      <div>
        <h2 className="mb-2 font-semibold">Meine Rezepte</h2>
        <ul className="space-y-2">
          {mine.map((r) => (
            <RecipeCard key={r.id} r={r} mine />
          ))}
          {mine.length === 0 && !isLoading && (
            <li className="text-sm text-cocoa-light">
              Noch keine. Erstelle Rezepte im Tab „Plan" (🍳 pro Mahlzeit) oder über „Heute →
              Hinzufügen → Rezept" und speichere sie.
            </li>
          )}
        </ul>
      </div>

      {friends.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Von Freunden geteilt</h2>
          <ul className="space-y-2">
            {friends.map((r) => (
              <RecipeCard key={r.id} r={r} mine={false} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
