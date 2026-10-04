import type { ReactNode } from 'react'
import { Cable, Check, Dumbbell, Flame, PersonStanding, Sparkles, Weight, Zap } from 'lucide-react'
import {
  EQUIPMENT_OPTIONS,
  FOCUS_OPTIONS,
  INTENSITY_OPTIONS,
  QUICK_MINUTES,
  QUICK_PRESETS,
  WARMUP_SECONDS,
  planStructure,
  type QuickConfig,
  type QuickEquipment,
  type QuickPreset,
} from '../../lib/quickWorkout'
import { SectionTitle } from '../food-progress/ui'
import { enter } from '../exercises/muscle'

export type QuickSettings = Omit<QuickConfig, 'seed'>

const EQUIP_ICON: Record<QuickEquipment, ReactNode> = {
  none: <PersonStanding size={16} />,
  dumbbell: <Dumbbell size={16} />,
  band: <Cable size={16} />,
  kettlebell: <Weight size={16} />,
}

/** Auswahl-Kachel: aktiv = Brand-Fläche, sonst ruhiges Sand. */
function Tile({
  on,
  onClick,
  children,
  className = '',
  label,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`rounded-2xl px-2 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
        on ? 'bg-brand text-on-brand shadow-md shadow-brand/20' : 'bg-cream text-cocoa'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Einstellungen für ein Schnell-Workout + Vorlagen für den Ein-Tipp-Start. */
export function QuickSetup({
  value,
  onChange,
  onCreate,
  onPreset,
  disabled,
}: {
  value: QuickSettings
  onChange: (v: QuickSettings) => void
  onCreate: () => void
  onPreset: (p: QuickPreset) => void
  disabled?: boolean
}) {
  const set = (patch: Partial<QuickSettings>) => onChange({ ...value, ...patch })
  const structure = planStructure({ ...value, seed: 0 })

  function toggleEquipment(id: QuickEquipment) {
    const has = value.equipment.includes(id)
    const next = has ? value.equipment.filter((e) => e !== id) : [...value.equipment, id]
    set({ equipment: next.length ? next : ['none'] })
  }

  return (
    <div className="space-y-5">
      {/* Vorlagen */}
      <section style={enter(1)}>
        <SectionTitle>Sofort starten</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_PRESETS.map((p, i) => {
            const hero = i === 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => onPreset(p)}
                className={`relative overflow-hidden rounded-3xl p-3.5 text-left transition active:scale-[0.98] disabled:opacity-60 ${
                  hero
                    ? 'bg-cocoa text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none'
                    : 'bg-cream text-cocoa'
                }`}
              >
                {hero && (
                  <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/30 blur-2xl" />
                )}
                <span
                  className={`relative grid h-8 w-8 place-items-center rounded-full ${
                    hero ? 'bg-brand text-on-brand' : 'bg-brand/15 text-brand'
                  }`}
                >
                  {hero ? <Zap size={16} strokeWidth={2.5} /> : <Flame size={16} />}
                </span>
                <span className="relative mt-2 block text-[15px] font-bold leading-tight tracking-tight">{p.title}</span>
                <span
                  className={`tabular relative mt-0.5 block truncate text-xs ${
                    hero ? 'text-bg/70 dark:text-cocoa-light' : 'text-cocoa-light'
                  }`}
                >
                  {p.subtitle}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section style={enter(2)}>
        <SectionTitle>Dauer</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_MINUTES.map((m) => (
            <Tile key={m} on={value.minutes === m} onClick={() => set({ minutes: m })} label={`${m} Minuten`}>
              <span className="tabular block text-xl font-bold leading-none">{m}</span>
              <span className="mt-0.5 block text-[11px] font-medium opacity-80">Min</span>
            </Tile>
          ))}
        </div>
      </section>

      <section style={enter(3)}>
        <SectionTitle>Ausrüstung</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_OPTIONS.map((o) => {
            const on = value.equipment.includes(o.id)
            return (
              <Tile
                key={o.id}
                on={on}
                onClick={() => toggleEquipment(o.id)}
                className="flex items-center gap-2 px-3 text-left"
              >
                {EQUIP_ICON[o.id]}
                <span className="min-w-0 flex-1 truncate text-[13px]">{o.label}</span>
                {on && <Check size={14} strokeWidth={3} className="shrink-0" />}
              </Tile>
            )
          })}
        </div>
      </section>

      <section style={enter(4)}>
        <SectionTitle>Fokus</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((o) => (
            <Tile key={o.id} on={value.focus === o.id} onClick={() => set({ focus: o.id })} className="px-3.5">
              {o.label}
            </Tile>
          ))}
        </div>
      </section>

      <section style={enter(5)}>
        <SectionTitle>Intensität</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITY_OPTIONS.map((o) => (
            <Tile key={o.id} on={value.intensity === o.id} onClick={() => set({ intensity: o.id })}>
              <span className="block">{o.label}</span>
              <span className="tabular mt-0.5 block text-[11px] font-medium opacity-80">
                {o.work}/{o.rest} s
              </span>
            </Tile>
          ))}
        </div>
      </section>

      <div className="space-y-2 pt-1" style={enter(6)}>
        <p className="tabular text-center text-xs text-cocoa-light">
          {structure.stations} Übungen × {structure.rounds} {structure.rounds === 1 ? 'Runde' : 'Runden'} ·{' '}
          {WARMUP_SECONDS} s Aufwärmen
        </p>
        <button
          type="button"
          className="btn-primary w-full gap-2 py-3.5 text-base shadow-md shadow-brand/25"
          onClick={onCreate}
          disabled={disabled}
        >
          <Sparkles size={18} />
          Workout erstellen
        </button>
      </div>
    </div>
  )
}
