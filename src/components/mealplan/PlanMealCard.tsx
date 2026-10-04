import type { CSSProperties, ReactNode } from 'react'
import { Check, ChefHat, LoaderCircle, Pencil, Plus, Repeat, Sparkles } from 'lucide-react'
import { MEAL_LABEL, type PlanMeal } from '../../types'
import { fmtInt } from '../../lib/nutritionHome'
import { MEAL_ICON } from './mealIcons'

/** Eine geplante Mahlzeit im Stil der MealCard: Icon, Gericht, Nährwerte, Aktionen. */
export function PlanMealCard({
  meal,
  logged,
  logging,
  recipeLoading,
  recipeDisabled,
  onLog,
  onRecipe,
  onEdit,
  onAdjust,
  style,
}: {
  meal: PlanMeal
  /** heute schon ins Tagebuch eingetragen */
  logged: boolean
  logging: boolean
  recipeLoading: boolean
  recipeDisabled: boolean
  onLog: () => void
  onRecipe: () => void
  onEdit: () => void
  onAdjust: () => void
  style?: CSSProperties
}) {
  const Icon = MEAL_ICON[meal.meal]
  return (
    <section className="card overflow-hidden p-0" style={style}>
      <div className="flex items-start gap-3 p-3 pl-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
            {MEAL_LABEL[meal.meal]}
            {meal.routine && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sand px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-cocoa-light">
                <Repeat size={10} /> Routine
              </span>
            )}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug">{meal.name}</h3>
          <p className="tabular mt-0.5 text-xs text-cocoa-light">
            <span className="font-semibold text-cocoa">{fmtInt(meal.kcal)} kcal</span>
            {` · E ${Math.round(meal.protein)} g`}
            <span className="text-cocoa-muted">{` · K ${Math.round(meal.carbs)} · F ${Math.round(meal.fat)}`}</span>
          </p>
        </div>
        <button
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-60 ${
            logged ? 'bg-success/15 text-success' : 'bg-brand/10 text-brand'
          }`}
          onClick={onLog}
          disabled={logging}
          aria-label={logged ? `${meal.name} nochmal heute eintragen` : `${meal.name} heute ins Tagebuch eintragen`}
          title="Heute eintragen"
        >
          {logging ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : logged ? (
            <Check size={20} strokeWidth={2.5} className="anim-check" />
          ) : (
            <Plus size={20} strokeWidth={2.5} />
          )}
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-t border-sand-dark/30 px-3 py-2 [scrollbar-width:none]">
        <Chip onClick={onRecipe} disabled={recipeDisabled}>
          {recipeLoading ? <LoaderCircle size={13} className="animate-spin" /> : <ChefHat size={13} />}
          Rezept
        </Chip>
        <Chip onClick={onEdit}>
          <Pencil size={13} />
          Bearbeiten
        </Chip>
        <Chip onClick={onAdjust}>
          <Sparkles size={13} className="text-brand" />
          KI anpassen
        </Chip>
      </div>
    </section>
  )
}

function Chip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="flex shrink-0 items-center gap-1 rounded-full bg-sand-light px-2.5 py-1.5 text-xs font-semibold text-cocoa-light ring-1 ring-sand-dark/60 transition active:scale-95 disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
