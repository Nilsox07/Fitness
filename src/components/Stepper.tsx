import { useEffect, useState } from 'react'
import { ladderStep, snapToLadder } from '../lib/weights'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
  /** Label visuell ausblenden (bleibt für Screenreader erhalten). */
  hideLabel?: boolean
  /** Kompaktere Darstellung für editierbare Listen-Zeilen. */
  compact?: boolean
  /** Optionale Gewichts-Leiter: +/- springt auf real wählbare Werte. */
  steps?: number[]
}

/**
 * Großes Eingabefeld mit +/- Steppern für die schnelle Eingabe im Gym.
 * Das Feld ist direkt eintippbar; beim Fokussieren wird der vorhandene Wert
 * markiert, sodass die Eingabe ihn ersetzt (kein manuelles Löschen nötig).
 */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  hideLabel = false,
  compact = false,
  steps,
}: StepperProps) {
  const hasLadder = !!steps && steps.length > 0
  const clamp = (v: number) => Math.max(min, Math.round(v * 100) / 100)
  const [text, setText] = useState(String(value))

  // Externe Änderungen (z. B. über +/- oder Übungswechsel) ins Feld übernehmen
  useEffect(() => {
    setText(String(value))
  }, [value])

  function commit(raw: string) {
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isNaN(n)) {
      onChange(min)
      setText(String(min))
      return
    }
    // Auf reale Stufen einrasten, wenn eine Leiter hinterlegt ist
    const next = hasLadder ? snapToLadder(n, steps!) : clamp(n)
    onChange(next)
    setText(String(next))
  }

  // +/- rechnet auf dem gerade eingetippten Wert weiter (nicht auf einem alten)
  function adjust(delta: number) {
    const parsed = parseFloat(text.replace(',', '.'))
    const base = Number.isNaN(parsed) ? value : parsed
    const next = hasLadder ? ladderStep(base, steps!, delta) : clamp(base + delta)
    onChange(next)
    setText(String(next))
  }

  const btnClass = compact ? 'btn-ghost w-9 px-0 py-1.5 text-lg' : 'btn-ghost w-12 text-xl'
  const inputClass = compact
    ? 'w-full rounded-lg bg-sand-light px-2 py-1.5 text-center font-semibold text-cocoa outline-none ring-1 ring-sand-dark focus:ring-2 focus:ring-brand'
    : 'w-full rounded-xl bg-sand-light px-3 py-2.5 text-center text-lg font-semibold text-cocoa outline-none ring-1 ring-sand-dark focus:ring-2 focus:ring-brand'

  return (
    <div>
      {!hideLabel && <span className="label">{label}</span>}
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          className={btnClass}
          onClick={() => adjust(-step)}
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <div className="relative flex flex-1 items-center">
          <input
            type="text"
            inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.target.value)}
            aria-label={label}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-2 text-xs text-cocoa-light">
              {suffix}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={btnClass}
          onClick={() => adjust(step)}
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
  )
}
