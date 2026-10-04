import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  ChevronRight,
  Drumstick,
  Flame,
  Hand,
  HandFist,
  Laugh,
  Medal,
  Megaphone,
  MessageCircle,
  Share2,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { Sheet } from '../components/workout/Sheet'
import { ActivityList } from '../components/feed/ActivityCard'
import { useAuthorLookup } from '../components/feed/useAuthorLookup'
import { FriendsRow } from '../components/social/FriendsRow'
import { DuelCard } from '../components/social/DuelCard'
import { TeamGoalCard } from '../components/social/TeamGoalCard'
import { GymMeetCard } from '../components/social/GymMeetCard'
import { FriendSheet } from '../components/social/FriendSheet'
import { LeaderboardSection } from '../components/social/LeaderboardSection'
import { kcalToday as friendKcalToday, planToday, proteinToday as friendProteinToday, type Person } from '../components/social/format'
import { useActivities } from '../hooks/useFeed'
import { localDate } from '../lib/day'
import {
  duelStandings,
  effectiveMonthlyPrs,
  effectiveProteinDays,
  effectiveSessions,
  effectiveWeeklyVolume,
  isThisWeek,
  teamGoal,
} from '../lib/duel'
import { useAuth } from '../lib/auth'
import { useAllSets } from '../hooks/useWorkouts'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import type { UserStat } from '../hooks/useSocial'
import { usePrefs } from '../lib/prefs'
import {
  useAddFriend,
  useDismissPoke,
  useGiveKudos,
  useKudos,
  useLeaderboard,
  useMyProfile,
  usePokes,
  useSendPoke,
  useSetGymStatus,
  useSyncMyStats,
} from '../hooks/useSocial'
import { frequencyStats, isoWeekKey, monthlyPrCount, totalVolume, weeklyVolume } from '../lib/analytics'
import { rankForSessions } from '../lib/gamification'
import { computeXp, levelInfo } from '../lib/xp'
import { buddyLevelInfo } from '../lib/buddyLevel'
import { seasonId, seasonXp } from '../lib/season'

// Reihenfolge = faire Kennzahlen zuerst; Volumen (kraftabhängig) zuletzt.
type Metric = 'monthly_prs' | 'total_sessions' | 'week_streak' | 'season_xp' | 'level' | 'weekly_volume'
const METRIC_LABEL: Record<Metric, string> = {
  monthly_prs: 'Fortschritt',
  total_sessions: 'Trainings',
  week_streak: 'Streak',
  season_xp: 'Season',
  level: 'Level',
  weekly_volume: 'Volumen',
}

