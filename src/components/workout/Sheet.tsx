import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Einheitliches Bottom-Sheet (gleitet von unten herein, tippen außerhalb oder
 * Escape schließt). Wird per Portal direkt in <body> gerendert — sonst wäre es in
 * Eltern mit backdrop-blur/transform (z. B. der Aktionsleiste im Training)
 * „gefangen", weil die einen eigenen Bezugsrahmen für position: fixed bilden.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-sheet card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-sand-dark" />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
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
    </div>,
    document.body,
  )
}
