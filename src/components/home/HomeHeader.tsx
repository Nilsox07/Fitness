import { Flame } from 'lucide-react'
import { TabHeader } from '../ui/TabHeader'
import { enter } from './motion'

/** Kopf des Training-Tabs: gleich aufgebaut wie Ernährung (Datum · Titel · Wochen-Serie). */
export function HomeHeader({ dateLabel, streak }: { name?: string | null; dateLabel: string; streak: number }) {
  return (
    <TabHeader
      style={enter(0)}
      overline={dateLabel}
      title="Training"
      action={
        streak > 0 ? (
          <div
            className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-sm font-semibold"
            title={`${streak} Wochen in Folge trainiert`}
          >
            <Flame size={15} className="fill-brand/20 text-brand" strokeWidth={2.5} />
            <span className="tabular">{streak} Wochen</span>
          </div>
        ) : undefined
      }
    />
  )
}
