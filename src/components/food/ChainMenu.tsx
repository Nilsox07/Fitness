import { useMemo } from 'react'
import { Minus, Plus } from 'lucide-react'
import { CHAIN_BADGE, type Chain, type MenuItem } from '../../lib/fastfood'

/** Rundes Kürzel einer Kette (eigene Gestaltung statt Original-Logo). */
export function ChainBadge({ id, size = 20 }: { id: string; size?: number }) {
  const b = CHAIN_BADGE[id]
  if (!b) return null
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-black leading-none tracking-tight"
      style={{
        width: size,
        height: size,
        background: b.bg,
        color: b.fg,
        fontSize: size * (b.short.length > 2 ? 0.32 : 0.42),
      }}
      aria-hidden
    >
      {b.short}
    </span>
  )
}

/** Speisekarte einer Kette: suchen, antippen, Menge ändern. */
export function ChainMenu({
  chain,
  query,
  qty,
  onQty,
}: {
  chain: Chain
  query: string
  qty: Record<string, number>
  onQty: (name: string, next: number) => void
}) {
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean)
    const hit = (i: MenuItem) => words.every((w) => i.name.toLowerCase().includes(w) || i.category.toLowerCase().includes(w))
    const m = new Map<string, MenuItem[]>()
    for (const i of chain.items) {
      if (words.length && !hit(i)) continue
      const list = m.get(i.category) ?? []
      list.push(i)
      m.set(i.category, list)
    }
    return [...m.entries()]
  }, [chain, q])

  if (groups.length === 0)
    return (
      <p className="rounded-2xl bg-cream px-4 py-5 text-center text-sm text-cocoa-light">
        Nicht auf der Karte gefunden – unten mit KI schätzen lassen.
      </p>
    )

  return (
    <div className="space-y-4">
      {groups.map(([cat, items]) => (
        <div key={cat}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">{cat}</div>
          <ul className="overflow-hidden rounded-2xl bg-cream">
            {items.map((i) => {
              const n = qty[i.name] ?? 0
              return (
                <li key={i.name} className="flex items-center gap-2 border-b border-sand/70 px-3 py-2.5 last:border-0">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onQty(i.name, n + 1)}>
                    <div className={`truncate text-sm ${n ? 'font-semibold text-cocoa' : 'text-cocoa'}`}>{i.name}</div>
                    <div className="tabular text-xs text-cocoa-muted">
                      {Math.round(i.kcal)} kcal · {Math.round(i.protein)} g E · {Math.round(i.carbs)} g KH ·{' '}
                      {Math.round(i.fat)} g F{i.src === 'geschätzt' ? ' · geschätzt' : ''}
                    </div>
                  </button>
                  {n > 0 ? (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 p-0.5">
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-full text-brand"
                        onClick={() => onQty(i.name, n - 1)}
                        aria-label={`${i.name} weniger`}
                      >
                        <Minus size={14} strokeWidth={2.75} />
                      </button>
                      <span className="tabular w-4 text-center text-sm font-bold text-brand">{n}</span>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-full text-brand"
                        onClick={() => onQty(i.name, n + 1)}
                        aria-label={`${i.name} mehr`}
                      >
                        <Plus size={14} strokeWidth={2.75} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition active:scale-90"
                      onClick={() => onQty(i.name, 1)}
                      aria-label={`${i.name} hinzufügen`}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
