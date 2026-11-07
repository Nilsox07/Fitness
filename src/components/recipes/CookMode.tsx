import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChefHat, ChevronLeft, Heart, Loader2, ShoppingBasket, Timer, X } from 'lucide-react'
import { useBackClose } from '../../lib/backStack'
import { cancelCookTimer, haptic, scheduleCookTimer } from '../../lib/native'
import {
  fmtDurationShort,
  fmtTimer,
  ingredientsInStep,
  parseStepDuration,
  portionFactor,
  scaleIngredient,
} from '../../lib/cooking'
import { addToShoppingList } from '../../lib/shoppingExtras'
import { MEALS, MEAL_LABEL, type Meal, type SavedRecipe } from '../../types'
import { fmtPortions, recipeTotals } from './recipeUtils'

type Stage = 'portions' | 'ingredients' | 'steps' | 'finish'

const PEOPLE = [1, 2, 3, 4]
const LOG_PORTIONS = [0.5, 1, 1.5, 2]

/**
 * Nachkochen im Vollbild: 1. für wie viele, 2. Zutaten abhaken (Fehlendes → Einkaufsliste),
 * 3. Schritte einzeln mit Timer, 4. „Fertig gekocht?“ → ins Tagebuch.
 */
export function CookMode({
  recipe,
  defaultMeal,
  onLog,
  onSaveRecipe,
  onClose,
  onDone,
}: {
  recipe: SavedRecipe
  defaultMeal: Meal
  /** Loggt Portionen (1 = eine Rezept-Portion); wirft bei Fehler */
  onLog: (portions: number, meal: Meal) => Promise<unknown>
  /** Rezept in „Meine Rezepte“ speichern (nur wenn noch nicht gespeichert) */
  onSaveRecipe?: () => Promise<unknown>
  onClose: () => void
  /** Nach dem Eintragen (schließt auch das Rezept) */
  onDone: () => void
}) {
  const servings = Math.max(1, Number(recipe.servings) || 1)
  const hasIngredients = recipe.ingredients.length > 0
  const hasSteps = recipe.steps.length > 0
  const stages = useMemo<Stage[]>(
    () => [
      ...(hasIngredients ? (['portions', 'ingredients'] as Stage[]) : []),
      ...(hasSteps ? (['steps'] as Stage[]) : []),
      'finish',
    ],
    [hasIngredients, hasSteps],
  )
  const [stage, setStage] = useState<Stage>(stages[0])
  const [people, setPeople] = useState(() => Math.min(4, Math.max(1, Math.round(servings))))
  const [have, setHave] = useState<Set<number>>(new Set())
  const [missing, setMissing] = useState<Set<number>>(new Set())
  const [stepIdx, setStepIdx] = useState(0)

  // Timer
  const [timer, setTimer] = useState<{ endAt: number; total: number; step: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const left = timer ? Math.max(0, (timer.endAt - now) / 1000) : 0
  const ringing = !!timer && left <= 0

  // Abschluss
  const [logPortions, setLogPortions] = useState(1)
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  const [save, setSave] = useState(!!onSaveRecipe)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy
  const close = () => {
    if (busyRef.current) return
    void cancelCookTimer()
    closeRef.current()
  }
  useBackClose(close)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sekundentakt nur, solange ein Timer läuft
  useEffect(() => {
    if (!timer) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [timer])

  // Ablauf: kurz vibrieren
  useEffect(() => {
    if (!ringing) return
    void haptic('success')
    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      /* ignore */
    }
  }, [ringing])

  const factor = portionFactor(people, servings)
  const ingredients = useMemo(
    () => recipe.ingredients.map((it) => scaleIngredient(it, factor)),
    [recipe.ingredients, factor],
  )
  const stepText = recipe.steps[stepIdx] ?? ''
  const stepSec = parseStepDuration(stepText)
  // Zutaten dieses Schritts mit Menge (passend zur gewählten Portionenzahl)
  const stepIngredients = useMemo(() => ingredientsInStep(stepText, ingredients), [stepText, ingredients])

  const pos = stages.indexOf(stage)
  const next = () => setStage(stages[Math.min(stages.length - 1, pos + 1)])
  const back = () => setStage(stages[Math.max(0, pos - 1)])

  function startTimer(sec: number) {
    const endAt = Date.now() + sec * 1000
    setTimer({ endAt, total: sec, step: stepIdx })
    void scheduleCookTimer(endAt, recipe.steps[stepIdx] ?? recipe.title)
    void haptic()
  }
  function stopTimer() {
    setTimer(null)
    void cancelCookTimer()
  }

  function toggle(set: Set<number>, i: number, apply: (s: Set<number>) => void) {
    const n = new Set(set)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    apply(n)
  }

  function markMissing(i: number) {
    if (missing.has(i)) return
    addToShoppingList(ingredients[i])
    setMissing((s) => new Set(s).add(i))
    setHave((s) => {
      const n = new Set(s)
      n.delete(i)
      return n
    })
    void haptic()
  }

  async function finish() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onLog(logPortions, meal)
      if (save && onSaveRecipe) await onSaveRecipe().catch(() => undefined)
      void cancelCookTimer()
      void haptic('success')
      onDone()
    } catch (e) {
      const detail = e instanceof Error && e.message ? ` (${e.message})` : ''
      setError(`Eintragen fehlgeschlagen${detail}. Bitte nochmal versuchen.`)
    } finally {
      setBusy(false)
    }
  }

  const kcal = recipeTotals(recipe, logPortions).kcal
  const iconBtn = 'grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Nachkochen: ${recipe.title}`}
      className="anim-fade fixed inset-0 z-[60] flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-cocoa"
    >
      {/* Kopf */}
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pb-2 pt-3">
        <button className={iconBtn} onClick={close} disabled={busy} aria-label="Nachkochen beenden">
          <X size={18} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Nachkochen</p>
          <h2 className="truncate font-semibold leading-tight">{recipe.title}</h2>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-md gap-1.5 px-4" aria-hidden>
        {stages.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= pos ? 'bg-brand' : 'bg-sand'}`} />
        ))}
      </div>

      {/* Laufender Timer (bleibt sichtbar, auch in anderen Schritten) */}
      {timer && (
        <div className="mx-auto w-full max-w-md px-4 pt-3">
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${ringing ? 'bg-brand text-on-brand' : 'bg-brand/10'}`}
            role="timer"
            aria-live={ringing ? 'assertive' : 'off'}
          >
            <Timer size={18} className={ringing ? '' : 'text-brand'} />
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {ringing ? 'Zeit ist um!' : `Schritt ${timer.step + 1}`}
            </span>
            {!ringing && <span className="tabular text-lg font-bold">{fmtTimer(left)}</span>}
            <button
              className={`rounded-full px-3 py-1 text-xs font-semibold ${ringing ? 'bg-white/20' : 'bg-bg text-cocoa'}`}
              onClick={stopTimer}
            >
              {ringing ? 'OK' : 'Stopp'}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        {stage === 'portions' && (
          <div key="portions" className="anim-fade space-y-5">
            <h3 className="text-2xl font-bold leading-tight">Für wie viele kochst du?</h3>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Portionen">
              {PEOPLE.map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={people === p}
                  onClick={() => setPeople(p)}
                  className={`tabular rounded-2xl py-5 text-2xl font-bold transition active:scale-95 ${
                    people === p ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-sm text-cocoa-light">
              Rezept ergibt {fmtPortions(servings)} {servings === 1 ? 'Portion' : 'Portionen'} – alle Mengen passen sich
              an.
            </p>
          </div>
        )}

        {stage === 'ingredients' && (
          <div key="ingredients" className="anim-fade space-y-4">
            <div>
              <h3 className="text-2xl font-bold leading-tight">Hast du alles da?</h3>
              <p className="mt-1 text-sm text-cocoa-light">
                Für {people} {people === 1 ? 'Portion' : 'Portionen'} · {have.size}/{ingredients.length} bereit
              </p>
            </div>
            <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
              {ingredients.map((it, i) => {
                const ok = have.has(i)
                const miss = missing.has(i)
                return (
                  <li key={i} className="flex min-h-[3.25rem] items-center gap-3 pl-3 pr-2">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                      aria-pressed={ok}
                      onClick={() => toggle(have, i, setHave)}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          ok ? 'bg-success text-white' : 'ring-2 ring-inset ring-sand-dark'
                        }`}
                      >
                        {ok && <Check size={15} strokeWidth={3} className="anim-check" />}
                      </span>
                      <span className={`min-w-0 flex-1 text-[15px] ${ok ? 'text-cocoa-light line-through' : ''}`}>
                        {it}
                      </span>
                    </button>
                    {miss ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-cocoa-light">
                        <ShoppingBasket size={13} /> Auf der Liste
                      </span>
                    ) : (
                      !ok && (
                        <button
                          className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand transition active:scale-95"
                          onClick={() => markMissing(i)}
                          aria-label={`${it}: fehlt mir, auf die Einkaufsliste`}
                        >
                          Fehlt mir
                        </button>
                      )
                    )}
                  </li>
                )
              })}
            </ul>
            {missing.size > 0 && (
              <p className="flex items-center gap-1.5 px-1 text-xs text-cocoa-light">
                <ShoppingBasket size={13} /> {missing.size} auf der Einkaufsliste unter „Fehlt mir“
              </p>
            )}
          </div>
        )}

        {stage === 'steps' && (
          <div key={`step-${stepIdx}`} className="anim-fade space-y-6">
            <p className="tabular text-sm font-semibold text-brand">
              {stepIdx + 1} von {recipe.steps.length}
            </p>
            <p className="text-2xl font-semibold leading-snug">{stepText}</p>
            {stepIngredients.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Dafür</p>
                <ul className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
                  {stepIngredients.map((it) => (
                    <li key={it} className="px-4 py-2.5 text-[15px]">
                      <IngredientLine text={it} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stepSec && !(timer && timer.step === stepIdx) && (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand/10 py-3.5 font-semibold text-brand transition active:scale-[0.98]"
                onClick={() => startTimer(stepSec)}
              >
                <Timer size={18} /> Timer {fmtDurationShort(stepSec)} starten
              </button>
            )}
          </div>
        )}

        {stage === 'finish' && (
          <div key="finish" className="anim-fade space-y-5">
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-brand">
                <ChefHat size={30} />
              </span>
              <h3 className="text-2xl font-bold leading-tight">Fertig gekocht?</h3>
              <p className="text-sm text-cocoa-light">Wie viel isst du davon?</p>
            </div>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Gegessene Portionen">
              {LOG_PORTIONS.map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={logPortions === p}
                  onClick={() => setLogPortions(p)}
                  className={`tabular rounded-2xl py-3 text-lg font-bold transition active:scale-95 ${
                    logPortions === p ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
                  }`}
                >
                  {fmtPortions(p)}
                </button>
              ))}
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Mahlzeit">
              {MEALS.map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={meal === m}
                  onClick={() => setMeal(m)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-200 ${
                    meal === m ? 'bg-brand font-semibold text-on-brand' : 'bg-sand text-cocoa-light'
                  }`}
                >
                  {MEAL_LABEL[m]}
                </button>
              ))}
            </div>
            {onSaveRecipe && (
              <button
                role="switch"
                aria-checked={save}
                onClick={() => setSave((v) => !v)}
                className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left"
              >
                <Heart size={18} className={save ? 'fill-brand text-brand' : 'text-cocoa-muted'} />
                <span className="min-w-0 flex-1 text-sm font-semibold">In „Meine Rezepte“ speichern</span>
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${save ? 'bg-success' : 'bg-sand-dark'}`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${save ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
            )}
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fuß */}
      <div className="mx-auto flex w-full max-w-md gap-2 border-t border-sand-dark/50 px-4 pb-4 pt-3">
        {(pos > 0 || (stage === 'steps' && stepIdx > 0)) && (
          <button
            className="btn-ghost gap-1 px-4 py-3"
            disabled={busy}
            onClick={() => (stage === 'steps' && stepIdx > 0 ? setStepIdx((i) => i - 1) : back())}
          >
            <ChevronLeft size={18} /> Zurück
          </button>
        )}
        {stage === 'finish' ? (
          <button className="btn-primary min-w-0 flex-1 gap-2 py-3" onClick={finish} disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
            Eintragen <span className="tabular font-normal opacity-80">· {kcal} kcal</span>
          </button>
        ) : (
          <button
            className="btn-primary min-w-0 flex-1 py-3"
            onClick={() => (stage === 'steps' && stepIdx < recipe.steps.length - 1 ? setStepIdx((i) => i + 1) : next())}
          >
            {stage === 'steps' && stepIdx === recipe.steps.length - 1 ? 'Fertig' : 'Weiter'}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Menge fett, Rest normal: „**150 g** Magerquark“. */
function IngredientLine({ text }: { text: string }) {
  const m = /^\s*([\d½¼¾⅓⅔⅛.,/–-]+\s*(?:[a-zA-ZäöüÄÖÜ.]{1,8}\b)?)\s*(.*)$/.exec(text)
  if (!m || !/\d|[½¼¾⅓⅔⅛]/.test(m[1])) return <span>{text}</span>
  return (
    <span>
      <span className="tabular font-semibold text-cocoa">{m[1].trim()}</span>{' '}
      <span className="text-cocoa-light">{m[2]}</span>
    </span>
  )
}
