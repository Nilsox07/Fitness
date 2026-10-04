import { Flame } from 'lucide-react'
import { enter } from './motion'

function greeting(h = new Date().getHours()): string {
  if (h >= 5 && h < 11) return 'Guten Morgen'
  if (h >= 11 && h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

/** Begrüßung mit Datum und Wochen-Serie. */
export function HomeHeader({
  name,
  dateLabel,
  streak,
}: {
  name: string | null
  dateLabel: string
  streak: number
}) {
  // 'jens.haake' (aus der Mailadresse) wird zu 'Jens'
  const raw = name?.trim().split(/[\s._-]+/)[0]
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  return (
    <header className="flex items-start justify-between gap-3" style={enter(0)}>
      <div className="min-w-0">
        <p className="text-sm text-cocoa-light">{dateLabel}</p>
        <h1 className="truncate text-2xl font-bold tracking-tight">
          {greeting()}
          {first ? `, ${first}` : ''}
        </h1>
      </div>
      {streak > 0 && (
        <div
          className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-sm font-semibold"
          title={`${streak} Wochen in Folge trainiert`}
        >
          <Flame size={15} className="fill-brand/20 text-brand" strokeWidth={2.5} />
          <span className="tabular">{streak} Wo.</span>
        </div>
      )}
    </header>
  )
}
