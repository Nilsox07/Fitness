import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Link2, PenLine, Plus, Search, Share2, Sparkles, X } from 'lucide-react'
import { MyBuddy } from '../components/buddy/MyBuddy'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { useAiStatus } from '../hooks/useAi'
import { useRecipes, useToggleRecipeShared, useDeleteRecipe } from '../hooks/useRecipes'
import { useAddFoodEntry, useDietStyle, useFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { useAllSets } from '../hooks/useWorkouts'
import { localDate } from '../lib/day'
import { kcalTargetFor, trainedOn } from '../lib/dayTarget'
import { scoreMeal, type MealScore } from '../lib/mealScore'
import { stagger } from '../components/nutrition-home/motion'
import { RecipeCreateSheet, type CreateMode } from '../components/recipes/RecipeCreateSheet'
import { ForYouCard, RecipeGridCard } from '../components/recipes/RecipeCards'
import { RecipeDetailSheet, type RecipeDayContext } from '../components/recipes/RecipeDetailSheet'
import { RecipeDiscover } from '../components/recipes/RecipeDiscover'
import { ImportedRecipeSheet } from '../components/recipes/ImportedRecipeSheet'
import type { ImportedRecipe } from '../lib/ai'
import type { RecommendContext } from '../lib/recipeRecommend'
import {
  currentMeal,
  isHighProtein,
  recipeLogEntry,
  recipeTotals,
  recipesForToday,
} from '../components/recipes/recipeUtils'
import type { Meal, SavedRecipe } from '../types'
import { useNutritionPrefs } from '../hooks/usePrefsSync'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
        <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={log} disabled={addEntry.isPending}>
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
              Noch keine. Erstelle Rezepte im Tab „Plan" („Rezept" pro Mahlzeit) oder über „Heute → Hinzufügen → Rezept"
              und speichere sie.
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
// Neuer Modus: „Für dich"-Karussell, Suche, Filter-Chips, 2-Spalten-Raster,
// Detail-Sheet mit Score/Makros/Nährwerten und Loggen; Erstellen per Sheet
// ---------------------------------------------------------------------------

type Filter = 'all' | 'protein' | 'friends'

