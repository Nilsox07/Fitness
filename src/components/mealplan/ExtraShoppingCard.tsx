import type { CSSProperties } from 'react'
import { Check, ChefHat, X } from 'lucide-react'
import { useShoppingExtras } from '../../hooks/useShoppingExtras'
import { clearDoneExtras, loadExtras, removeExtraItem, saveExtras, toggleExtraItem } from '../../lib/shoppingExtras'

/** „Fehlt mir“: Artikel aus dem Nachkochen (und Co.) – unabhängig vom Plan, abhakbar. */
export function ExtraShoppingCard({ style }: { style?: CSSProperties }) {
  const items = useShoppingExtras()
  if (items.length === 0) return null
  const done = items.filter((x) => x.done).length

  return (
    <section className="card p-0" style={style}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <ChefHat size={16} />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-semibold">Fehlt mir</h2>
        {done > 0 && (
          <button
            className="shrink-0 text-xs font-semibold text-brand"
            onClick={() => saveExtras(clearDoneExtras(loadExtras()))}
          >
            Erledigte entfernen
          </button>
        )}
      </div>
      <ul className="divide-y divide-sand-dark/30 border-t border-sand-dark/30">
        {items.map((it) => (
          <li key={it.id} className="flex min-h-[3rem] items-center gap-3 pl-4 pr-2">
            <button
              className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
              aria-pressed={it.done}
              onClick={() => saveExtras(toggleExtraItem(loadExtras(), it.id))}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  it.done ? 'bg-success text-white' : 'ring-2 ring-inset ring-sand-dark'
                }`}
              >
                {it.done && <Check size={15} strokeWidth={3} className="anim-check" />}
              </span>
              <span className={`min-w-0 flex-1 text-sm ${it.done ? 'text-cocoa-muted line-through' : ''}`}>
                {it.text}
              </span>
            </button>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-muted"
              aria-label={`${it.text} entfernen`}
              onClick={() => saveExtras(removeExtraItem(loadExtras(), it.id))}
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
