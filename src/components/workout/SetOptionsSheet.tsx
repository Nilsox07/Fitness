// Optionen eines Satzes (Satz-Kürzel antippen): Art, bis zum Versagen, Reihenfolge, Löschen.

import type { ReactNode } from 'react'
import { ArrowDown, ChevronDown, ChevronUp, Copy, Dumbbell, Flame, Trash2 } from 'lucide-react'
import { PremiumSheet } from '../ui/PremiumSheet'
import { Toggle } from '../profile/ui'
import { SectionLabel } from '../progress/ProgressHeader'
import { SET_TYPE_LABEL, type SetType, type WorkoutSet } from '../../types'

const TYPES: { id: SetType; icon: ReactNode; hint: string }[] = [
  { id: 'warmup', icon: <Flame size={20} />, hint: 'Leicht, vorm Arbeiten' },
  { id: 'working', icon: <Dumbbell size={20} />, hint: 'Zählt für Fortschritt' },
  { id: 'drop', icon: <ArrowDown size={20} />, hint: 'Direkt danach, leichter' },
]

export interface SetOrderItem {
  id: string
  type: SetType
  /** Nummer unter den Arbeitssätzen */
  badge: string
  weight: number
  reps: number
}

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 })

export function SetOptionsSheet({
  set: s,
  badge,
  done,
  onType,
  onFailure,
  onMove,
  order,
  onMoveTo,
  onDelete,
  onDuplicate,
  onClose,
}: {
  set: WorkoutSet
  badge: string
  done: boolean
  onType: (t: SetType) => void
  onFailure: (v: boolean) => void
  onMove?: { up: (() => void) | null; down: (() => void) | null }
  /** Alle Sätze der Übung in aktueller Reihenfolge – zeigt, wohin der Satz wandert */
  order?: SetOrderItem[]
  /** Direkt an Position `index` der Liste setzen (Antippen einer Zeile) */
  onMoveTo?: (index: number) => void
  onDelete: () => void
  /** Kopie direkt dahinter */
  onDuplicate?: () => void
  onClose: () => void
}) {
  const title = s.set_type === 'working' ? `Satz ${badge}` : SET_TYPE_LABEL[s.set_type]
  const sub = done ? `${fmt(s.weight)} kg × ${s.reps}` : `${fmt(s.weight)} kg · noch offen`
  const canMove = !!onMove && (!!onMove.up || !!onMove.down)
  return (
    <PremiumSheet
      title={title}
      subtitle={sub}
      leading={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-sm font-bold text-cocoa-light">
          {TYPES.find((t) => t.id === s.set_type)?.icon}
        </span>
      }
      onClose={onClose}
      bodyClassName="space-y-5"
      footer={
        <div className="flex gap-2">
          {onDuplicate && (
            <button
              type="button"
              onClick={() => {
                onDuplicate()
                onClose()
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sand py-3 text-sm font-semibold text-cocoa transition active:scale-[0.98]"
            >
              <Copy size={16} /> Duplizieren
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500/10 py-3 text-sm font-semibold text-red-500 transition active:scale-[0.98]"
          >
            <Trash2 size={16} /> Löschen
          </button>
        </div>
      }
    >
      <section className="space-y-2">
        <SectionLabel>Art</SectionLabel>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Art des Satzes">
          {TYPES.map((t) => {
            const on = s.set_type === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onType(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition active:scale-95 ${
                  on ? 'bg-brand/10 text-cocoa ring-2 ring-brand' : 'bg-sand text-cocoa-light'
                }`}
              >
                <span className={on ? 'text-brand' : ''}>{t.icon}</span>
                <span className="text-sm font-semibold">{SET_TYPE_LABEL[t.id]}</span>
                <span className="text-[10px] leading-tight text-cocoa-muted">{t.hint}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-sand/70 dark:bg-sand">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Bis zum Versagen</span>
            <span className="block text-xs text-cocoa-light">Keine Wdh. mehr drin gewesen</span>
          </span>
          <Toggle checked={s.to_failure} onChange={onFailure} label="Bis zum Versagen" />
        </div>
      </div>

      {canMove && (
        <section className="space-y-2">
          <SectionLabel
            right={
              <span className="flex gap-1.5">
                <MoveButton label="Nach oben" onClick={onMove!.up}>
                  <ChevronUp size={18} />
                </MoveButton>
                <MoveButton label="Nach unten" onClick={onMove!.down}>
                  <ChevronDown size={18} />
                </MoveButton>
              </span>
            }
          >
            Reihenfolge
          </SectionLabel>
          <p className="-mt-1 px-1 text-xs text-cocoa-muted">
            Zeile antippen = dorthin. Mehrere umsortieren: unter den Sätzen „Reihenfolge ändern“.
          </p>
          {order && order.length > 1 && (
            <ol className="space-y-1" aria-label="Reihenfolge der Sätze">
              {order.map((o, idx) => {
                const me = o.id === s.id
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={me || !onMoveTo}
                      onClick={() => onMoveTo?.(idx)}
                      aria-current={me ? 'true' : undefined}
                      aria-label={me ? 'Dieser Satz' : `Hierhin verschieben (Position ${idx + 1})`}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-all duration-200 active:scale-[0.98] ${
                        me
                          ? 'bg-brand/10 font-semibold text-cocoa ring-2 ring-brand'
                          : 'bg-sand/70 text-cocoa-light dark:bg-sand'
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center text-xs font-bold ${me ? 'text-brand' : ''}`}
                      >
                        {o.type === 'warmup' ? (
                          <Flame size={15} />
                        ) : o.type === 'drop' ? (
                          <ArrowDown size={15} />
                        ) : (
                          o.badge
                        )}
                      </span>
                      <span className="tabular min-w-0 flex-1 truncate">
                        {fmt(o.weight)} kg{o.reps > 0 ? ` × ${o.reps}` : ''}
                      </span>
                      {me ? (
                        <span className="text-[11px] font-semibold text-brand">dieser Satz</span>
                      ) : (
                        onMoveTo && <span className="text-[11px] text-cocoa-muted">hierhin</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      )}
    </PremiumSheet>
  )
}

function MoveButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: (() => void) | null
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick ?? undefined}
      className="grid h-10 w-10 place-items-center rounded-full bg-cream text-cocoa shadow-sm transition active:scale-90 disabled:opacity-30 dark:bg-sand-light dark:shadow-none"
    >
      {children}
    </button>
  )
}
