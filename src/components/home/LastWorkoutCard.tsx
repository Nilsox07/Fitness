import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import { dayLabel } from '../../lib/day'
import type { LastSessionStats } from '../../lib/home'
import { enter } from './motion'

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="tabular truncate text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] text-cocoa-muted">{label}</div>
    </div>
  )
}

function formatVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`
  return `${kg.toLocaleString('de-DE')} kg`
}

/** Letztes Training: Kennzahlen + Top-Übungen, tippen → Verlauf. */
export function LastWorkoutCard({
  stats,
  today,
  names,
  index,
}: {
  stats: LastSessionStats
  today: string
  names: string[]
  index: number
}) {
  const navigate = useNavigate()
  return (
    <button
      className="card block w-full space-y-3 text-left transition active:scale-[0.99]"
      style={enter(index)}
      onClick={() => navigate('/history')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Letztes Training</h2>
        <span className="flex items-center gap-0.5 text-xs text-cocoa-light">
          {dayLabel(stats.date, today)}
          <ChevronRight size={14} />
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.minutes != null ? (
          <Stat label="Dauer" value={`${stats.minutes} Min`} />
        ) : (
          <Stat label="Übungen" value={stats.exerciseIds.length} />
        )}
        <Stat label="Sätze" value={stats.sets} />
        <Stat label="Volumen" value={formatVolume(stats.volume)} />
        <Stat
          label="Rekorde"
          value={
            <span className={`flex items-center gap-1 ${stats.prs > 0 ? 'text-gold' : 'text-cocoa-muted'}`}>
              <Trophy size={15} strokeWidth={2.5} />
              {stats.prs}
            </span>
          }
        />
      </div>
      {names.length > 0 && (
        <p className="truncate border-t border-sand pt-2.5 text-xs text-cocoa-light">
          {names.slice(0, 3).join(' · ')}
          {names.length > 3 && <span className="text-cocoa-muted"> · +{names.length - 3}</span>}
        </p>
      )}
    </button>
  )
}
