import { useState } from 'react'
import { Target } from 'lucide-react'
import { challengeOfDay, randomExcuse } from '../../lib/challenges'
import { enter } from './motion'

/** Schlanke Tages-Challenge + (zum Schmunzeln) der Ausreden-Generator ganz unten. */
export function ChallengeCard({ index }: { index: number }) {
  const [excuse, setExcuse] = useState<string | null>(null)
  // Das führende Emoji ersetzt hier das Icon
  const text = challengeOfDay().replace(/^\p{Extended_Pictographic}️?\s*/u, '')
  return (
    <>
      <section className="card flex items-center gap-3 py-3" style={enter(index)}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <Target size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
            Challenge des Tages
          </p>
          <p className="text-sm font-medium">{text}</p>
        </div>
      </section>
      <div className="space-y-1 pt-1 text-center" style={enter(index + 1)}>
        <button className="text-xs text-cocoa-muted underline-offset-2 hover:underline" onClick={() => setExcuse(randomExcuse())}>
          Keine Lust? Ausrede generieren 😅
        </button>
        {excuse && <p className="anim-fade text-sm italic text-cocoa-light">„{excuse}"</p>}
      </div>
    </>
  )
}
