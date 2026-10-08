import { useState, type ReactNode } from 'react'
import { ChevronRight, Link2, PenLine, Sparkles } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { useAuth } from '../../lib/auth'
import { useAddRecipe } from '../../hooks/useRecipes'
import { recipeFromText, type ImportedRecipe, type Recipe } from '../../lib/ai'
import { ImportRecipeForm } from './ImportRecipeForm'

export type CreateMode = 'menu' | 'ai' | 'manual' | 'link'

/** Bottom-Sheet: neues Rezept per KI erzeugen oder selbst eintragen. */
export function RecipeCreateSheet({
  initial = 'menu',
  initialText = '',
  aiEnabled,
  onClose,
  onImported,
}: {
  initial?: CreateMode
  /** Geteilter Text/Link (Teilen-Menü) für den Import */
  initialText?: string
  aiEnabled: boolean
  onClose: () => void
  /** Erkanntes Import-Rezept in der großen Ansicht zeigen */
  onImported?: (r: ImportedRecipe) => void
}) {
  const [mode, setMode] = useState<CreateMode>((initial === 'ai' || initial === 'link') && !aiEnabled ? 'menu' : initial)
  const title =
    mode === 'ai'
      ? 'Rezept mit KI'
      : mode === 'manual'
        ? 'Rezept eintragen'
        : mode === 'link'
          ? 'Rezept übernehmen'
          : 'Neues Rezept'

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === 'menu' && (
        <div className="space-y-2">
          {aiEnabled && (
            <OptionButton
              icon={<Link2 size={20} />}
              title="Von TikTok, Insta & Co."
              sub="Link oder Screenshot – Rezept wird übernommen"
              onClick={() => setMode('link')}
            />
          )}
          {aiEnabled && (
            <OptionButton
              icon={<Sparkles size={20} />}
              title="Mit KI erstellen"
              sub="Beschreib, worauf du Lust hast"
              onClick={() => setMode('ai')}
            />
          )}
          <OptionButton
            icon={<PenLine size={20} />}
            title="Selbst eintragen"
            sub="Titel, Nährwerte, Zutaten, Zubereitung"
            onClick={() => setMode('manual')}
          />
        </div>
      )}
      {mode === 'ai' && <AiRecipeForm onDone={onClose} />}
      {mode === 'manual' && <ManualRecipeForm onDone={onClose} />}
      {mode === 'link' && <ImportRecipeForm initialText={initialText} onDone={onClose} onRecognized={onImported} />}
    </Sheet>
  )
}

function OptionButton({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: ReactNode
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl bg-sand-light p-3 text-left transition-colors duration-200 hover:bg-sand"
      onClick={onClick}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-cocoa">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-cocoa-light">{sub}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />
    </button>
  )
}

function useAuthorName() {
  const { user } = useAuth()
  return user?.email?.split('@')[0] ?? null
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="text-sm text-red-500 dark:text-red-400">{msg}</p>
}

function AiRecipeForm({ onDone }: { onDone: () => void }) {
  const addRecipe = useAddRecipe()
  const author = useAuthorName()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [shared, setShared] = useState(false)

  async function generate() {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setRecipe(await recipeFromText(prompt.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Fehler beim Rezept')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!recipe) return
    setError(null)
    try {
      await addRecipe.mutateAsync({
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        kcal: recipe.nutrition.kcal,
        protein: recipe.nutrition.protein,
        carbs: recipe.nutrition.carbs,
        fat: recipe.nutrition.fat,
        fiber: recipe.nutrition.fiber,
        sugar: recipe.nutrition.sugar,
        sat_fat: recipe.nutrition.sat_fat,
        salt: recipe.nutrition.salt,
        shared,
        author_name: author,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="z. B. schnelles Proteinfrühstück"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          autoFocus
        />
        <button
          className="btn-primary flex shrink-0 items-center gap-1.5"
          onClick={generate}
          disabled={busy || !prompt.trim()}
        >
          <Sparkles size={16} />
          {busy ? 'Denkt…' : recipe ? 'Neu' : 'Los'}
        </button>
      </div>
      <ErrorLine msg={error} />

      {recipe && (
        <div className="anim-fade space-y-2 rounded-xl bg-sand-light p-3">
          <div className="font-semibold">{recipe.title}</div>
          <div className="tabular text-xs text-cocoa-light">
            {recipe.nutrition.kcal} kcal · E {recipe.nutrition.protein} / K {recipe.nutrition.carbs} / F{' '}
            {recipe.nutrition.fat} g pro Portion · {recipe.servings} Portion(en)
          </div>
          {recipe.ingredients.length > 0 && (
            <div>
              <div className="text-sm font-semibold">Zutaten</div>
              <ul className="list-disc pl-5 text-sm">
                {recipe.ingredients.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          )}
          {recipe.steps.length > 0 && (
            <div>
              <div className="text-sm font-semibold">Zubereitung</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {recipe.steps.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {recipe && (
        <>
          <SharedToggle shared={shared} onChange={setShared} />
          <button className="btn-primary w-full" onClick={save} disabled={addRecipe.isPending}>
            {addRecipe.isPending ? 'Speichert…' : 'Rezept speichern'}
          </button>
        </>
      )}
    </div>
  )
}

function SharedToggle({ shared, onChange }: { shared: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-cocoa-light">
      <input type="checkbox" checked={shared} onChange={(e) => onChange(e.target.checked)} />
      Mit Freunden teilen
    </label>
  )
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function num(s: string): number {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function ManualRecipeForm({ onDone }: { onDone: () => void }) {
  const addRecipe = useAddRecipe()
  const author = useAuthorName()
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState('1')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim()) {
      setError('Bitte einen Titel eingeben.')
      return
    }
    setError(null)
    try {
      await addRecipe.mutateAsync({
        title: title.trim(),
        servings: Math.max(1, Math.round(num(servings)) || 1),
        ingredients: lines(ingredients),
        steps: lines(steps),
        kcal: Math.round(num(kcal)),
        protein: Math.round(num(protein)),
        carbs: Math.round(num(carbs)),
        fat: Math.round(num(fat)),
        fiber: 0,
        sugar: 0,
        sat_fat: 0,
        salt: 0,
        shared,
        author_name: author,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    }
  }

  const numField = (label: string, value: string, set: (v: string) => void) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input tabular"
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="0"
      />
    </label>
  )

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Titel</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {numField('Portionen', servings, setServings)}
        {numField('kcal / Portion', kcal, setKcal)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {numField('Eiweiß g', protein, setProtein)}
        {numField('KH g', carbs, setCarbs)}
        {numField('Fett g', fat, setFat)}
      </div>
      <label className="block">
        <span className="label">Zutaten (eine pro Zeile)</span>
        <textarea
          className="input min-h-[5rem]"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="label">Zubereitung (ein Schritt pro Zeile)</span>
        <textarea className="input min-h-[5rem]" value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <SharedToggle shared={shared} onChange={setShared} />
      <ErrorLine msg={error} />
      <button className="btn-primary w-full" onClick={save} disabled={addRecipe.isPending}>
        {addRecipe.isPending ? 'Speichert…' : 'Rezept speichern'}
      </button>
    </div>
  )
}
