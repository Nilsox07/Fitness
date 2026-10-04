import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, X } from 'lucide-react'

/**
 * Premium-Bottom-Sheet der neuen App (wie die Mahlzeit-Analyse): Griff, Titelzeile
 * mit rundem Schließen-Knopf, scrollbarer Inhalt und optional eine feste
 * Fußzeile mit Safe-Area-Abstand. Per Portal in <body>, Escape/Tipp außerhalb schließt.
 */
export function PremiumSheet({
  title,
  subtitle,
  leading,
  hero,
  onClose,
  onBack,
  footer,
  children,
  busy = false,
  full = false,
  z = 'z-50',
  bodyClassName = 'space-y-5',
}: {
  title: string
  subtitle?: ReactNode
  /** Icon/Avatar links neben dem Titel. */
  leading?: ReactNode
  /** Großer Kopfbereich statt Titelzeile (Titel dient dann nur als Beschriftung). */
  hero?: ReactNode
  onClose: () => void
  /** Zeigt links einen Zurück-Pfeil (z. B. zurück ins Hinzufügen-Menü). */
  onBack?: () => void
  /** Feste Fußzeile (Primäraktion). */
  footer?: ReactNode
  children?: ReactNode
  /** Während gespeichert wird: nicht per Escape/außen schließen. */
  busy?: boolean
  /** Volle Höhe (z. B. Chat). */
  full?: boolean
  z?: 'z-40' | 'z-50'
  bodyClassName?: string
}) {
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className={`anim-fade fixed inset-0 ${z} flex items-end justify-center bg-black/50 pt-[env(safe-area-inset-top)]`}
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hero ? undefined : titleId}
        aria-label={hero ? title : undefined}
        className={`anim-sheet flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-bg shadow-2xl ${
          full ? 'h-[94vh] max-h-[94vh]' : 'max-h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kopfzeile */}
        <div className={`relative shrink-0 px-5 pt-2.5 ${hero ? 'pb-0' : 'pb-3'}`}>
          <div className="mx-auto h-1 w-10 rounded-full bg-sand-dark" />
          {hero ? (
            <CloseButton onClick={onClose} disabled={busy} className="absolute right-4 top-3 z-10" />
          ) : (
            <div className="mt-2.5 flex items-center gap-3">
              {onBack && (
                <button
                  className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-cocoa-light transition hover:bg-sand active:scale-90 disabled:opacity-40"
                  onClick={onBack}
                  disabled={busy}
                  aria-label="Zurück"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
              )}
              {leading && <div className="shrink-0">{leading}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-lg font-bold leading-tight tracking-tight text-cocoa">
                  {title}
                </h2>
                {subtitle && <p className="tabular truncate text-xs text-cocoa-light">{subtitle}</p>}
              </div>
              <CloseButton onClick={onClose} disabled={busy} />
            </div>
          )}
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 ${
            footer ? 'pb-5' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
          } ${bodyClassName}`}
        >
          {hero}
          {children}
        </div>

        {footer && <SheetFooter>{footer}</SheetFooter>}
      </div>
    </div>,
    document.body,
  )
}

function CloseButton({
  onClick,
  disabled,
  className = '',
}: {
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light transition-colors hover:bg-sand-dark/60 disabled:opacity-40 ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Schließen"
    >
      <X size={16} strokeWidth={2.5} />
    </button>
  )
}

/** Feste Fußzeile mit Safe-Area-Abstand. */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 space-y-2 border-t border-sand-dark/50 bg-bg/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {children}
    </div>
  )
}

/** Hero-Kopf mit Buddy (o. ä.) und sanftem Brand-Schimmer. */
export function SheetHero({
  art,
  title,
  subtitle,
}: {
  art: ReactNode
  title: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div className="relative -mx-5 overflow-hidden px-5 pb-1 pt-2 text-center">
      <div className="pointer-events-none absolute left-1/2 top-2 h-36 w-36 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex flex-col items-center">
        {art}
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-cocoa">{title}</h2>
        {subtitle && <p className="tabular mt-0.5 text-sm text-cocoa-light">{subtitle}</p>}
      </div>
    </div>
  )
}
