import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'
import { MyBuddy } from '../buddy/MyBuddy'
import { importRecipe, sourceLabel, type ImportedRecipe, type ImportPhase } from '../../lib/ai'

type Step = { label: string; state: 'todo' | 'active' | 'done' }

/**
 * Vollbild-Ladeanzeige, wenn ein Rezept über das Teilen-Menü kommt:
 * kein Formular, sondern direkt Buddy + Fortschritt in drei Schritten.
 */
export function ShareImportOverlay({
  text,
  onDone,
  onError,
  onCancel,
}: {
  text: string
  onDone: (r: ImportedRecipe) => void
  onError: (message: string) => void
  onCancel: () => void
}) {
  const source = sourceLabel(text)
  const [phase, setPhase] = useState<ImportPhase | 'nutrition'>(source ? 'loading-post' : 'reading')
  const cancelled = useRef(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    importRecipe(text, setPhase)
      .then((r) => !cancelled.current && onDone(r))
      .catch((e) => !cancelled.current && onError(e instanceof Error ? e.message : 'Import fehlgeschlagen'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Die KI erkennt Rezept und Nährwerte in einem Rutsch – nach kurzer Zeit
  // den dritten Schritt zeigen, damit sichtbar bleibt, dass es weitergeht.
  useEffect(() => {
    if (phase !== 'reading') return
    const t = window.setTimeout(() => setPhase('nutrition'), 2500)
    return () => window.clearTimeout(t)
  }, [phase])

  const order: (ImportPhase | 'nutrition')[] = ['loading-post', 'reading', 'nutrition']
  const at = order.indexOf(phase)
  const steps: Step[] = [
    ...(source ? [{ label: `Beitrag von ${source} öffnen`, state: at > 0 ? 'done' : 'active' } as Step] : []),
    { label: 'Zutaten & Schritte lesen', state: at > 1 ? 'done' : at === 1 ? 'active' : 'todo' },
    { label: 'Nährwerte berechnen', state: at === 2 ? 'active' : 'todo' },
  ]

  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-8 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="relative mb-6 grid h-40 w-40 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/10 [animation-duration:2s]" />
        <span className="absolute inset-4 rounded-full bg-brand/10 blur-xl" />
        <MyBuddy size={128} mood="hungry" className="relative" />
      </div>
      <h1 className="text-center text-2xl font-bold tracking-tight text-cocoa">Rezept wird übernommen</h1>
      <p className="mt-1 text-center text-sm text-cocoa-light">Buddy liest das Rezept und rechnet die Nährwerte aus.</p>

      <ol className="mt-8 w-full max-w-xs space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                s.state === 'done'
                  ? 'bg-success text-white'
                  : s.state === 'active'
                    ? 'bg-brand/15 text-brand'
                    : 'bg-sand text-cocoa-muted'
              }`}
            >
              {s.state === 'done' ? (
                <Check size={15} strokeWidth={3} className="anim-check" />
              ) : s.state === 'active' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span
              className={`text-sm transition-colors duration-300 ${
                s.state === 'todo' ? 'text-cocoa-muted' : 'font-semibold text-cocoa'
              }`}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <button
        className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] text-sm font-semibold text-cocoa-light"
        onClick={() => {
          cancelled.current = true
          onCancel()
        }}
      >
        Abbrechen
      </button>
    </div>,
    document.body,
  )
}
