import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, Lock } from 'lucide-react'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { balanceStats, frequencyStats, onlyWorking, totalVolume } from '../lib/analytics'
import { achievements, rankForSessions } from '../lib/gamification'
import { computeXp, levelInfo } from '../lib/xp'
import {
  ACCENTS,
  SKINS,
  applyAccent,
  getAccentId,
  mascotEmoji,
  setAccentId,
  setSkinId,
} from '../lib/cosmetics'
import { usePrefs } from '../lib/prefs'
import { milestones } from '../lib/milestones'
import { Buddy, BUDDY_STAGE_SESSIONS } from '../components/buddy/Buddy'
import { BUDDY_SKIN_EVENT, useBuddy, useBuddyLevel } from '../components/buddy/useBuddy'

const STAGE_LABELS = ['Ei', 'Küken', 'im Aufbau', 'Kraftpaket', 'Athlet', 'Champion']

/** Klassische Sammlung (alter App-Modus) — unverändert. */
function ClassicBadges() {
  const navigate = useNavigate()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()

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

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Sammlung</h1>
      </header>

      <div className="card flex items-center gap-3">
        <div className="text-4xl">{mascotEmoji(data.sessions)}</div>
        <div>
          <div className="tabular font-bold">Level {data.level.level}</div>
          <div className="tabular text-xs text-cocoa-light">
            {data.rank.title} · {doneCount}/{data.list.length} Badges
          </div>
        </div>
      </div>

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
          <div className="pt-1 text-xs text-cocoa-light">Maskottchen-Skins</div>
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
        </div>
      </div>
    </div>
  )
}

export default function Badges() {
  const { isNew } = usePrefs()
  return isNew ? <BuddyPage /> : <ClassicBadges />
}

/** Neue App: „Buddy" — Level, Wachstum, Meilensteine und Freischaltungen an einem Ort. */
function BuddyPage() {
  const navigate = useNavigate()
  const { data: allSets } = useAllSets()
  const { showNutrition } = usePrefs()
  const buddy = useBuddy()
  const level = useBuddyLevel()
  const [accent, setAccent] = useState(getAccentId)
  const sessions = level.sessions
  const stage = buddy.stage
  const rank = rankForSessions(sessions)
  const list = useMemo(() => milestones(allSets ?? []), [allSets])
  const doneCount = list.filter((m) => m.done).length

  function chooseAccent(id: string, min: number) {
    if (level.level < min) return
    setAccent(id)
    setAccentId(id)
    applyAccent(id)
  }
  function chooseSkin(id: string, min: number) {
    if (level.level < min) return
    setSkinId(id)
    window.dispatchEvent(new Event(BUDDY_SKIN_EVENT))
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Buddy</h1>
      </header>

      {/* Hero: großer Buddy + Level + XP */}
      <section className="card flex flex-col items-center text-center">
        <Buddy size={132} stage={stage} skin={buddy.skin} mood={buddy.mood} className="-mt-1" />
        <p className="mt-1 max-w-[18rem] text-sm text-cocoa-light">„{buddy.line}“</p>
        <div className="tabular mt-3 text-2xl font-bold text-cocoa">Buddy-Level {level.level}</div>
        <div className="tabular text-xs text-cocoa-light">
          {rank.title} · {sessions} {sessions === 1 ? 'Training' : 'Trainings'}
        </div>
        <div className="mt-3 w-full">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-sand-dark/40"
            role="progressbar"
            aria-valuenow={level.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Fortschritt zum nächsten Level"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${level.progress}%` }} />
          </div>
          <div className="tabular mt-1 flex justify-between text-[11px] text-cocoa-muted">
            <span>
              {level.xpInLevel.toLocaleString('de-DE')} / {level.xpForLevel.toLocaleString('de-DE')} XP
            </span>
            <span>noch {(level.xpForLevel - level.xpInLevel).toLocaleString('de-DE')} bis Lv {level.level + 1}</span>
          </div>
          <p className="mt-2 text-[11px] text-cocoa-muted">
            {showNutrition
              ? `XP aus Training (${level.fitnessXp.toLocaleString('de-DE')}) + Ernährung (${level.nutritionXp.toLocaleString('de-DE')})`
              : 'XP aus deinen Trainings'}
          </p>
        </div>
      </section>

      {/* Wachstum */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-cocoa-light">So wächst dein Buddy</h2>
        <div className="card grid grid-cols-6 gap-1 px-2">
          {BUDDY_STAGE_SESSIONS.map((min, i) => {
            const reached = sessions >= min
            return (
              <div key={i} className="flex min-w-0 flex-col items-center text-center">
                <Buddy
                  size={48}
                  stage={i}
                  skin={buddy.skin}
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
      </section>

      {/* Meilensteine: kompakte Leiste statt großem Raster */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-cocoa-light">Meilensteine</h2>
          <span className="tabular text-xs text-cocoa-muted">
            {doneCount}/{list.length}
          </span>
        </div>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {list.map((m) => (
            <li
              key={m.id}
              className={`flex w-[84px] shrink-0 flex-col items-center rounded-2xl px-1.5 py-2.5 text-center ${
                m.done ? 'bg-gold/15' : 'bg-sand'
              }`}
              aria-label={`${m.label}${m.done ? ' – erreicht' : ' – offen'}`}
            >
              <span className={`grid h-8 place-items-center text-2xl ${m.done ? '' : 'opacity-50'}`}>
                {m.done ? m.icon : <Lock size={18} className="text-cocoa-muted" />}
              </span>
              <span
                className={`mt-1 text-[11px] leading-tight ${m.done ? 'font-semibold text-cocoa' : 'text-cocoa-light'}`}
              >
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Skins */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-cocoa-light">Skins</h2>
        <div className="grid grid-cols-4 gap-2">
          {SKINS.map((s) => {
            const locked = level.level < s.minLevel
            const active = s.id === buddy.skin
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseSkin(s.id, s.minLevel)}
                disabled={locked}
                aria-pressed={active}
                aria-label={locked ? `${s.label} – ab Level ${s.minLevel}` : s.label}
                className={`relative flex flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 transition-colors duration-200 ${
                  active ? 'bg-sand-light ring-2 ring-cocoa dark:bg-sand-dark' : 'bg-sand'
                }`}
              >
                <Buddy
                  size={56}
                  stage={Math.max(2, stage)}
                  skin={s.id}
                  animate={active}
                  className={locked ? 'opacity-45 saturate-[.6]' : ''}
                />
                <span className="text-[11px] font-medium text-cocoa-light">
                  {locked ? `Lv ${s.minLevel}` : s.label}
                </span>
                {locked && <Lock size={13} className="absolute right-1.5 top-1.5 text-cocoa-light" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* Akzentfarben */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-cocoa-light">Akzentfarbe</h2>
        <div className="card flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const locked = level.level < a.minLevel
            const active = accent === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => chooseAccent(a.id, a.minLevel)}
                disabled={locked}
                aria-pressed={active}
                aria-label={locked ? `${a.label} – ab Level ${a.minLevel}` : a.label}
                className="flex w-10 flex-col items-center gap-1"
              >
                <span
                  className={`relative grid h-9 w-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                    active ? 'ring-cocoa' : 'ring-transparent'
                  } ${locked ? 'opacity-40' : ''}`}
                  style={{ background: a.swatch }}
                >
                  {locked ? (
                    <Lock size={14} className="text-white" />
                  ) : (
                    active && <Check size={16} strokeWidth={3} className="text-white" />
                  )}
                </span>
                <span className="tabular text-[10px] leading-tight text-cocoa-light">
                  {locked ? `Lv ${a.minLevel}` : a.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