export default function Social() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: allSets } = useAllSets()
  const { data: food } = useAllFoodEntries()
  const { data: nutritionSettings } = useNutritionSettings()
  const { showNutrition, isNew } = usePrefs()
  const { data: board } = useLeaderboard()
  const { data: kudos } = useKudos()
  const addFriend = useAddFriend()
  const giveKudos = useGiveKudos()
  const syncStats = useSyncMyStats()
  const setGymStatus = useSetGymStatus()
  const sendPoke = useSendPoke()
  const dismissPoke = useDismissPoke()
  const { data: pokes } = usePokes()
  const [gymInput, setGymInput] = useState('')
  const [gymTouched, setGymTouched] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const [code, setCode] = useState('')
  const [metric, setMetric] = useState<Metric>('monthly_prs')
  const [chMetric, setChMetric] = useState<'weekly_sessions' | 'weekly_volume'>('weekly_sessions')
  const [msg, setMsg] = useState<string | null>(null)

  const nameOf = (id: string) => board?.find((u) => u.user_id === id)?.display_name ?? 'Freund'
  const myRow = board?.find((u) => u.user_id === user?.id)
  const friends = useMemo(() => (board ?? []).filter((u) => u.user_id !== user?.id), [board, user?.id])
  // Eigene Aggregat-Statistik beim Öffnen teilen
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  useEffect(() => {
    // Nur einen HEUTIGEN Plan vorbefüllen (ohne das kodierte Datum).
    const plan = myRow ? planToday(myRow, todayStr) : null
    if (!gymTouched && plan) setGymInput(plan)
  }, [myRow, gymTouched, todayStr])

  // Wochen-/Monatswerte nur, wenn sie aus dem aktuellen Zeitraum stammen
  // (sonst würde eine veraltete Vorwochen-Zahl mitzählen).
  const chValue = (u: UserStat) =>
    chMetric === 'weekly_volume' ? effectiveWeeklyVolume(u, todayStr) : effectiveSessions(u, todayStr)
  const daysLeft = 6 - ((new Date().getDay() + 6) % 7)
  const podium = [...(board ?? [])].sort((a, b) => chValue(b) - chValue(a)).slice(0, 3)

  const myStats = useMemo(() => {
    const sets = allSets ?? []
    const fe = food ?? []
    const proteinToday = Math.round(
      fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.protein, 0),
    )
    const kcalToday = Math.round(
      fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.kcal, 0),
    )
    // Tage dieser Woche (Mo–So) mit erreichtem Protein-Ziel (0–7) — fürs Wochen-Duell.
    const proteinTarget = nutritionSettings?.protein_target ?? 0
    const byDay = new Map<string, number>()
    fe.filter((e) => isThisWeek(e.date, todayStr)).forEach((e) =>
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.protein),
    )
    const proteinWeek =
      proteinTarget > 0 ? [...byDay.values()].filter((v) => v >= proteinTarget).length : 0
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const thisWeek = isoWeekKey(new Date().toISOString().slice(0, 10))
    const wv = weeklyVolume(sets).find((w) => w.week === thisWeek)?.volume ?? 0
    const weeklySessions = new Set(
      sets.filter((s) => isoWeekKey(s.date) === thisWeek).map((s) => s.date),
    ).size
    const dates = sets.map((s) => s.date).sort()
    // Neue App: geteiltes Level = Buddy-Level (ein Level für alles).
    const lvl = isNew
      ? buddyLevelInfo({ sets, foodEntries: fe, proteinTarget, showNutrition, today: todayStr })
      : levelInfo(computeXp(sets))
    return {
      display_name: profile?.display_name ?? user?.email?.split('@')[0] ?? 'Ich',
      total_sessions: freq.totalSessions,
      week_streak: freq.weekStreak,
      tonnage: Math.round(totalVolume(sets)),
      weekly_volume: Math.round(wv),
      last_workout: dates[dates.length - 1] ?? null,
      rank_title: rankForSessions(freq.totalSessions).title,
      level: lvl.level,
      xp: lvl.xp,
      weekly_sessions: weeklySessions,
      season_id: seasonId(),
      season_xp: seasonXp(sets),
      monthly_prs: monthlyPrCount(sets),
      // Ernährung ausgeblendet → auch nichts davon teilen.
      protein_today: showNutrition ? proteinToday : 0,
      kcal_today: showNutrition ? kcalToday : 0,
      protein_week: showNutrition ? proteinWeek : 0,
    }
  }, [allSets, food, profile, user, todayStr, nutritionSettings, showNutrition, isNew])

  useEffect(() => {
    if (allSets) syncStats.mutate(myStats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStats.total_sessions, myStats.weekly_volume, myStats.level, myStats.weekly_sessions, myStats.season_xp, myStats.monthly_prs, myStats.protein_today, myStats.kcal_today, myStats.protein_week])

  const kudosReceived = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of kudos ?? []) map.set(k.to_user, (map.get(k.to_user) ?? 0) + 1)
    return map
  }, [kudos])
  const gaveToday = useMemo(() => new Set((kudos ?? []).map((k) => k.to_user)), [kudos])

  const metricValue = (u: UserStat, m: Metric): number =>
    m === 'monthly_prs'
      ? effectiveMonthlyPrs(u, todayStr)
      : m === 'weekly_volume'
        ? effectiveWeeklyVolume(u, todayStr)
        : m === 'season_xp'
          ? u.season_id === seasonId()
            ? (u.season_xp ?? 0)
            : 0
          : ((u[m] as number) ?? 0)
  const ranked = [...(board ?? [])].sort((a, b) => metricValue(b, metric) - metricValue(a, metric))

  // Protein-Battle: eigene Zahlen lokal frisch, Freunde nur, wenn von heute.
  const battle = (board ?? [])
    .map((u) =>
      u.user_id === user?.id
        ? { u, protein: myStats.protein_today, kcal: myStats.kcal_today }
        : { u, protein: friendProteinToday(u, todayStr), kcal: friendKcalToday(u, todayStr) },
    )
    .sort((a, b) => b.protein - a.protein)

  async function submitCode() {
    setMsg(null)
    try {
      await addFriend.mutateAsync(code)
      setCode('')
      setMsg('Freund hinzugefügt!')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler')
    }
  }

  async function shareCode() {
    const text = `Füg mich im Fitness-Tracker hinzu! Mein Code: ${profile?.friend_code}`
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) await nav.share({ text })
    else {
      await navigator.clipboard?.writeText(profile?.friend_code ?? '')
      setMsg('Code kopiert.')
    }
  }

  const pokesBlock = (
    <>
      {/* Eingehende Anstupser */}
      {(pokes?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {pokes!.map((p) => (
            <div
              key={p.id}
              className="anim-fade flex items-center gap-2 rounded-xl bg-sand p-2.5 text-sm"
            >
              <span className="flex-1">
                {p.text ? (
                  <>
                    <strong>{nameOf(p.from_user)}</strong>: {p.text}
                  </>
                ) : (
                  <>
                    <HandFist size={16} className="mr-1 inline-block align-[-3px] text-cocoa-light" />
                    <strong>{nameOf(p.from_user)}</strong> fragt: wann gehst du wieder ins Gym?
                  </>
                )}
              </span>
              <button
                className="rounded-full bg-sand-light px-2 py-1 text-xs font-semibold"
                onClick={() => dismissPoke.mutate(p.id)}
              >
                OK
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
  const gymBlock = (
    <>
      {/* Wann Gym? */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Wann Gym?</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Dein Plan, z. B. heute 18 Uhr"
            value={gymInput}
            onChange={(e) => {
              setGymInput(e.target.value)
              setGymTouched(true)
            }}
            onKeyDown={(e) => e.key === 'Enter' && setGymStatus.mutate(gymInput.trim())}
          />
          <button
            className="btn-primary shrink-0"
            onClick={() => setGymStatus.mutate(gymInput.trim())}
            disabled={setGymStatus.isPending}
          >
            Setzen
          </button>
        </div>
        {friends.length > 0 && (
          <ul className="space-y-1.5">
            {friends.map((u) => (
              <li key={u.user_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{u.display_name ?? 'Freund'}</span>{' '}
                  <span className="text-cocoa-light">{planToday(u, todayStr) ?? '– kein Plan –'}</span>
                </span>
                <button
                  className="flex shrink-0 items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-semibold"
                  onClick={() => sendPoke.mutate({ toUser: u.user_id })}
                >
                  <HandFist size={14} className="text-cocoa-light" />
                  Fragen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
  const challengeBlock = (
    <>
      {/* Wochen-Challenge */}
      {(board?.length ?? 0) > 1 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <Trophy size={18} className="text-cocoa-light" />
              Wochen-Challenge
            </h2>
            <span className="tabular text-xs text-cocoa-light">
              {daysLeft === 0 ? 'letzter Tag!' : `noch ${daysLeft} Tage`}
            </span>
          </div>
          <div className="flex gap-2">
            {(['weekly_sessions', 'weekly_volume'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChMetric(m)}
                className={`rounded-full px-3 py-1 text-xs transition-colors duration-200 ${
                  chMetric === m ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
                }`}
              >
                {m === 'weekly_volume' ? 'Volumen' : 'Trainings'}
              </button>
            ))}
          </div>
          <div className="flex items-end justify-center gap-3 pt-1">
            {[1, 0, 2].map((rank) => {
              const u = podium[rank]
              if (!u) return <div key={rank} className="flex-1" />
              const val =
                chMetric === 'weekly_volume'
                  ? `${chValue(u).toLocaleString('de-DE')} kg`
                  : `${chValue(u)}×`
              const h = rank === 0 ? 'h-20' : rank === 1 ? 'h-16' : 'h-12'
              return (
                <div key={rank} className="flex flex-1 flex-col items-center">
                  <div className="flex items-center gap-0.5 text-sm font-bold text-cocoa-light">
                    <Medal size={20} className={rank === 0 ? 'text-gold' : 'text-cocoa-light'} />
                    <span className="tabular">{rank + 1}</span>
                  </div>
                  <div className="max-w-full truncate text-xs font-medium">
                    {u.user_id === user?.id ? 'Du' : u.display_name ?? 'Athlet'}
                  </div>
                  <div className="tabular text-[11px] text-cocoa-light">{val}</div>
                  <div className={`mt-1 w-full rounded-t-lg ${rank === 0 ? 'bg-gold' : 'bg-sand'} ${h}`} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
  const proteinBlock = (
    <>
      {/* Ernährungs-Battle (Protein) */}
      {showNutrition && (board?.length ?? 0) > 1 && (
        <div className="card space-y-2">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <Drumstick size={18} className="text-cocoa-light" />
            Protein-Battle (heute)
          </h2>
          <ul className="space-y-1.5">
            {battle.map(({ u, protein, kcal }, i) => {
                const me = u.user_id === user?.id
                return (
                  <li key={u.user_id} className="flex items-center gap-2 text-sm">
                    <span className="tabular w-5 text-center text-cocoa-light">{i + 1}</span>
                    <span className="flex-1">
                      <span className="font-medium">{me ? 'Du' : u.display_name ?? 'Freund'}</span>{' '}
                      <span className="tabular text-cocoa-light">
                        {protein} g · {kcal} kcal
                      </span>
                    </span>
                    {!me && (
                      <button
                        className="grid h-7 w-7 place-items-center rounded-full bg-sand text-cocoa-light"
                        title="Auslachen"
                        aria-label="Auslachen"
                        onClick={() =>
                          sendPoke.mutate({
                            toUser: u.user_id,
                            text: `😂 Nur ${protein} g Protein heute? Schwach!`,
                          })
                        }
                      >
                        <Laugh size={16} />
                      </button>
                    )}
                  </li>
                )
              })}
          </ul>
          <p className="text-xs text-cocoa-muted">
            Zeigt nur Summen (Protein/kcal) — keine einzelnen Lebensmittel.
          </p>
        </div>
      )}
    </>
  )
  const codeContent = (
    <>

        <div className="flex items-center justify-between">
          <div>
            <div className="label">Dein Freundescode</div>
            <div className="tabular text-xl font-bold tracking-widest">{profile?.friend_code ?? '…'}</div>
          </div>
          <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={shareCode}>
            <Share2 size={16} className="text-cocoa-light" />
            Teilen
          </button>
        </div>
        <div className="flex gap-2">
          <input
            className="input uppercase"
            placeholder="Code eingeben"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCode()}
          />
          <button
            className="btn-primary flex shrink-0 items-center gap-1.5"
            onClick={submitCode}
            disabled={addFriend.isPending}
          >
            <UserPlus size={16} />
            Freund
          </button>
        </div>
        {msg && <p className="text-sm text-brand">{msg}</p>}
        <p className="text-xs text-cocoa-muted">
          Freunde sehen nur deine Kennzahlen (Trainings, Volumen, Streak) — keine einzelnen Sätze
          oder Ernährung.
        </p>
    </>
  )
  const metricBlock = (
    <>
      {/* Metrik-Auswahl */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
              metric === m ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa'
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>
      <p className="-mt-2 px-1 text-xs text-cocoa-muted">
        Fair vergleichen: <strong>Fortschritt</strong> (neue Bestleistungen/Monat) &amp;{' '}
        <strong>Trainings</strong> zählen für alle gleich — Volumen hängt vom Kraftniveau ab.
      </p>
    </>
  )
  const leaderboardBlock = (
    <>
      {/* Leaderboard */}
      <ol className="space-y-2">
        {ranked.map((u, i) => {
          const me = u.user_id === user?.id
          const value =
            metric === 'monthly_prs'
              ? (
                  <span className="inline-flex items-center gap-1">
                    {metricValue(u, 'monthly_prs')}
                    <Trophy size={14} className="text-cocoa-light" />
                  </span>
                )
              : metric === 'season_xp'
              ? `${u.season_id === seasonId() ? u.season_xp : 0} XP`
              : metric === 'level'
              ? `Lvl ${u.level ?? 1}`
              : metric === 'weekly_volume'
                ? `${metricValue(u, 'weekly_volume').toLocaleString('de-DE')} kg`
                : metric === 'total_sessions'
                  ? `${u.total_sessions}`
                  : (
                      <span className="inline-flex items-center gap-1">
                        <Flame size={14} className="text-cocoa-light" />
                        {u.week_streak}
                      </span>
                    )
          return (
            <li
              key={u.user_id}
              className={`card flex items-center gap-3 ${me ? (isNew ? 'ring-1 ring-brand' : 'ring-2 ring-brand') : ''}`}
            >
              <span className="tabular grid w-6 place-items-center text-lg font-bold text-cocoa-light">
                {i < 3 ? (
                  <Medal size={20} className={i === 0 ? 'text-gold' : 'text-cocoa-light'} aria-label={`Platz ${i + 1}`} />
                ) : (
                  i + 1
                )}
              </span>
              <div className="flex-1">
                <div className="font-semibold">
                  {u.display_name ?? 'Athlet'} {me && <span className="text-xs text-brand">(du)</span>}
                </div>
                <div className="tabular flex flex-wrap items-center gap-x-1 text-xs text-cocoa-light">
                  {u.rank_title ?? ''} · {u.total_sessions} Trainings
                  {kudosReceived.get(u.user_id) ? (
                    <span className="inline-flex items-center gap-1">
                      · <Hand size={12} /> {kudosReceived.get(u.user_id)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="tabular text-right text-sm font-semibold">{value}</div>
              {!me && (
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light transition-colors duration-200 disabled:opacity-40"
                  onClick={() => giveKudos.mutate(u.user_id)}
                  disabled={gaveToday.has(u.user_id)}
                  aria-label="Kudos geben"
                >
                  <Hand size={16} />
                </button>
              )}
            </li>
          )
        })}
        {!isNew && ranked.length <= 1 && (
          <li className="text-sm text-cocoa-light">
            Noch keine Freunde. Teile deinen Code oder gib den Code eines Freundes ein.
          </li>
        )}
      </ol>
    </>
  )
  // ── Neues Design ──────────────────────────────────────────────
  const today = localDate()
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: activities } = useActivities()
  const authorOf = useAuthorLookup()
  const latest = useMemo(() => (activities ?? []).slice(0, 5), [activities])
  const kudosGiven = useMemo(
    () => new Set((kudos ?? []).filter((k) => k.from_user === user?.id).map((k) => k.to_user)),
    [kudos, user?.id],
  )
  // Eigene Zeile: lokale (frische) Zahlen + geteilter Gym-Status.
  const mePerson = useMemo<Person>(
    () => ({
      ...(myRow as Person | undefined),
      ...myStats,
      user_id: user?.id ?? 'me',
      gym_status: myRow?.gym_status ?? null,
    }),
    [myRow, myStats, user?.id],
  )
  const people = useMemo(() => [mePerson, ...(friends as Person[])], [mePerson, friends])
  // Für alle Freunde gleich: nur geteilte Daten entscheiden (nicht die lokale
  // Ernährungs-Einstellung des Betrachters) — sobald jemand diese Woche
  // Protein-Tage hat, zählen sie für alle.
  const includeProtein = people.some((u) => effectiveProteinDays(u, today) > 0)
  const standings = useMemo(
    () => duelStandings(people, { includeProtein, today }),
    [people, includeProtein, today],
  )
  const team = useMemo(() => teamGoal(people, today), [people, today])
  const openPerson = openId ? people.find((u) => u.user_id === openId) ?? null : null

  if (!isNew) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-bold">Community</h1>
          <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={() => navigate('/feed')}>
            <Megaphone size={16} className="text-cocoa-light" />
            Feed
          </button>
        </header>
        {pokesBlock}
        {gymBlock}
        {challengeBlock}
        {proteinBlock}
        <div className="card space-y-3">{codeContent}</div>
        {metricBlock}
        {leaderboardBlock}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Community</h1>
        <button
          className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa"
          onClick={() => setAddOpen(true)}
          aria-label="Freund hinzufügen"
        >
          <UserPlus size={18} />
        </button>
      </header>

      <FriendsRow
        me={mePerson}
        friends={friends}
        today={today}
        onOpen={(u) => setOpenId(u.user_id)}
        onInvite={() => setAddOpen(true)}
      />

      {friends.length === 0 ? (
        <div className="card space-y-4">
          <div className="space-y-1 text-center">
            <div className="font-semibold">Zusammen trainiert es sich besser</div>
            <p className="text-sm text-cocoa-light">Lade Freunde ein — dann bekommt ihr:</p>
          </div>
          <ul className="space-y-3">
            {[
              { Icon: Trophy, title: 'Wochen-Duell', text: 'Punkte für jedes Training, jeden Montag neu.' },
              { Icon: CalendarClock, title: 'Gym-Treff', text: 'Sag, wann du gehst — und verabredet euch.' },
              { Icon: MessageCircle, title: 'Aktivitäten', text: 'Rekorde & Trainings feiern, kommentieren.' },
            ].map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light">
                  <Icon size={17} />
                </span>
                <span className="text-sm">
                  <span className="block font-semibold">{title}</span>
                  <span className="text-cocoa-light">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            className="btn-primary flex w-full items-center justify-center gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus size={18} />
            Freund hinzufügen
          </button>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <SectionHead
              title="Diese Woche"
              right={daysLeft === 0 ? 'letzter Tag' : daysLeft === 1 ? 'noch 1 Tag' : `noch ${daysLeft} Tage`}
            />
            <DuelCard
              people={people}
              meId={mePerson.user_id}
              standings={standings}
              includeProtein={includeProtein}
            />
            <TeamGoalCard goal={team} people={people} meId={mePerson.user_id} />
          </section>

          <section className="space-y-2">
            <SectionHead title="Gym-Treff" />
            <GymMeetCard
              me={mePerson}
              friends={friends}
              today={today}
              onOpenFriend={(u) => setOpenId(u.user_id)}
            />
          </section>
        </>
      )}

      <section className="space-y-2">
        <SectionHead
          title="Aktivitäten"
          right={
            (activities?.length ?? 0) > 0 ? (
              <button
                className="flex items-center text-sm font-semibold text-brand"
                onClick={() => navigate('/feed')}
              >
                Alle
                <ChevronRight size={16} />
              </button>
            ) : undefined
          }
        />
        {latest.length > 0 ? (
          <>
            <ActivityList activities={latest} authorOf={authorOf} />
            {(activities?.length ?? 0) > latest.length && (
              <button
                className="card flex w-full items-center justify-between text-sm font-semibold"
                onClick={() => navigate('/feed')}
              >
                Alle Aktivitäten
                <ChevronRight size={18} className="text-cocoa-muted" />
              </button>
            )}
          </>
        ) : (
          <div className="card text-center text-sm text-cocoa-light">
            Noch nichts los. Schließ ein Training ab — es erscheint hier.
          </div>
        )}
      </section>

      {friends.length > 0 && (
        <LeaderboardSection
          board={board ?? []}
          meId={mePerson.user_id}
          kudosReceived={kudosReceived}
          kudosGiven={kudosGiven}
          onKudos={(id) => giveKudos.mutate(id)}
        />
      )}

      {openPerson && (
        <FriendSheet
          person={openPerson}
          me={mePerson}
          today={today}
          showNutrition={showNutrition}
          kudosGiven={kudosGiven.has(openPerson.user_id)}
          onClose={() => setOpenId(null)}
        />
      )}

      {addOpen && (
        <Sheet title="Freund hinzufügen" onClose={() => setAddOpen(false)}>
          {codeContent}
        </Sheet>
      )}
    </div>
  )
}

function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm font-semibold text-cocoa-light">{title}</h2>
      {typeof right === 'string' ? (
        <span className="tabular text-xs text-cocoa-muted">{right}</span>
      ) : (
        right
      )}
    </div>
  )
}
