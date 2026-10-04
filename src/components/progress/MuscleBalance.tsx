import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { enter } from '../home/motion'
import { SectionLabel } from './ProgressHeader'
import { formatVolume } from './progressUtils'

/** Breiten erst nach dem Mount setzen → Balken wachsen sanft hinein. */
function useGrow(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(t)
  }, [])
  return ready
}

function Split({ a, b, labelA, labelB, grow }: { a: number; b: number; labelA: string; labelB: string; grow: boolean }) {
  const total = a + b
  const pct = total > 0 ? Math.round((a / total) * 100) : 50
  return (
    <div className="min-w-0 rounded-xl bg-sand-light px-3 py-2">
      <div className="tabular flex justify-between text-[11px] text-cocoa-light">
        <span>
          <span className="font-semibold text-cocoa">{pct} %</span> {labelA}
        </span>
        <span>
          {labelB} <span className="font-semibold text-cocoa">{100 - pct} %</span>
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
          style={{ width: grow ? `${pct}%` : '50%' }}
        />
        <div className="h-full flex-1 rounded-full bg-sand-dark" />
      </div>
    </div>
  )
}

/**
 * Muskelbalance: Drücken/Ziehen + Ober/Unter als kompakte Splits, darunter
 * runde Balken je Muskel mit Wert; der Spitzenreiter ist hervorgehoben.
 */
export function MuscleBalance({
  muscles,
  push,
  pull,
  upper,
  lower,
  stale,
  index,
}: {
  muscles: { muscle: string; value: number }[]
  push: number
  pull: number
  upper: number
  lower: number
  stale: { muscle: string; daysAgo: number }[]
  index: number
}) {
  const grow = useGrow()
  if (muscles.length === 0) return null
  const max = Math.max(1, ...muscles.map((m) => m.value))
  const total = muscles.reduce((s, m) => s + m.value, 0)

  return (
    <section style={enter(index)}>
      <SectionLabel>Muskelbalance</SectionLabel>
      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Split a={push} b={pull} labelA="Drücken" labelB="Ziehen" grow={grow} />
          <Split a={upper} b={lower} labelA="Oben" labelB="Beine" grow={grow} />
        </div>
        <ul className="space-y-2">
          {muscles.slice(0, 7).map((m, i) => {
            const top = i === 0
            const share = total > 0 ? Math.round((m.value / total) * 100) : 0
            return (
              <li key={m.muscle} className="flex items-center gap-2.5">
                <span
                  className={`flex w-24 shrink-0 items-center gap-1 truncate text-sm ${
                    top ? 'font-semibold text-cocoa' : 'text-cocoa-light'
                  }`}
                >
                  {top && <Crown size={13} className="shrink-0 text-gold" aria-label="Meistes Volumen" />}
                  <span className="truncate">{m.muscle}</span>
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-sand-dark/35">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                      top ? 'bg-brand shadow-sm shadow-brand/30' : 'bg-brand/45'
                    }`}
                    style={{
                      width: grow ? `${Math.max(4, (m.value / max) * 100)}%` : '0%',
                      transitionDelay: `${i * 40}ms`,
                    }}
                  />
                </div>
                <span className="tabular w-16 shrink-0 text-right text-xs">
                  <span className={top ? 'font-semibold text-cocoa' : 'text-cocoa-light'}>{formatVolume(m.value)}</span>
                  <span className="block text-[10px] leading-tight text-cocoa-muted">{share} %</span>
                </span>
              </li>
            )
          })}
        </ul>
        {stale.length > 0 && (
          <p className="border-t border-sand-dark/40 pt-2.5 text-xs text-cocoa-light">
            Länger nicht trainiert:{' '}
            {stale.map((r, i) => (
              <span key={r.muscle}>
                {i > 0 && ', '}
                <span className="font-medium text-cocoa">{r.muscle}</span>{' '}
                <span className="tabular text-cocoa-muted">({r.daysAgo} T.)</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  )
}
