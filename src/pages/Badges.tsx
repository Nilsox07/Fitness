import { useMemo, useState } from 'react'
import { TabHeader } from '../components/ui/TabHeader'
import { Check, ChevronRight, Lock, Palette, Share2 } from 'lucide-react'
import { MonthRecapSheet } from '../components/progress/MonthRecapSheet'
import { useAllSets } from '../hooks/useWorkouts'
import { rankForSessions } from '../lib/gamification'
import { ACHIEVEMENTS, PRESTIGE_LEVEL, UNLOCKS, nextUnlocks, titleLabel, type UnlockKind } from '../lib/unlocks'
import { accessoryProps } from '../lib/seasonBadges'
import { useNavigate } from 'react-router-dom'
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

export default function Badges() {
  return <BuddyPage />
}

/** „Buddy" — Level, Wachstum, Meilensteine und Freischaltungen an einem Ort. */
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
  const navigate = useNavigate()
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
        <TabHeader overline="Level & Meilensteine" title="Erfolge" />
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
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                {'⭐'.repeat(Math.min(level.prestige, 5))} Prestige {level.prestige}
              </span>
            )}
            {titleLabel(look.title) && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
                {titleLabel(look.title)}
              </span>
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
            <span>
              noch {(level.xpForLevel - level.xpInLevel).toLocaleString('de-DE')} bis Lv {level.level + 1}
            </span>
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

      {/* Garderobe liegt unter Profil → Aussehen */}
      <button
        onClick={() => navigate('/profile?s=appearance')}
        className="flex w-full items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left active:bg-sand/60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Palette size={18} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold">Buddy & App-Farbe anpassen</span>
        <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
      </button>

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
                      <span
                        className="block h-full rounded-full bg-brand/70"
                        style={{ width: `${(val / a.goal) * 100}%` }}
                      />
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
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
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
                <button
                  className="btn flex-1 bg-bg/10 text-bg dark:bg-white/5 dark:text-cocoa"
                  onClick={() => setConfirmPrestige(false)}
                >
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
