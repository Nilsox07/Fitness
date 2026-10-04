import { useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, Plus, Share2, X } from 'lucide-react'
import type { ShoppingCat } from '../../types'
import { CATEGORY_ICON } from './mealIcons'
import { categoryKind, checkKeys } from './planUtils'
import { stagger } from '../nutrition-home/motion'

const EXTRA_CATEGORY = 'Sonstiges'

/** Einkaufsliste: Fortschritt, einklappbare Kategorien, große Abhak-Ziele. */
export function ShoppingListView({
  shopping,
  checked,
  hideDone,
  onHideDone,
  onToggle,
  onRemove,
  onAdd,
  onShare,
}: {
  shopping: ShoppingCat[]
  checked: Set<string>
  hideDone: boolean
  onHideDone: (v: boolean) => void
  onToggle: (key: string) => void
  onRemove: (catIdx: number, itemIdx: number) => void
  /** catIdx = -1 → neue Kategorie „Sonstiges" anlegen */
  onAdd: (catIdx: number, category: string, text: string) => void
  onShare: () => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')

  const allKeys = shopping.flatMap(checkKeys)
  const total = allKeys.length
  const done = allKeys.filter((k) => checked.has(k)).length
  const pct = total ? (done / total) * 100 : 0
  const complete = total > 0 && done === total
  const hasExtra = shopping.some((c) => c.category === EXTRA_CATEGORY)

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-3">
      {/* Fortschritt */}
      <section className="card space-y-3" style={stagger(0)}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Einkauf</p>
            <p className="tabular mt-0.5 text-2xl font-bold tracking-tight">
              <span className={complete ? 'text-success' : ''}>{done}</span>
              <span className="text-cocoa-muted"> / {total}</span>
              <span className="ml-1.5 text-sm font-medium text-cocoa-light">erledigt</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`grid h-10 w-10 place-items-center rounded-full transition active:scale-90 ${
                hideDone ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa'
              }`}
              onClick={() => onHideDone(!hideDone)}
              aria-pressed={hideDone}
              aria-label="Erledigte ausblenden"
              title="Erledigte ausblenden"
            >
              {hideDone ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90 disabled:opacity-40"
              onClick={onShare}
              disabled={total === 0}
              aria-label="Liste teilen"
              title="Liste teilen"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sand-dark/45">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${complete ? 'bg-success' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {hideDone && done > 0 && (
          <p className="tabular text-xs text-cocoa-muted">{done} erledigte Artikel ausgeblendet</p>
        )}
      </section>

      {shopping.length === 0 && (
        <p className="px-1 text-sm text-cocoa-light">Noch keine Artikel — füge unten welche hinzu.</p>
      )}

      {shopping.map((c, ci) => {
        const id = `${c.category}#${ci}`
        const keys = checkKeys(c)
        const rows = c.items.map((name, ii) => ({ name, ii, key: keys[ii], done: checked.has(keys[ii]) }))
        // offene zuerst, erledigte (stabil) nach unten
        const sorted = [...rows.filter((r) => !r.done), ...rows.filter((r) => r.done)]
        const visible = hideDone ? sorted.filter((r) => !r.done) : sorted
        const catDone = rows.filter((r) => r.done).length
        const allDone = rows.length > 0 && catDone === rows.length
        const isCollapsed = collapsed.has(id)
        const Icon = CATEGORY_ICON[categoryKind(c.category)]

        return (
          <section key={id} className="card overflow-hidden p-0" style={stagger(ci + 1, 40)}>
            <button
              className="flex w-full items-center gap-3 p-3 pl-4 text-left"
              onClick={() => toggleCollapsed(id)}
              aria-expanded={!isCollapsed}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
                  allDone ? 'bg-success/15 text-success' : 'bg-sand text-cocoa-light'
                }`}
              >
                {allDone ? <Check size={20} strokeWidth={2.5} /> : <Icon size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold leading-tight">{c.category}</span>
                <span className="tabular mt-0.5 block text-xs text-cocoa-light">
                  {allDone ? 'Alles erledigt' : `${catDone} / ${rows.length} erledigt`}
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {!isCollapsed && (
              <ul className="anim-fade divide-y divide-sand-dark/30 border-t border-sand-dark/30">
                {visible.map((r) => (
                  <li key={r.key} className="flex items-center">
                    <button
                      className="flex min-h-[3rem] min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left"
                      onClick={() => onToggle(r.key)}
                      role="checkbox"
                      aria-checked={r.done}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
                          r.done ? 'anim-check bg-success text-white' : 'text-transparent ring-2 ring-inset ring-sand-dark'
                        }`}
                      >
                        <Check size={15} strokeWidth={3} />
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-sm transition-colors duration-200 ${
                          r.done ? 'text-cocoa-muted line-through' : 'text-cocoa'
                        }`}
                      >
                        {r.name}
                      </span>
                    </button>
                    <button
                      className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted transition hover:text-red-500 active:scale-90"
                      aria-label={`${r.name} entfernen`}
                      onClick={() => onRemove(ci, r.ii)}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
                <li>
                  <AddRow onAdd={(t) => onAdd(ci, c.category, t)} />
                </li>
              </ul>
            )}
          </section>
        )
      })}

      {/* freie Artikel ohne passende Kategorie */}
      {!hasExtra && (
        <section className="card p-0" style={stagger(shopping.length + 1, 40)}>
          <AddRow
            placeholder="Weiterer Artikel…"
            value={extra}
            onValue={setExtra}
            onAdd={(t) => onAdd(-1, EXTRA_CATEGORY, t)}
          />
        </section>
      )}
    </div>
  )
}

function AddRow({
  onAdd,
  placeholder = 'Artikel hinzufügen…',
  value,
  onValue,
}: {
  onAdd: (text: string) => void
  placeholder?: string
  value?: string
  onValue?: (v: string) => void
}) {
  const [own, setOwn] = useState('')
  const text = value ?? own
  const setText = onValue ?? setOwn
  const submit = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }
  return (
    <div className="flex min-h-[3rem] items-center gap-3 py-1.5 pl-4 pr-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
        <Plus size={15} strokeWidth={2.5} />
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-cocoa outline-none placeholder:text-cocoa-muted"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        enterKeyHint="done"
        aria-label={placeholder}
      />
      {text.trim() && (
        <button
          className="anim-fade shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand transition active:scale-95"
          onClick={submit}
        >
          Hinzufügen
        </button>
      )}
    </div>
  )
}
