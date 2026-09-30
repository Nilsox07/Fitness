import { useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, Share2, X } from 'lucide-react'
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
      <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{r.title}</div>
          <div className="tabular text-xs text-cocoa-light">
            {!mine && r.author_name ? `von ${r.author_name} · ` : ''}
            {r.kcal} kcal · E {r.protein} / K {r.carbs} / F {r.fat} · {r.servings} Portion(en)
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`mt-0.5 shrink-0 text-cocoa-light transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="anim-fade space-y-2 rounded-xl bg-sand-light p-3">
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
        <button
          className="btn-ghost flex items-center gap-1.5 text-sm"
          onClick={log}
          disabled={addEntry.isPending}
        >
          <Plus size={16} />
          Loggen
        </button>
        {mine && (
          <>
            <button
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 ${
                r.shared ? 'bg-success/10 text-success' : 'bg-sand text-cocoa-light'
              }`}
              onClick={() => toggle.mutate({ id: r.id, shared: !r.shared })}
            >
              {r.shared ? <Check size={14} strokeWidth={2.5} /> : <Share2 size={14} />}
              {r.shared ? 'geteilt' : 'Teilen'}
            </button>
            <button
              className="ml-auto px-2 text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
              aria-label="Rezept löschen"
              onClick={() => {
                if (confirm(`„${r.title}" löschen?`)) del.mutate(r.id)
              }}
            >
              <X size={18} />
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
              Noch keine. Erstelle Rezepte im Tab „Plan" („Rezept" pro Mahlzeit) oder über „Heute →
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
