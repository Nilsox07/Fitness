interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

/** Großer +/- Stepper für die schnelle Eingabe im Gym. */
export function Stepper({ label, value, onChange, step = 1, min = 0, suffix }: StepperProps) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100))
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="btn-ghost w-12 text-xl"
          onClick={() => set(value - step)}
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <div className="flex flex-1 items-center justify-center rounded-xl bg-slate-900 text-lg font-semibold ring-1 ring-slate-700">
          {value}
          {suffix ? <span className="ml-1 text-sm text-slate-400">{suffix}</span> : null}
        </div>
        <button
          type="button"
          className="btn-ghost w-12 text-xl"
          onClick={() => set(value + step)}
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
  )
}
