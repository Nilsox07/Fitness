import { useMemo } from 'react'
import { SEASON_REWARDS, daysLeftInSeason, seasonInfo, seasonName, seasonXp } from '../lib/season'
import type { SetWithDate } from '../types'

export function SeasonCard({ sets }: { sets: SetWithDate[] }) {
  const info = useMemo(() => seasonInfo(seasonXp(sets)), [sets])
  const daysLeft = daysLeftInSeason()

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">🎫 Season · {seasonName()}</h2>
        <span className="text-xs text-cocoa-light">noch {daysLeft} Tage</span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-cocoa-light">
          <span>Stufe {info.tier}/{info.maxTier}</span>
          <span>{info.xp} Season-XP</span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
          <div className="h-full bg-brand" style={{ width: `${info.progress}%` }} />
        </div>
        {info.nextReward && (
          <p className="mt-1 text-xs text-cocoa-muted">
            Noch {info.perTier - info.inTier} XP bis: {info.nextReward}
          </p>
        )}
      </div>

      {/* Belohnungs-Leiste */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {SEASON_REWARDS.map((r, i) => {
          const unlocked = info.tier > i
          return (
            <div
              key={i}
              className={`flex w-20 shrink-0 flex-col items-center rounded-xl p-2 text-center ring-1 ${
                unlocked ? 'bg-sand-light ring-brand' : 'ring-sand-dark opacity-50'
              }`}
            >
              <span className="text-[10px] font-semibold text-cocoa-light">Stufe {i + 1}</span>
              <span className="text-lg">{unlocked ? r.split(' ')[0] : '🔒'}</span>
              <span className="text-[9px] leading-tight text-cocoa-muted">
                {r.split(' ').slice(1).join(' ')}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
