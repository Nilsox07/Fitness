import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** Einheitliches Bottom-Sheet (gleitet von unten herein, tippen außerhalb schließt). */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="anim-fade fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="anim-sheet card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-sand-dark" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
