import { Flame } from 'lucide-react'
import { enter } from './motion'
import { Buddy, type BuddyMood } from '../buddy/Buddy'

function greeting(h = new Date().getHours()): string {
  if (h >= 5 && h < 11) return 'Guten Morgen'
  if (h >= 11 && h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

/** Begrüßung mit Datum und Wochen-Serie, darunter Buddy mit Sprechblase. */
export function HomeHeader({
  name,
  dateLabel,
  streak,
  buddy,
}: {
  name: string | null
  dateLabel: string
  streak: number
  buddy?: { mood: BuddyMood; line: string; stage: number; skin: string }
}) {
  // 'jens.haake' (aus der Mailadresse) wird zu 'Jens'
  const raw = name?.trim().split(/[\s._-]+/)[0]
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  return (
    <header className="space-y-2" style={enter(0)}>
      <div className="flex items-start justify-between gap-3">
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
      </div>
      {buddy && (
        <div className="flex items-center gap-2.5">
          <Buddy size={64} mood={buddy.mood} stage={buddy.stage} skin={buddy.skin} className="shrink-0" />
          <div className="relative min-w-0 flex-1 rounded-2xl bg-cream px-3.5 py-2.5 text-sm font-medium leading-snug text-cocoa">
            <span
              className="absolute -left-1 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 rounded-[3px] bg-cream"
              aria-hidden
            />
            <span className="relative">{buddy.line}</span>
          </div>
        </div>
      )}
    </header>
  )
}
