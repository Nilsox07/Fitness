import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, Info, ThumbsUp, Utensils } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import {
  DIET_MACROS,
  DIET_MACRO_HINT,
  DIET_MACRO_LABEL,
  DIET_RESTRICTIONS,
  DIET_RESTRICTION_LABEL,
  FASTING_HINT,
  FASTING_LABEL,
  FASTING_OPTIONS,
  fastingWindow,
  toggleRestriction,
  type DietStyle,
} from '../../lib/dietStyle'
import { DIET_MACRO_INFO, DIET_RESTRICTION_INFO, FASTING_INFO, type DietInfo } from '../../lib/dietInfo'

/** Aufklappbare Erklärung: Was ist das, für wen, Vorteile, worauf achten. */
function InfoBody({ info }: { info: DietInfo }) {
  return (
    <div className="anim-fade space-y-2.5 pt-1 text-[13px] leading-snug text-cocoa-light">
      <p className="text-cocoa">{info.what}</p>
      <p>
        <span className="font-semibold text-cocoa">Für wen: </span>
        {info.forWhom}
      </p>
      <ul className="space-y-1">
        {info.pros.map((p) => (
          <li key={p} className="flex gap-2">
            <ThumbsUp size={13} className="mt-0.5 shrink-0 text-success" />
            {p}
          </li>
        ))}
        {info.watch.map((w) => (
          <li key={w} className="flex gap-2">
            <Info size={13} className="mt-0.5 shrink-0 text-gold" />
            {w}
          </li>
        ))}
      </ul>
      {info.example && (
        <p className="flex gap-2 rounded-xl bg-sand/70 px-2.5 py-2">
          <Utensils size={13} className="mt-0.5 shrink-0 text-brand" />
          <span>{info.example}</span>
        </p>
      )}
      {info.warning && <Warning>{info.warning}</Warning>}
    </div>
  )
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-red-500/10 px-2.5 py-2 text-[13px] leading-snug text-red-600 dark:text-red-400">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Auswahlzeile mit Haken (Radio oder Mehrfachauswahl) und „Mehr erfahren“. */
function OptionRow({
  selected,
  multi,
  label,
  hint,
  info,
  onSelect,
}: {
  selected: boolean
  multi?: boolean
  label: string
  hint?: string
  info?: DietInfo
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`rounded-2xl p-3.5 transition ${selected ? 'bg-brand/[0.07] ring-2 ring-brand' : 'bg-cream ring-1 ring-transparent'}`}
    >
      <button
        type="button"
        role={multi ? 'checkbox' : 'radio'}
        aria-checked={selected}
        onClick={onSelect}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center ${multi ? 'rounded-md' : 'rounded-full'} ${
            selected ? 'bg-brand text-on-brand' : 'ring-2 ring-inset ring-sand-dark'
          }`}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-cocoa">{label}</span>
          {hint && <span className="block text-xs leading-snug text-cocoa-light">{hint}</span>}
        </span>
      </button>
      {info && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="ml-8 mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand"
          >
            {open ? 'Weniger' : 'Mehr erfahren'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="ml-8">
              <InfoBody info={info} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function MacroSheet({
  diet,
  onChange,
  onClose,
}: {
  diet: DietStyle
  onChange: (d: DietStyle) => void
  onClose: () => void
}) {
  return (
    <PremiumSheet
      title="Ernährungsweise"
      subtitle="Bestimmt, wie sich deine Kalorien verteilen"
      onClose={onClose}
      bodyClassName="space-y-2"
    >
      {DIET_MACROS.map((m) => (
        <OptionRow
          key={m}
          selected={diet.macro === m}
          label={DIET_MACRO_LABEL[m]}
          hint={DIET_MACRO_HINT[m]}
          info={DIET_MACRO_INFO[m]}
          onSelect={() => onChange({ ...diet, macro: m })}
        />
      ))}
      <Done onClose={onClose} />
    </PremiumSheet>
  )
}

export function RestrictionSheet({
  diet,
  onChange,
  onClose,
}: {
  diet: DietStyle
  onChange: (d: DietStyle) => void
  onClose: () => void
}) {
  return (
    <PremiumSheet
      title="Einschränkungen"
      subtitle="Mehrfachauswahl möglich"
      onClose={onClose}
      bodyClassName="space-y-2"
    >
      {DIET_RESTRICTIONS.map((r) => (
        <OptionRow
          key={r}
          multi
          selected={diet.restrictions.includes(r)}
          label={DIET_RESTRICTION_LABEL[r]}
          info={DIET_RESTRICTION_INFO[r]}
          onSelect={() => onChange({ ...diet, restrictions: toggleRestriction(diet.restrictions, r) })}
        />
      ))}
      <p className="px-1 pt-1 text-xs text-cocoa-muted">Mahlzeit-Score, Rezepte und KI achten darauf.</p>
      <Done onClose={onClose} />
    </PremiumSheet>
  )
}

export function FastingSheet({
  diet,
  onChange,
  onClose,
}: {
  diet: DietStyle
  onChange: (d: DietStyle) => void
  onClose: () => void
}) {
  const win = fastingWindow(diet)
  return (
    <PremiumSheet
      title="Intervallfasten"
      subtitle="Optional – wann du isst"
      onClose={onClose}
      bodyClassName="space-y-2"
    >
      {FASTING_OPTIONS.map((f) => (
        <OptionRow
          key={f}
          selected={diet.fasting === f}
          label={f === 'none' ? 'Kein Fasten' : FASTING_LABEL[f]}
          hint={f === 'none' ? 'Essen, wann es passt' : FASTING_HINT[f]}
          info={f === 'none' ? undefined : FASTING_INFO[f]}
          onSelect={() => onChange({ ...diet, fasting: f })}
        />
      ))}
      {win && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5">
          <label className="text-sm font-semibold" htmlFor="fasting-start">
            Essensfenster ab
          </label>
          <div className="flex items-center gap-2">
            <input
              id="fasting-start"
              type="time"
              step={900}
              className="input tabular w-28 rounded-xl py-1.5"
              value={diet.fastingStart}
              onChange={(e) => e.target.value && onChange({ ...diet, fastingStart: e.target.value })}
            />
            <span className="tabular text-sm text-cocoa-light">bis {win.end}</span>
          </div>
        </div>
      )}
      <Done onClose={onClose} />
    </PremiumSheet>
  )
}

function Done({ onClose }: { onClose: () => void }) {
  return (
    <div className="pt-2">
      <button className="btn-primary w-full rounded-2xl py-3" onClick={onClose}>
        Fertig
      </button>
    </div>
  )
}

/** Allgemeine Einfachauswahl (Aktivität). */
export function ChoiceSheet<T extends string>({
  title,
  subtitle,
  value,
  options,
  onChange,
  onClose,
}: {
  title: string
  subtitle?: string
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
  onClose: () => void
}) {
  return (
    <PremiumSheet title={title} subtitle={subtitle} onClose={onClose} bodyClassName="space-y-2">
      {options.map((o) => (
        <OptionRow
          key={o.value}
          selected={value === o.value}
          label={o.label}
          hint={o.hint}
          onSelect={() => {
            onChange(o.value)
            onClose()
          }}
        />
      ))}
    </PremiumSheet>
  )
}
