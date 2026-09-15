import { useMemo } from 'react'
import {
  balanceStats,
  frequencyStats,
  onlyWorking,
  totalVolume,
} from '../lib/analytics'
import { achievements, mascotStage, rankForSessions } from '../lib/gamification'
import type { Exercise, SetWithDate } from '../types'

export function GamePanel({ sets, exercises }: { sets: SetWithDate[]; exercises: Exercise[] }) {
  const g = useMemo(() => {
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const tonnage = Math.round(totalVolume(sets))
    const working = onlyWorking(sets)
    const maxWeight = working.reduce((m, s) => Math.max(m, s.weight, s.weight_right ?? 0), 0)
    const bal = balanceStats(sets, exercises)
    const cats = [bal.push, bal.pull, bal.legs, bal.core].filter((v) => v > 0).length
    const rank = rankForSessions(freq.totalSessions)
    const mascot = mascotStage(freq.totalSessions)
    const list = achievements({
      sessions: freq.totalSessions,
      weekStreak: freq.weekStreak,
      tonnage,
      maxWeight,
      muscleCategoriesTrained: cats,
    })
    return { freq, tonnage, rank, mascot, list }
  }, [sets, exercises])

  const pct =
    g.rank.toNext == null
      ? 100
      : Math.max(
          8,
          Math.round((g.freq.totalSessions / (g.freq.totalSessions + g.rank.toNext)) * 100),
        )

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-4xl">{g.mascot.emoji}</div>
        <div className="flex-1">
          <div className="font-bold">{g.rank.title}</div>
          <div className="text-xs text-cocoa-light">
            {g.freq.totalSessions} Trainings · 🔥 {g.freq.weekStreak} Wochen · {g.tonnage.toLocaleString('de-DE')} kg bewegt
          </div>
        </div>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-sand-dark/40">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-cocoa-muted">
          {g.rank.toNext == null
            ? 'Höchster Rang erreicht 👑'
            : `Noch ${g.rank.toNext} Trainings bis zum nächsten Rang.`}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {g.list.map((a) => (
          <div
            key={a.id}
            title={a.label}
            className={`flex flex-col items-center rounded-xl p-2 text-center ${
              a.done ? 'bg-sand-light ring-1 ring-sand-dark' : 'opacity-35'
            }`}
          >
            <span className="text-xl">{a.icon}</span>
            <span className="mt-0.5 text-[10px] leading-tight text-cocoa-light">{a.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
