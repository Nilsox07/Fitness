import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

/** Kurzer Text + (i): die Erklärung erscheint erst beim Antippen. */
export function InfoTip({
  children,
  info,
  className = '',
}: {
  children: ReactNode
  info: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-left"
      >
        <span>{children}</span>
        <Info size={13} className="shrink-0 opacity-60" aria-label="Mehr erfahren" />
      </button>
      {open && <p className="anim-fade mt-1 text-xs leading-snug opacity-80">{info}</p>}
    </div>
  )
}
