import { useEffect, useState } from 'react'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

/**
 * Großes Eingabefeld mit +/- Steppern für die schnelle Eingabe im Gym.
 * Das Feld ist direkt eintippbar; beim Fokussieren wird der vorhandene Wert
 * markiert, sodass die Eingabe ihn ersetzt (kein manuelles Löschen nötig).
 */
export function Stepper({ label, value, onChange, step = 1, min = 0, suffix }: StepperProps) {
  const clamp = (v: number) => Math.max(min, Math.round(v * 100) / 100)
  const [text, setText] = useState(String(value))

  // Externe Änderungen (z. B. über +/- oder Übungswechsel) ins Feld übernehmen
  useEffect(() => {
    setText(String(value))
  }, [value])

  function commit(raw: string) {
    const n = parseFloat(raw.replace(',', '.'))
    const next = Number.isNaN(n) ? min : clamp(n)
    onChange(next)
    setText(String(next))
  }

  // +/- rechnet auf dem gerade eingetippten Wert weiter (nicht auf einem alten)
  function adjust(delta: number) {
    const base = parseFloat(text.replace(',', '.'))
    const next = clamp((Number.isNaN(base) ? value : base) + delta)
    onChange(next)
    setText(String(next))
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="btn-ghost w-12 text-xl"
          onClick={() => adjust(-step)}
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <div className="relative flex flex-1 items-center">
          <input
            type="text"
            inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
            className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-center text-lg font-semibold text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-brand"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.target.value)}
            aria-label={label}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-3 text-sm text-slate-400">
              {suffix}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-ghost w-12 text-xl"
          onClick={() => adjust(step)}
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
  )
}
