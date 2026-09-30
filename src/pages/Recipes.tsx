import { useMemo, useState } from 'react'
import { Check, ChevronDown, PenLine, Plus, Search, Share2, Sparkles, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { useAiStatus } from '../hooks/useAi'
import { useRecipes, useToggleRecipeShared, useDeleteRecipe } from '../hooks/useRecipes'
import { useAddFoodEntry } from '../hooks/useNutrition'
import { RecipeCreateSheet, type CreateMode } from '../components/recipes/RecipeCreateSheet'
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

/** Eine Portion als Ernährungseintrag (für die aktuelle Mahlzeit). */
function logEntry(r: SavedRecipe) {
  return {
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
  }
}

function RecipeCard({ r, mine }: { r: SavedRecipe; mine: boolean }) {
  const [open, setOpen] = useState(false)
  const toggle = useToggleRecipeShared()
  const del = useDeleteRecipe()
  const addEntry = useAddFoodEntry()

  function log() {
    addEntry.mutate(logEntry(r))
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

function ClassicRecipes() {
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

// ---------------------------------------------------------------------------
// Neuer Modus: Suche, Filter-Chips, 1-Tap-Loggen, Erstellen per Sheet
// ---------------------------------------------------------------------------

type Filter = 'all' | 'protein' | 'friends'

/** Proteinreich: ≥ 30 g pro Portion oder ≥ 30 % der kcal aus Eiweiß. */
function isHighProtein(r: SavedRecipe): boolean {
  return r.protein >= 30 || (r.kcal > 0 && (r.protein * 4) / r.kcal >= 0.3)
}

function NewRecipeCard({ r, mine }: { r: SavedRecipe; mine: boolean }) {
  const [open, setOpen] = useState(false)
  const [logged, setLogged] = useState(false)
  const toggle = useToggleRecipeShared()
  const del = useDeleteRecipe()
  const addEntry = useAddFoodEntry()

  function log() {
    addEntry.mutate(logEntry(r), {
      onSuccess: () => {
        setLogged(true)
        setTimeout(() => setLogged(false), 1500)
      },
    })
  }

  return (
    <li className="card space-y-2">
      <div className="flex items-center gap-3">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.title}</div>
            <div className="tabular text-xs text-cocoa-light">
              {r.kcal} kcal · E {r.protein} g pro Portion
              {!mine && r.author_name ? ` · von ${r.author_name}` : ''}
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`shrink-0 text-cocoa-light transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-colors duration-200 ${
            logged ? 'bg-success' : 'bg-brand'
          }`}
          onClick={log}
          disabled={addEntry.isPending}
          aria-label={`1 Portion „${r.title}" loggen`}
        >
          {logged ? <Check size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
        </button>
      </div>

      {open && (
        <div className="anim-fade space-y-2 rounded-xl bg-sand-light p-3">
          <div className="tabular text-xs text-cocoa-light">
            E {r.protein} / K {r.carbs} / F {r.fat} g · {r.servings} Portion(en)
          </div>
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
          {mine && (
            <div className="flex items-center gap-2 pt-1">
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
                className="ml-auto flex items-center gap-1 px-2 text-xs text-cocoa-muted hover:text-red-500 dark:hover:text-red-400"
                onClick={() => {
                  if (confirm(`„${r.title}" löschen?`)) del.mutate(r.id)
                }}
              >
                <X size={14} />
                Löschen
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function NewRecipes() {
  const { user } = useAuth()
  const { data: recipes, isLoading } = useRecipes()
  const { data: ai } = useAiStatus()
  const aiOn = !!ai?.enabled
  const [sheet, setSheet] = useState<CreateMode | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const all = recipes ?? []
  const hasFriends = all.some((r) => r.user_id !== user?.id)
  const activeFilter: Filter = filter === 'friends' && !hasFriends ? 'all' : filter

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (recipes ?? []).filter((r) => {
      if (activeFilter === 'protein' && !isHighProtein(r)) return false
      if (activeFilter === 'friends' && r.user_id === user?.id) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q)) ||
        (r.author_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [recipes, query, activeFilter, user])

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Alle' },
    { id: 'protein', label: 'Proteinreich' },
    ...(hasFriends ? [{ id: 'friends' as const, label: 'Von Freunden' }] : []),
  ]

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Rezepte</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setSheet('menu')}>
          <Plus size={16} strokeWidth={2.5} />
          Rezept
        </button>
      </header>

      {isLoading && <p className="text-cocoa-light">Lädt…</p>}

      {!isLoading && all.length === 0 ? (
        <div className="card space-y-3 text-center">
          <p className="text-sm text-cocoa-light">Noch keine Rezepte — leg dein erstes an.</p>
          <div className="flex flex-col gap-2">
            {aiOn && (
              <button
                className="btn-primary flex items-center justify-center gap-1.5"
                onClick={() => setSheet('ai')}
              >
                <Sparkles size={16} />
                Mit KI erstellen
              </button>
            )}
            <button
              className={`${aiOn ? 'btn-ghost' : 'btn-primary'} flex items-center justify-center gap-1.5`}
              onClick={() => setSheet('manual')}
            >
              <PenLine size={16} />
              Selbst eintragen
            </button>
          </div>
        </div>
      ) : (
        all.length > 0 && (
          <>
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted"
              />
              <input
                className="input pl-10"
                type="search"
                placeholder="Rezepte oder Zutaten suchen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
              {chips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    activeFilter === c.id ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {visible.map((r) => (
                <NewRecipeCard key={r.id} r={r} mine={r.user_id === user?.id} />
              ))}
            </ul>
            {visible.length === 0 && (
              <p className="text-center text-sm text-cocoa-light">Keine Treffer.</p>
            )}
          </>
        )
      )}

      {sheet && <RecipeCreateSheet initial={sheet} aiEnabled={aiOn} onClose={() => setSheet(null)} />}
    </div>
  )
}

export default function Recipes() {
  const { isNew } = usePrefs()
  return isNew ? <NewRecipes /> : <ClassicRecipes />
}
