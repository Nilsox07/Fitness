import type { CSSProperties } from 'react'
import { LoaderCircle, Sparkles, X } from 'lucide-react'
import { MicButton } from '../MicButton'
import { fmtInt } from '../../lib/nutritionHome'

const DAY_OPTIONS = [3, 7, 14]

/** Dunkle Hero-Karte „Dein Ernährungsplan": Tage, Wünsche, Ziel und großer Erstellen-Knopf. */
export function PlanHero({
  days,
  onDays,
  wish,
  onWish,
  targets,
  routineCount,
  busy,
  hasPlan,
  onGenerate,
  onCancel,
  style,
}: {
  days: number
  onDays: (d: number) => void
  wish: string
  onWish: (w: string) => void
  targets: { kcal: number; protein: number }
  routineCount: number
  busy: boolean
  hasPlan: boolean
  onGenerate: () => void
  /** nur wenn schon ein Plan existiert: zurück zum Plan */
  onCancel?: () => void
  style?: CSSProperties
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={style}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            <Sparkles size={13} className="text-brand" />
            {hasPlan ? 'Neuer Plan' : 'KI-Planer'}
          </p>
          {onCancel && (
            <button
              className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full bg-bg/10 text-bg/80 transition active:scale-90 dark:bg-white/5 dark:text-cocoa-light"
              onClick={onCancel}
              aria-label="Zurück zum aktuellen Plan"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Dein Ernährungsplan</h2>
        <p className="mt-1 text-sm text-bg/70 dark:text-cocoa-light">
          Mahlzeiten passend zu deinem Ziel — mit Rezepten und fertiger Einkaufsliste.
        </p>

        <div className="mt-4 flex gap-1 rounded-full bg-bg/10 p-1 dark:bg-white/5" role="radiogroup" aria-label="Anzahl Tage">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={days === d}
              onClick={() => onDays(d)}
              className={`tabular flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
                days === d ? 'bg-bg text-cocoa shadow-sm dark:bg-cream' : 'text-bg/70 dark:text-cocoa-light'
              }`}
            >
              {d} Tage
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-xl bg-bg/10 px-3 py-2.5 text-sm text-bg outline-none ring-1 ring-bg/15 placeholder:text-bg/45 focus:ring-2 focus:ring-brand dark:bg-cream dark:text-cocoa dark:ring-sand-dark dark:placeholder:text-cocoa-muted"
            placeholder="Wünsche: proteinreich, vegetarisch, günstig …"
            value={wish}
            onChange={(e) => onWish(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && onGenerate()}
            aria-label="Wünsche für den Plan"
          />
          <MicButton onResult={(t) => onWish(wish ? wish + ' ' + t : t)} />
        </div>

        <p className="tabular mt-2.5 text-xs text-bg/60 dark:text-cocoa-light">
          Ziel ~{fmtInt(targets.kcal)} kcal · {fmtInt(targets.protein)} g Eiweiß pro Tag
          {routineCount > 0 && ` · ${routineCount} ${routineCount === 1 ? 'Routine' : 'Routinen'}`}
        </p>

        <button
          className="btn-primary mt-4 w-full gap-2 py-3.5 text-base shadow-lg shadow-brand/30"
          onClick={onGenerate}
          disabled={busy}
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {busy ? 'Erstelle Plan…' : 'Plan erstellen'}
        </button>
      </div>
    </section>
  )
}
