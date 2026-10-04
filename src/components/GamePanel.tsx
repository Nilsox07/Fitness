import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, ChevronRight, Star, Target } from 'lucide-react'
import { balanceStats, frequencyStats, onlyPerformed, onlyWorking, sessionDates, totalVolume } from '../lib/analytics'
import { trainingDay } from '../lib/day'
import { achievements, rankForSessions } from '../lib/gamification'
import { mascotEmoji } from '../lib/cosmetics'
import { computeXp, dailyQuests, levelInfo, weeklyQuests, type Quest } from '../lib/xp'
import { Confetti } from './Confetti'
import { playChime, playLevelUp } from '../lib/sound'
import { shareStatCard } from '../lib/statcard'
import type { Exercise, SetWithDate } from '../types'

function QuestRow({ q }: { q: Quest }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
          q.done ? 'anim-check bg-success text-white' : 'bg-sand-dark/40 text-transparent'
        }`}
      >
        <Check size={10} strokeWidth={3} />
      </span>
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className={q.done ? 'text-cocoa-light line-through' : 'text-cocoa'}>{q.label}</span>
          <span className="tabular text-cocoa-muted">+{q.xp} XP</span>
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
          <div
            className={`h-full ${q.done ? 'bg-success' : 'bg-brand opacity-60'}`}
            style={{ width: `${q.progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Quests, Level & Badges (Fitness). `compact` (neue App, unter der Buddy-Level-Karte):
 * nur Quests + Kennzahlen — Level, Level-up-Feier und Badges übernimmt dort das
 * Buddy-Level bzw. die Buddy-Seite.
 */
export function GamePanel({
  sets: allSets,
  exercises,
  compact = false,
}: {
  sets: SetWithDate[]
  exercises: Exercise[]
  compact?: boolean
}) {
  const navigate = useNavigate()
  // Quests nach Trainings-Tag (Wechsel um 4 Uhr, wie im Training)
  const today = trainingDay()
  const g = useMemo(() => {
    // Nur ausgeführte Sätze (leere Vorlagen-Sätze mit 0 Wdh zählen nicht)
    const sets = onlyPerformed(allSets)
    const freq = frequencyStats(sessionDates(sets))
    const tonnage = Math.round(totalVolume(sets))
    const working = onlyWorking(sets)
    const maxWeight = working.reduce((m, s) => Math.max(m, s.weight, s.weight_right ?? 0), 0)
    const bal = balanceStats(sets, exercises)
    const cats = [bal.push, bal.pull, bal.legs, bal.core].filter((v) => v > 0).length
    return {
      freq,
      tonnage,
      rank: rankForSessions(freq.totalSessions),
      mascot: mascotEmoji(freq.totalSessions),
      xp: levelInfo(computeXp(sets)),
      daily: dailyQuests(sets, today),
      weekly: weeklyQuests(sets, today),
      list: achievements({
        sessions: freq.totalSessions,
        weekStreak: freq.weekStreak,
        tonnage,
        maxWeight,
        muscleCategoriesTrained: cats,
      }),
    }
  }, [allSets, exercises, today])

  // Level-up-Feier
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (compact) return // neue App: einzige Feier ist das Buddy-Level
    try {
      const seen = Number(localStorage.getItem('seen_level') || '1')
      if (g.xp.level > seen) {
        setCelebrate(true)
        playLevelUp()
        localStorage.setItem('seen_level', String(g.xp.level))
      } else if (g.xp.level < seen) {
        localStorage.setItem('seen_level', String(g.xp.level))
      }
    } catch {
      /* ignore */
    }
  }, [g.xp.level, compact])

  // Quest-Abschluss-Sound: nur wenn eine Quest während der Session neu fertig wird
  useEffect(() => {
    try {
      const key = `quests_done_${today}`
      const stored = localStorage.getItem(key)
      const seen = new Set<string>(stored ? JSON.parse(stored) : [])
      const doneNow = g.daily.filter((q) => q.done).map((q) => q.id)
      const fresh = doneNow.filter((id) => !seen.has(id))
      if (fresh.length) {
        if (stored !== null) playChime() // Baseline schon gesetzt → echter Neuabschluss
        localStorage.setItem(key, JSON.stringify(doneNow))
      }
    } catch {
      /* ignore */
    }
  }, [g.daily, today])

  return (
    <section className="card space-y-3">
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      {celebrate && (
        <div className="anim-fade flex items-center justify-between gap-2 rounded-xl bg-gold/15 p-2.5 font-bold text-cocoa">
          <span className="flex items-center gap-1.5">
            <Star size={18} className="text-gold" />
            Level <span className="tabular">{g.xp.level}</span> erreicht!
          </span>
          <button
            className="rounded-full bg-gold px-3 py-1 text-sm text-white"
            onClick={() =>
              shareStatCard({
                title: `Level ${g.xp.level} erreicht! ⭐`,
                dateLabel: new Date().toLocaleDateString('de-DE'),
                volume: g.tonnage,
                sets: 0,
                exercises: 0,
                mascot: g.mascot,
                rank: g.rank.title,
                stats: [
                  [`${g.xp.level}`, 'Level'],
                  [`${g.freq.totalSessions}`, 'Trainings'],
                  [`${g.tonnage.toLocaleString('de-DE')} kg`, 'bewegt'],
                ],
              })
            }
          >
            Teilen
          </button>
        </div>
      )}

      {/* Level + Maskottchen + Rang */}
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="text-4xl">{g.mascot}</div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="tabular font-bold">Level {g.xp.level}</span>
              <span className="text-xs text-cocoa-light">{g.rank.title}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand-dark/40">
              <div className="h-full bg-brand" style={{ width: `${g.xp.progress}%` }} />
            </div>
            <div className="tabular mt-0.5 text-[11px] text-cocoa-muted">
              {g.xp.xpInLevel} / {g.xp.xpForLevel} XP · gesamt {g.xp.xp.toLocaleString('de-DE')} XP
            </div>
          </div>
        </div>
      )}

      <div className="tabular text-xs text-cocoa-light">
        {g.freq.totalSessions} Trainings · {g.tonnage.toLocaleString('de-DE')} kg bewegt
      </div>

      {/* Quests */}
      <div className="space-y-2 rounded-xl bg-sand p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Target size={16} className="text-cocoa-light" />
          Tages-Quests
        </div>
        {g.daily.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
        <div className="flex items-center gap-1.5 pt-1 text-sm font-semibold">
          <Calendar size={16} className="text-cocoa-light" />
          Wochen-Quests
        </div>
        {g.weekly.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
      </div>

      {/* Achievements (neue App: Meilensteine auf der Buddy-Seite) */}
      {!compact && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Badges</span>
            <button
              className="flex items-center gap-0.5 text-xs font-semibold text-brand"
              onClick={() => navigate('/badges')}
            >
              Alle ansehen
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {g.list.slice(0, 10).map((a) => (
              <div
                key={a.id}
                title={a.label}
                className={`flex flex-col items-center rounded-xl p-2 text-center ${
                  a.done ? 'bg-gold/15' : 'bg-sand opacity-35'
                }`}
              >
                <span className="text-xl">{a.icon}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-cocoa-light">{a.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
