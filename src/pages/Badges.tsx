import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Lock } from 'lucide-react'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { balanceStats, frequencyStats, onlyWorking, totalVolume } from '../lib/analytics'
import { achievements, rankForSessions } from '../lib/gamification'
import { computeXp, levelInfo } from '../lib/xp'
import { ACCENTS, SKINS, mascotEmoji, mascotStageIndex } from '../lib/cosmetics'
import { usePrefs } from '../lib/prefs'
import { Buddy, BUDDY_STAGE_SESSIONS } from '../components/buddy/Buddy'
import { useBuddySkin } from '../components/buddy/useBuddy'

const STAGE_LABELS = ['Ei', 'Küken', 'im Aufbau', 'Kraftpaket', 'Athlet', 'Champion']

export default function Badges() {
  const navigate = useNavigate()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { isNew } = usePrefs()
  const skin = useBuddySkin()

  const data = useMemo(() => {
    const sets = allSets ?? []
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const tonnage = Math.round(totalVolume(sets))
    const maxWeight = onlyWorking(sets).reduce((m, s) => Math.max(m, s.weight, s.weight_right ?? 0), 0)
    const bal = balanceStats(sets, exercises ?? [])
    const cats = [bal.push, bal.pull, bal.legs, bal.core].filter((v) => v > 0).length
    return {
      level: levelInfo(computeXp(sets)),
      rank: rankForSessions(freq.totalSessions),
      sessions: freq.totalSessions,
      list: achievements({
        sessions: freq.totalSessions,
        weekStreak: freq.weekStreak,
        tonnage,
        maxWeight,
        muscleCategoriesTrained: cats,
      }),
    }
  }, [allSets, exercises])

  const doneCount = data.list.filter((a) => a.done).length
  const stage = mascotStageIndex(data.sessions)

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Sammlung</h1>
      </header>

      <div className="card flex items-center gap-3">
        {isNew ? (
          <Buddy size={72} stage={stage} skin={skin} mood="proud" className="-my-2 shrink-0" />
        ) : (
          <div className="text-4xl">{mascotEmoji(data.sessions)}</div>
        )}
        <div>
          <div className="tabular font-bold">Level {data.level.level}</div>
          <div className="tabular text-xs text-cocoa-light">
            {data.rank.title} · {doneCount}/{data.list.length} Badges
          </div>
        </div>
      </div>

      {isNew && (
        <div>
          <h2 className="mb-2 font-semibold">So wächst dein Buddy</h2>
          <div className="card grid grid-cols-6 gap-1 px-2">
            {BUDDY_STAGE_SESSIONS.map((min, i) => {
              const reached = data.sessions >= min
              return (
                <div key={i} className="flex min-w-0 flex-col items-center text-center">
                  <Buddy
                    size={48}
                    stage={i}
                    skin={skin}
                    mood={i === stage ? 'happy' : 'proud'}
                    animate={i === stage}
                    className={reached ? '' : 'opacity-45 saturate-[.6]'}
                  />
                  <span
                    className={`mt-0.5 w-full truncate text-[10px] leading-tight ${
                      i === stage ? 'font-bold text-cocoa' : 'text-cocoa-light'
                    }`}
                  >
                    {STAGE_LABELS[i]}
                  </span>
                  <span className="tabular text-[10px] leading-tight text-cocoa-muted">
                    {min === 0 ? 'Start' : `${min}×`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-semibold">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {data.list.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col items-center rounded-xl p-3 text-center ${
                a.done ? 'bg-gold/15' : 'bg-sand opacity-50'
              }`}
            >
              <span className="grid h-8 place-items-center text-2xl">
                {a.done ? a.icon : <Lock size={18} className="text-cocoa-muted" />}
              </span>
              <span className="mt-1 text-[11px] leading-tight text-cocoa-light">{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Freischaltungen</h2>
        <div className="card space-y-2">
          <div className="text-xs text-cocoa-light">Akzentfarben</div>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <div key={a.id} className="relative">
                <span
                  className="block h-8 w-8 rounded-full"
                  style={{ background: a.swatch, opacity: data.level.level >= a.minLevel ? 1 : 0.35 }}
                  title={data.level.level >= a.minLevel ? a.label : `Ab Level ${a.minLevel}`}
                />
                {data.level.level < a.minLevel && (
                  <span className="tabular absolute -bottom-1 -right-1 text-[10px] text-cocoa-light">Lv{a.minLevel}</span>
                )}
              </div>
            ))}
          </div>
          <div className="pt-1 text-xs text-cocoa-light">{isNew ? 'Buddy-Skins' : 'Maskottchen-Skins'}</div>
          {isNew ? (
            <div className="grid grid-cols-4 gap-2">
              {SKINS.map((s) => {
                const locked = data.level.level < s.minLevel
                return (
                  <div
                    key={s.id}
                    className={`relative flex flex-col items-center rounded-2xl bg-sand px-1 pb-1.5 pt-1 ${
                      s.id === skin ? 'ring-2 ring-cocoa' : ''
                    }`}
                    title={locked ? `Ab Level ${s.minLevel}` : s.label}
                  >
                    <Buddy
                      size={56}
                      stage={Math.max(2, stage)}
                      skin={s.id}
                      animate={false}
                      className={locked ? 'opacity-45 saturate-[.6]' : ''}
                    />
                    <span className="text-[11px] font-medium text-cocoa-light">
                      {locked ? `Lv ${s.minLevel}` : s.label}
                    </span>
                    {locked && <Lock size={13} className="absolute right-1.5 top-1.5 text-cocoa-light" />}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SKINS.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-xl bg-sand px-3 py-1.5 text-lg ${
                    data.level.level >= s.minLevel ? '' : 'opacity-40'
                  }`}
                  title={data.level.level >= s.minLevel ? s.label : `Ab Level ${s.minLevel}`}
                >
                  {s.stages[3]} {data.level.level < s.minLevel && <span className="tabular text-xs text-cocoa-light">Lv{s.minLevel}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
