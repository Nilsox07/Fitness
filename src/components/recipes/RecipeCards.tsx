import { useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Plus } from 'lucide-react'
import type { MealScore, ScoreTone } from '../../lib/mealScore'
import type { SavedRecipe } from '../../types'
import { coverGradient, recipeIcon } from './recipeUtils'

const TONE_DOT: Record<ScoreTone, string> = {
  great: 'bg-success',
  good: 'bg-success/75',
  ok: 'bg-gold',
  poor: 'bg-red-500 dark:bg-red-400',
}

/** Farbiger Platzhalter-Kopf (keine Fotos): Verlauf aus dem Titel + großes Icon. */
export function RecipeCover({
  recipe,
  iconSize = 40,
  className = '',
  iconClassName = '',
  children,
}: {
  recipe: Pick<SavedRecipe, 'title' | 'ingredients'>
  iconSize?: number
  className?: string
  iconClassName?: string
  children?: ReactNode
}) {
  const Icon = recipeIcon(recipe.title, recipe.ingredients)
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Verlauf (im Dark Mode leicht abgedunkelt) + dezente Lichtkreise für Tiefe */}
      <div
        className="pointer-events-none absolute inset-0 dark:brightness-[.85]"
        style={{ backgroundImage: coverGradient(recipe.title) }}
      >
        <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-black/5" />
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/95">
        <Icon size={iconSize} strokeWidth={1.6} className={`drop-shadow-sm ${iconClassName}`} aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}

/** Kleiner Score-Badge: farbiger Punkt + Zahl. */
export function ScoreBadge({ score, className = '' }: { score: MealScore; className?: string }) {
  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-semibold text-cocoa shadow-sm backdrop-blur ${className}`}
      title={`Score ${score.score} · ${score.label}`}
      aria-label={`Score ${score.score} von 100, ${score.label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[score.tone]}`} />
      {score.score}
    </span>
  )
}

/** Avatar-Kreis mit Initiale + Name des Freundes. */
export function FriendChip({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] text-cocoa-light ${className}`}>
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/15 text-[9px] font-bold uppercase text-brand">
        {name.charAt(0)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}

/** Rasterkarte (2 Spalten): Cover, Titel, kcal/Eiweiß, Score, ggf. Freund + 1-Tap-Loggen. */
export function RecipeGridCard({
  recipe,
  score,
  mine,
  onOpen,
  onQuickLog,
  style,
}: {
  recipe: SavedRecipe
  score: MealScore
  mine: boolean
  onOpen: () => void
  /** 1 Portion zur aktuellen Mahlzeit loggen; resolved = gespeichert */
  onQuickLog: () => Promise<unknown>
  style?: CSSProperties
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')

  async function quickLog() {
    if (state !== 'idle') return
    setState('busy')
    try {
      await onQuickLog()
      setState('done')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('idle')
    }
  }

  return (
    <li className="relative" style={style}>
      <button
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-cream text-left transition active:scale-[0.98]"
        onClick={onOpen}
      >
        <RecipeCover recipe={recipe} className="aspect-[4/3] w-full">
          <ScoreBadge score={score} className="absolute left-2 top-2" />
        </RecipeCover>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-cocoa">
            {recipe.title}
          </div>
          <div className="tabular text-xs text-cocoa-light">
            {Math.round(recipe.kcal)} kcal · {Math.round(recipe.protein)} g E
          </div>
          {!mine && recipe.author_name && <FriendChip name={recipe.author_name} className="mt-0.5" />}
        </div>
      </button>
      <button
        className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full shadow-sm backdrop-blur transition active:scale-90 ${
          state === 'done' ? 'bg-success text-white' : 'bg-bg/90 text-brand'
        }`}
        onClick={quickLog}
        disabled={state === 'busy'}
        aria-label={`1 Portion „${recipe.title}" loggen`}
      >
        {state === 'done' ? (
          <Check size={16} strokeWidth={3} className="anim-check" />
        ) : (
          <Plus size={16} strokeWidth={2.75} />
        )}
      </button>
    </li>
  )
}

/** Karussell-Karte „Für dich": breit, mit „passt zu heute"-Chip. */
export function ForYouCard({
  recipe,
  onOpen,
  style,
}: {
  recipe: SavedRecipe
  onOpen: () => void
  style?: CSSProperties
}) {
  return (
    <button
      className="flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-cream text-left transition active:scale-[0.98]"
      onClick={onOpen}
      style={style}
    >
      <RecipeCover recipe={recipe} iconSize={44} className="h-28 w-full" />
      <div className="space-y-1.5 p-3">
        <div className="truncate text-sm font-semibold text-cocoa">{recipe.title}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="tabular truncate text-xs text-cocoa-light">
            {Math.round(recipe.kcal)} kcal · {Math.round(recipe.protein)} g E
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            <Check size={11} strokeWidth={3} />
            passt zu heute
          </span>
        </div>
      </div>
    </button>
  )
}
