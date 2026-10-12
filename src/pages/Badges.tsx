import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProgressSwitch } from '../components/ProgressSwitch'
import { TabHeader } from '../components/ui/TabHeader'
import { Check, ChevronLeft, Lock, Share2 } from 'lucide-react'
import { MonthRecapSheet } from '../components/progress/MonthRecapSheet'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { balanceStats, frequencyStats, onlyWorking, totalVolume } from '../lib/analytics'
import { achievements, rankForSessions } from '../lib/gamification'
import { computeXp, levelInfo } from '../lib/xp'
import { ACCENTS, SKINS, mascotEmoji } from '../lib/cosmetics'
import { ACHIEVEMENTS, PRESTIGE_LEVEL, UNLOCKS, nextUnlocks, titleLabel, type UnlockKind } from '../lib/unlocks'
import { accessoryProps } from '../lib/seasonBadges'
import { Wardrobe } from '../components/buddy/Wardrobe'
import { SeasonThemeCard } from '../components/buddy/SeasonThemeCard'
import { BuddyBackdrop } from '../components/buddy/BuddyBackdrop'
import { useAchievements } from '../hooks/useAchievements'
import { useUserPrefs } from '../hooks/usePrefsSync'
import { usePrefs } from '../lib/prefs'
import { milestones } from '../lib/milestones'
import { Buddy, BUDDY_STAGE_SESSIONS } from '../components/buddy/Buddy'
import { useBuddy, useBuddyLevel, useLookPrefs } from '../components/buddy/useBuddy'

const STAGE_LABELS = ['Ei', 'Küken', 'im Aufbau', 'Kraftpaket', 'Athlet', 'Champion']

const KIND_LABEL: Record<UnlockKind, string> = {
  accessory: 'Accessoire',
  skin: 'Skin',
  frame: 'Rahmen',
  background: 'Hintergrund',
  title: 'Titel',
  accent: 'App-Farbe',
  theme: 'Theme',
  variant: 'Variante',
}

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
  const { data: allSets } = useAllSets()
  const { showNutrition } = usePrefs()
  const buddy = useBuddy()
  const level = useBuddyLevel()
  const sessions = level.sessions
  const stage = buddy.stage
  const rank = rankForSessions(sessions)
  const list = useMemo(() => milestones(allSets ?? []), [allSets])
  const doneCount = list.filter((m) => m.done).length

  const look = useLookPrefs()
  const { progress, earned } = useAchievements()
  const { prefs, save } = useUserPrefs()
  const ctx = { level: level.level, prestige: level.prestige, achievements: earned }
  const next = nextUnlocks(ctx, 3)
  const [confirmPrestige, setConfirmPrestige] = useState(false)
  const [recapOpen, setRecapOpen] = useState(false)

  function startPrestige() {
    void save({ prestige: { count: prefs.prestige.count + 1, xpOffset: level.totalXp } })
    try {
      localStorage.setItem('seen_buddy_level', '1')
    } catch {
      /* ignore */
    }
    setConfirmPrestige(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <TabHeader overline="Level, Meilensteine & Freischaltungen" title="Fortschritt" />
        <ProgressSwitch />
      </div>

      {/* Hero: großer Buddy + Level + XP */}
      <section className="card flex flex-col items-center text-center">
        <BuddyBackdrop background={look.background} className="-mx-1 -mt-1 mb-1 h-40 w-[calc(100%+0.5rem)] rounded-2xl">
          <Buddy
            size={132}
            stage={stage}
            skin={look.skin}
            variant={look.variant}
            {...accessoryProps(look.accessory)}
            mood={buddy.mood}
            className="-mt-1"
          />
        </BuddyBackdrop>
        {(titleLabel(look.title) || level.prestige > 0) && (
          <div className="mt-1 flex items-center gap-1.5">
            {level.prestige > 0 && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                {'⭐'.repeat(Math.min(level.prestige, 5))} Prestige {level.prestige}
              </span>
            )}
            {titleLabel(look.title) && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">{titleLabel(look.title)}</span>
            )}
          </div>
        )}
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

      <SeasonThemeCard />

      <button
        className="flex w-full items-center gap-3 rounded-2xl bg-cream p-3.5 text-left transition active:scale-[0.99]"
        onClick={() => setRecapOpen(true)}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Share2 size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Monats-Rückblick teilen</span>
          <span className="block text-xs text-cocoa-light">Deine Zahlen als Story für Instagram & WhatsApp</span>
        </span>
      </button>
      {recapOpen && <MonthRecapSheet onClose={() => setRecapOpen(false)} />}

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

      {/* Als Nächstes */}
      {next.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-cocoa-light">Als Nächstes</h2>
          <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {next.map((u) => (
              <div key={u.kind + u.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tabular grid h-9 w-12 shrink-0 place-items-center rounded-xl bg-sand text-xs font-bold">
                  Lv {u.level}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{u.label}</span>
                <span className="text-xs text-cocoa-muted">{KIND_LABEL[u.kind]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Garderobe */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-cocoa-light">Garderobe</h2>
        <Wardrobe ctx={ctx} stage={stage} />
      </section>

      {/* Erfolge */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-cocoa-light">Erfolge</h2>
          <span className="tabular text-xs text-cocoa-muted">
            {ACHIEVEMENTS.filter((a) => earned.has(a.id)).length}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {ACHIEVEMENTS.map((a) => {
            const done = earned.has(a.id)
            const val = Math.min(a.goal, progress[a.id].value)
            const reward = UNLOCKS.find((u) => u.achievement === a.id)
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    done ? 'bg-success text-white' : 'bg-sand text-cocoa-muted'
                  }`}
                >
                  {done ? <Check size={17} strokeWidth={3} /> : <Lock size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="block text-xs text-cocoa-light">
                    {a.hint}
                    {reward && ` · 🎁 ${reward.label}`}
                  </span>
                  {!done && a.id !== 'prestige1' && (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
                      <span className="block h-full rounded-full bg-brand/70" style={{ width: `${(val / a.goal) * 100}%` }} />
                    </span>
                  )}
                </span>
                {!done && a.id !== 'prestige1' && (
                  <span className="tabular shrink-0 text-xs text-cocoa-muted">
                    {a.id === 'photo8w' ? `${Math.round(val / 7)}/8 Wo.` : `${val}/${a.goal}`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Prestige */}
      {level.level >= PRESTIGE_LEVEL && (
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg dark:bg-sand-light dark:text-cocoa">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="relative space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
              Prestige {level.prestige + 1}
            </div>
            <h2 className="text-xl font-bold">Level {PRESTIGE_LEVEL} geschafft ⭐</h2>
            <p className="text-sm leading-snug text-bg/75 dark:text-cocoa-light">
              Starte dein Level neu bei 1: Alles Freigeschaltete bleibt, du bekommst einen Stern neben deinem Namen und
              den Prestige-Rahmen.
            </p>
            {confirmPrestige ? (
              <div className="flex gap-2 pt-1">
                <button className="btn flex-1 bg-bg/10 text-bg dark:bg-white/5 dark:text-cocoa" onClick={() => setConfirmPrestige(false)}>
                  Abbrechen
                </button>
                <button className="btn-primary flex-1" onClick={startPrestige}>
                  Ja, Prestige starten
                </button>
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={() => setConfirmPrestige(true)}>
                Prestige starten
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