function NewRecipes() {
  const { kcalBonus } = useNutritionPrefs()
  const { user } = useAuth()
  const { data: recipes, isLoading } = useRecipes()
  const { data: ai, isPending: aiPending } = useAiStatus()
  const aiOn = !!ai?.enabled
  const { data: settings } = useNutritionSettings()
  const date = localDate()
  const { data: entries } = useFoodEntries(date)
  const { data: allSets } = useAllSets()
  const addEntry = useAddFoodEntry()
  const toggle = useToggleRecipeShared()
  const del = useDeleteRecipe()

  const [sheet, setSheet] = useState<CreateMode | null>(null)
  const [importText, setImportText] = useState('')
  const [imported, setImported] = useState<ImportedRecipe | null>(null)
  const [params, setParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'discover' | 'mine'>('discover')
  const diet = useDietStyle()

  const all = useMemo(() => recipes ?? [], [recipes])
  const mineCount = all.filter((r) => r.user_id === user?.id).length

  // Über das Teilen-Menü (/share) geschickter Link → Import-Sheet öffnen.
  useEffect(() => {
    let shared = params.get('import')
    // Falls die App direkt nach dem Teilen auf eine neue Version neu lädt, ist der
    // Link aus der Adresse schon weg → aus dem Zwischenspeicher wiederholen.
    if (shared) {
      try {
        sessionStorage.setItem('pending_import', JSON.stringify({ text: shared, at: Date.now() }))
      } catch {
        /* ignore */
      }
    } else {
      try {
        const p = JSON.parse(sessionStorage.getItem('pending_import') || 'null') as { text: string; at: number } | null
        if (p && Date.now() - p.at < 60000) shared = p.text
      } catch {
        /* ignore */
      }
    }
    if (!shared || aiPending) return // erst wissen, ob die KI verfügbar ist
    setImportText(shared)
    setSheet('link')
    if (params.get('import')) setParams({}, { replace: true })
  }, [params, setParams, aiPending])

  // Neues eigenes Rezept gespeichert → „Meine Rezepte" zeigen.
  const prevMine = useRef<number | null>(null)
  useEffect(() => {
    if (isLoading) return
    if (prevMine.current != null && mineCount > prevMine.current) setTab('mine')
    prevMine.current = mineCount
  }, [mineCount, isLoading])
  const friendsCount = all.length - mineCount
  const hasFriends = friendsCount > 0
  const activeFilter: Filter = filter === 'friends' && !hasFriends ? 'all' : filter

  // Tageskontext: Rest-kcal/-Eiweiß für „Für dich" und den Score
  const day = useMemo<RecipeDayContext & { remainingProtein: number }>(() => {
    const eaten = (entries ?? []).reduce(
      (s, e) => ({ kcal: s.kcal + (Number(e.kcal) || 0), protein: s.protein + (Number(e.protein) || 0) }),
      { kcal: 0, protein: 0 },
    )
    const target = kcalTargetFor(settings, trainedOn(date, allSets), kcalBonus)
    const proteinTarget = settings?.protein_target ?? 0
    return {
      goal: settings?.goal ?? null,
      remainingKcal: target > 0 ? Math.round(target - eaten.kcal) : null,
      remainingProtein: Math.max(0, proteinTarget - eaten.protein),
      proteinTarget,
      carbsTarget: settings?.carbs_target ?? 0,
      fatTarget: settings?.fat_target ?? 0,
    }
  }, [entries, settings, allSets, date, kcalBonus])

  const recCtx = useMemo<RecommendContext>(
    () => ({
      goal: day.goal,
      diet,
      meal: currentMeal(),
      remainingKcal: day.remainingKcal,
      remainingProtein: day.remainingProtein,
    }),
    [day, diet],
  )
  const savedTitles = useMemo(() => new Set(all.filter((r) => r.user_id === user?.id).map((r) => r.title)), [all, user])

  const scores = useMemo(() => {
    const m = new Map<string, MealScore>()
    for (const r of all) m.set(r.id, scoreMeal(recipeTotals(r), { goal: day.goal, remainingKcal: day.remainingKcal }))
    return m
  }, [all, day.goal, day.remainingKcal])

  const forYou = useMemo(
    () => (all.length >= 3 ? recipesForToday(all, day.remainingKcal, day.remainingProtein) : []),
    [all, day.remainingKcal, day.remainingProtein],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((r) => {
      if (activeFilter === 'protein' && !isHighProtein(r)) return false
      if (activeFilter === 'friends' && r.user_id === user?.id) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q)) ||
        (r.author_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [all, query, activeFilter, user])

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Alle' },
    { id: 'protein', label: 'Proteinreich' },
    ...(hasFriends ? [{ id: 'friends' as const, label: 'Von Freunden' }] : []),
  ]

  const openRecipe = openId ? (all.find((r) => r.id === openId) ?? null) : null
  const searching = query.trim().length > 0
  const subtitle = [
    `${mineCount} ${mineCount === 1 ? 'eigenes' : 'eigene'}`,
    ...(hasFriends ? [`${friendsCount} von Freunden`] : []),
  ].join(' · ')

  const log = (r: SavedRecipe, portions: number, meal: Meal) =>
    addEntry.mutateAsync(recipeLogEntry(r, portions, meal, localDate()))

  const iconBtn = 'grid h-10 w-10 place-items-center rounded-full transition active:scale-90'

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2" style={stagger(0)}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Rezepte</h1>
          <p className="text-sm text-cocoa-light">
            {tab === 'discover' ? 'Zum direkt Nachkochen' : isLoading ? 'Lädt…' : subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(all.length > 0 || tab === 'discover') && (
            <button
              className={`${iconBtn} ${searchOpen ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa'}`}
              onClick={() => {
                if (searchOpen) setQuery('')
                setSearchOpen((o) => !o)
              }}
              aria-label={searchOpen ? 'Suche schließen' : 'Rezepte suchen'}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
          )}
          <button
            className={`${iconBtn} bg-brand text-on-brand shadow-sm`}
            onClick={() => setSheet('menu')}
            aria-label="Neues Rezept"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-full bg-sand p-1" role="tablist" style={stagger(0)}>
        {(
          [
            ['discover', 'Entdecken'],
            ['mine', 'Meine Rezepte'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full py-2 text-sm font-semibold transition ${
              tab === id ? 'bg-bg text-cocoa shadow-sm' : 'text-cocoa-light'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'discover' && searchOpen && (
        <div className="anim-fade relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted" />
          <input
            className="input pl-10"
            type="search"
            autoFocus
            placeholder="Rezepte oder Zutaten suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {tab === 'discover' && aiOn && !query.trim() && (
        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3 text-left transition active:scale-[0.99]"
          onClick={() => {
            setImportText('')
            setSheet('link')
          }}
          style={stagger(1)}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Link2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-cocoa">Rezept von TikTok, Insta & Co.</span>
            <span className="block text-xs text-cocoa-light">Link einfügen oder direkt an die App teilen</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
        </button>
      )}

      {tab === 'discover' && (
        <RecipeDiscover
          ctx={recCtx}
          day={day}
          query={query}
          savedTitles={savedTitles}
          onLog={(entry) => addEntry.mutateAsync(entry)}
        />
      )}

      {tab === 'mine' && (
        <>
          {isLoading && (
            <div className="grid grid-cols-2 gap-3" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-2xl bg-cream">
                  <div className="aspect-[4/3] animate-pulse bg-sand" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-sand" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-sand" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && all.length === 0 && <EmptyState aiOn={aiOn} onCreate={(m) => setSheet(m)} />}

          {!isLoading && all.length > 0 && (
            <>
              {searchOpen && (
                <div className="anim-fade relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted"
                  />
                  <input
                    className="input pl-10"
                    type="search"
                    autoFocus
                    placeholder="Rezepte oder Zutaten suchen"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setQuery('')
                        setSearchOpen(false)
                      }
                    }}
                  />
                </div>
              )}

              {forYou.length > 0 && !searching && activeFilter === 'all' && (
                <section className="space-y-2.5" style={stagger(1)}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[13px] font-semibold uppercase tracking-wide text-cocoa-muted">Für dich</h2>
                    {day.remainingKcal != null && (
                      <span className="tabular text-xs text-cocoa-muted">noch {day.remainingKcal} kcal heute</span>
                    )}
                  </div>
                  <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {forYou.map((r, i) => (
                      <ForYouCard key={r.id} recipe={r} onOpen={() => setOpenId(r.id)} style={stagger(i + 1, 50)} />
                    ))}
                  </div>
                </section>
              )}

              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" style={stagger(2)}>
                {chips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    aria-pressed={activeFilter === c.id}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                      activeFilter === c.id ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {visible.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3">
                  {visible.map((r, i) => (
                    <RecipeGridCard
                      key={r.id}
                      recipe={r}
                      score={scores.get(r.id)!}
                      mine={r.user_id === user?.id}
                      onOpen={() => setOpenId(r.id)}
                      onQuickLog={() => log(r, 1, currentMeal())}
                      style={stagger(Math.min(i, 8) + 3, 45)}
                    />
                  ))}
                </ul>
              ) : (
                <div className="anim-fade flex flex-col items-center gap-2 rounded-2xl bg-cream px-5 py-8 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-sand text-cocoa-light">
                    <Search size={22} />
                  </div>
                  <p className="text-sm font-semibold text-cocoa">Keine Treffer</p>
                  <p className="text-xs text-cocoa-light">Anderen Suchbegriff oder Filter probieren.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {openRecipe && (
        <RecipeDetailSheet
          key={openRecipe.id}
          recipe={openRecipe}
          mine={openRecipe.user_id === user?.id}
          day={day}
          defaultMeal={currentMeal()}
          onLog={(p, m) => log(openRecipe, p, m)}
          onToggleShared={() => toggle.mutate({ id: openRecipe.id, shared: !openRecipe.shared })}
          onDelete={() => {
            del.mutate(openRecipe.id)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
      {sheet && (
        <RecipeCreateSheet
          initial={sheet}
          initialText={importText}
          aiEnabled={aiOn}
          onClose={() => {
            clearPendingImport()
            setSheet(null)
            setImportText('')
          }}
          onImported={(r) => {
            clearPendingImport()
            setSheet(null)
            setImportText('')
            setImported(r)
          }}
        />
      )}
      {imported && <ImportedRecipeSheet recipe={imported} day={day} onClose={() => setImported(null)} />}
    </div>
  )
}

/** Leerer Zustand: großes Icon + zwei Kacheln (KI / selbst). */
function EmptyState({ aiOn, onCreate }: { aiOn: boolean; onCreate: (m: CreateMode) => void }) {
  const tile =
    'flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-5 text-sm font-semibold transition active:scale-95'
  return (
    <div className="space-y-6 pt-6" style={stagger(1)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 rounded-full bg-brand/10 blur-xl" aria-hidden />
          <MyBuddy size={96} mood="hungry" className="relative" />
        </div>
        <div>
          <p className="text-lg font-bold text-cocoa">Noch keine Rezepte</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-sm text-cocoa-light">
            Leg dein erstes Rezept an — mit Nährwerten, Zutaten und Zubereitung.
          </p>
        </div>
      </div>
      <div className={`grid gap-3 ${aiOn ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {aiOn && (
          <button className={`${tile} bg-brand text-on-brand`} onClick={() => onCreate('ai')}>
            <Sparkles size={24} />
            Mit KI erstellen
          </button>
        )}
        <button
          className={`${tile} ${aiOn ? 'bg-cream text-cocoa hover:bg-sand-light' : 'bg-brand text-on-brand'}`}
          onClick={() => onCreate('manual')}
        >
          <PenLine size={24} className={aiOn ? 'text-brand' : ''} />
          Selbst eintragen
        </button>
      </div>
    </div>
  )
}

function clearPendingImport() {
  try {
    sessionStorage.removeItem('pending_import')
  } catch {
    /* ignore */
  }
}

export default function Recipes() {
  const { isNew } = usePrefs()
  return isNew ? <NewRecipes /> : <ClassicRecipes />
}
