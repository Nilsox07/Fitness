import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface ToolTile {
  to: string
  label: string
  sub?: string
  Icon: LucideIcon
}

/** Drei große Kacheln zu den Werkzeugen eines Bereichs (eine Ebene tiefer, Zurück oben links). */
export function ToolTiles({ items, style }: { items: ToolTile[]; style?: CSSProperties }) {
  return (
    <nav className="grid grid-cols-3 gap-2" style={style} aria-label="Werkzeuge">
      {items.map(({ to, label, sub, Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-start gap-2 rounded-2xl bg-cream p-3 transition active:scale-[0.97]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon size={19} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-cocoa">{label}</span>
            {sub && <span className="block truncate text-[11px] text-cocoa-muted">{sub}</span>}
          </span>
        </Link>
      ))}
    </nav>
  )
}
