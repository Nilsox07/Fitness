import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface ToolTile {
  to: string
  label: string
  sub?: string
  Icon: LucideIcon
}

/** Werkzeuge eines Bereichs als schmale Zeile (eine Ebene tiefer, Zurück oben links). */
export function ToolTiles({ items, style }: { items: ToolTile[]; style?: CSSProperties }) {
  return (
    <nav className="flex gap-2" style={style} aria-label="Werkzeuge">
      {items.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-full bg-cream px-2.5 py-2.5 text-[13px] font-semibold text-cocoa transition active:scale-[0.97]"
        >
          <Icon size={15} className="shrink-0 text-brand" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
