import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import type { FoodEntry } from '../../types'

/** „Zuletzt gegessen" — horizontale Chips für die 1-Tap-Wiederholung. */
export function RecentChips({
  items,
  onAdd,
  style,
}: {
  items: FoodEntry[]
  onAdd: (e: FoodEntry) => void
  style?: CSSProperties
}) {
  if (items.length === 0) return null
  return (
    <section style={style}>
      <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
        Zuletzt gegessen
      </h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((e) => (
          <button
            key={e.id}
            onClick={() => onAdd(e)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-cream py-1.5 pl-1.5 pr-3 text-sm transition active:scale-95"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-sand text-brand">
              <Plus size={14} strokeWidth={2.5} />
            </span>
            <span className="max-w-[10rem] truncate">{e.name}</span>
            <span className="tabular text-xs text-cocoa-muted">{Math.round(e.kcal)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
