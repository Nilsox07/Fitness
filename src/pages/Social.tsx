import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, ChevronRight, HeartPulse, Share2, UserPlus, Users } from 'lucide-react'
import { Sheet } from '../components/workout/Sheet'
import { DigestList } from '../components/feed/ActivityCard'
import { useAuthorLookup } from '../components/feed/useAuthorLookup'
import { FriendsRow } from '../components/social/FriendsRow'
import { DuelHero } from '../components/social/DuelHero'
import { ProteinDuelHero } from '../components/social/ProteinDuelHero'
import { TeamGoalCard } from '../components/social/TeamGoalCard'
import { GymMeetCard } from '../components/social/GymMeetCard'
import { WeekCarousel } from '../components/social/WeekCarousel'
import { InboxSheet } from '../components/social/InboxSheet'
import { useInbox } from '../hooks/useInbox'
import { FriendSheet } from '../components/social/FriendSheet'
import { StakeCard } from '../components/social/StakeCard'
import { LeaderboardHero } from '../components/social/LeaderboardHero'
import { useChallenges } from '../hooks/useChallenges'
import { weekStartOf } from '../lib/stakes'
import { InviteCard } from '../components/social/InviteCard'
import { SectionTitle } from '../components/community/ui'
import { TabHeader } from '../components/ui/TabHeader'
import {
  buildDigest,
  communitySubtitle,
  shortName,
  daysLeftLabel,
  enter,
  PROTEIN_TEAM_DAYS,
  proteinStandings,
} from '../components/community/communityUtils'
import { daysBetween, planToday, type Person } from '../components/social/format'
import { useActivities } from '../hooks/useFeed'
import { localDate } from '../lib/day'
import { daysLeftInWeek, duelStandings, effectiveProteinDays, isThisWeek, teamGoal } from '../lib/duel'
import { useAuth } from '../lib/auth'
import { useAllSets } from '../hooks/useWorkouts'
import { useAllFoodEntries, useNutritionSettings } from '../hooks/useNutrition'
import { usePrefs } from '../lib/prefs'
import {
  useAddFriend,
  useGiveKudos,
  useKudos,
  useLeaderboard,
  useMyProfile,
  useSyncMyStats,
  shareMyLook,
} from '../hooks/useSocial'
import { getLook } from '../lib/cosmetics'
import { frequencyStats, isoWeekKey, monthlyPrCount, totalVolume, weeklyVolume } from '../lib/analytics'
import { rankForSessions } from '../lib/gamification'
import { buddyLevelInfo } from '../lib/buddyLevel'
import { seasonId, seasonXp } from '../lib/season'
import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { Hero, HeroPill } from '../components/health/ui'

export default function Social() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: allSets } = useAllSets()
  const { data: food } = useAllFoodEntries()
  const { data: nutritionSettings } = useNutritionSettings()
  const { showNutrition } = usePrefs()
  const { data: board } = useLeaderboard()
  const { data: kudos } = useKudos()
  const addFriend = useAddFriend()
  const giveKudos = useGiveKudos()
  const syncStats = useSyncMyStats()
  // Eigenes Outfit (Rahmen, Titel, Accessoire) für Freunde teilen
  useEffect(() => {
    if (user) void shareMyLook(user.id, getLook())
  }, [user])
  const [addOpen, setAddOpen] = useState(false)

  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const myRow = board?.find((u) => u.user_id === user?.id)
  const friends = useMemo(() => (board ?? []).filter((u) => u.user_id !== user?.id), [board, user?.id])
  // Eigene Aggregat-Statistik beim Öffnen teilen
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const myStats = useMemo(() => {
    const sets = allSets ?? []
    const fe = food ?? []
    const proteinToday = Math.round(fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.protein, 0))
    const kcalToday = Math.round(fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.kcal, 0))
    // Tage dieser Woche (Mo–So) mit erreichtem Protein-Ziel (0–7) — fürs Wochen-Duell.
    const proteinTarget = nutritionSettings?.protein_target ?? 0
    const byDay = new Map<string, number>()
    fe.filter((e) => isThisWeek(e.date, todayStr)).forEach((e) =>
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.protein),
    )
    const proteinWeek = proteinTarget > 0 ? [...byDay.values()].filter((v) => v >= proteinTarget).length : 0
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const thisWeek = isoWeekKey(new Date().toISOString().slice(0, 10))
    const wv = weeklyVolume(sets).find((w) => w.week === thisWeek)?.volume ?? 0
    const weeklySessions = new Set(sets.filter((s) => isoWeekKey(s.date) === thisWeek).map((s) => s.date)).size
    const dates = sets.map((s) => s.date).sort()
    // Geteiltes Level = Buddy-Level (ein Level für alles).
    const lvl = buddyLevelInfo({ sets, foodEntries: fe, proteinTarget, showNutrition, today: todayStr })
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
  }, [allSets, food, profile, user, todayStr, nutritionSettings, showNutrition])

  useEffect(() => {
    if (allSets) syncStats.mutate(myStats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    myStats.total_sessions,
    myStats.weekly_volume,
    myStats.level,
    myStats.weekly_sessions,
    myStats.season_xp,
    myStats.monthly_prs,
    myStats.protein_today,
    myStats.kcal_today,
    myStats.protein_week,
  ])

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
        Freunde sehen nur deine Kennzahlen (Trainings, Volumen, Streak) — keine einzelnen Sätze oder Ernährung.
      </p>
    </>
  )
  const today = localDate()
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: activities } = useActivities()
  const authorOf = useAuthorLookup()
  // Ruhiger Feed: Freunde pro Tag gebündelt, von dir nur Höhepunkte
  const digest = useMemo(() => buildDigest(activities ?? [], user?.id), [activities, user?.id])
  const latest = useMemo(() => digest.slice(0, 5), [digest])
  const [inboxOpen, setInboxOpen] = useState(false)
  const [gymOpen, setGymOpen] = useState(false)
  const { unread } = useInbox()
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
  const standings = useMemo(() => duelStandings(people, { includeProtein, today }), [people, includeProtein, today])
  const team = useMemo(() => teamGoal(people, today), [people, today])
  const { data: challengeList } = useChallenges()
  // Wetten dieser Woche + Ergebnisse der letzten Woche (bis Mittwoch sichtbar)
  const stakes = useMemo(() => {
    const thisWeek = weekStartOf(today)
    const showLast = daysBetween(thisWeek, today) <= 2
    return (challengeList ?? []).filter((c) => c.week_start === thisWeek || (showLast && c.status === 'active'))
  }, [challengeList, today])
  const protein = useMemo(
    () =>
      proteinStandings(
        { user_id: mePerson.user_id, days: myStats.protein_week, today: myStats.protein_today },
        friends as Person[],
        today,
      ),
    [mePerson.user_id, myStats.protein_week, myStats.protein_today, friends, today],
  )
  const weekLeft = daysLeftInWeek(today)
  const heroBuddy = useHeroBuddy('social')
  const ranked = [...standings.scores].sort((a, b) => b.total - a.total)
  const myRank = ranked.findIndex((x) => x.user_id === mePerson.user_id) + 1
  const activeToday = people.filter((u) => u.last_workout?.slice(0, 10) === today).length
  const openPerson = openId ? (people.find((u) => u.user_id === openId) ?? null) : null

  // Kurzfassung für den Gym-Treff-Knopf: wer heute wann geht
  const gymSummary = (() => {
    const going = (friends as Person[])
      .map((u) => ({ u, plan: planToday(u, today) }))
      .filter((x) => x.plan && !/nicht/i.test(x.plan))
    const mine = planToday(mePerson, today)
    if (going.length)
      return `${shortName(going[0].u.display_name)}: ${going[0].plan}${going.length > 1 ? ` +${going.length - 1}` : ''}`
    return mine ? `Du: ${mine}` : 'Wann gehst du heute?'
  })()
  const hasFriends = friends.length > 0
  const allLink =
    digest.length > 0 ? (
      <button className="flex items-center text-sm font-semibold text-brand" onClick={() => navigate('/feed')}>
        Alle
        <ChevronRight size={16} />
      </button>
    ) : undefined

  return (
    <div className="space-y-6">
      <TabHeader
        overline={communitySubtitle(friends as Person[], 'fitness', today)}
        title="Community"
        style={enter(0)}
        action={
          <button
            className="relative grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
            onClick={() => setInboxOpen(true)}
            aria-label={unread ? `Nachrichten, ${unread} neu` : 'Nachrichten'}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="tabular absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-on-brand ring-2 ring-bg">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        }
      />

      {hasFriends ? (
        <Hero
          buddy={heroBuddy}
          overline="Diese Woche"
          value={team.done}
          unit={team.done === 1 ? 'Training im Team' : 'Trainings im Team'}
          index={1}
        >
          <div className="mt-3 grid grid-cols-3 gap-2">
            <HeroPill value={friends.length} label={friends.length === 1 ? 'Freund' : 'Freunde'} />
            <HeroPill value={myRank > 0 ? `#${myRank}` : '–'} label="dein Platz" />
            <HeroPill value={activeToday} label="heute aktiv" />
          </div>
        </Hero>
      ) : (
        <InviteCard world="fitness" onAdd={() => setAddOpen(true)} buddy={heroBuddy} style={enter(1)} />
      )}

      {hasFriends && (
        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left transition active:scale-[0.99]"
          onClick={() => setGymOpen(true)}
          style={enter(1)}
        >
          <CalendarClock size={18} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold text-cocoa">Gym-Treff</span>
            <span className="text-cocoa-light"> · {gymSummary}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />
        </button>
      )}

      <div style={enter(1)}>
        <FriendsRow
          me={mePerson}
          friends={friends}
          today={today}
          combined
          onOpen={(u) => setOpenId(u.user_id)}
          onInvite={() => setAddOpen(true)}
        />
      </div>

      {!hasFriends ? null : (
        <section className="space-y-3" style={enter(2)}>
          <SectionTitle right={<span className="text-xs text-cocoa-muted">{daysLeftLabel(weekLeft)}</span>}>
            Diese Woche
          </SectionTitle>
          <WeekCarousel>
            {stakes.map((c) => {
              const friend = people.find((p) => p.user_id === (c.creator === mePerson.user_id ? c.opponent : c.creator))
              return (
                <StakeCard
                  key={c.id}
                  c={c}
                  meId={mePerson.user_id}
                  friendName={shortName(friend?.display_name)}
                  today={today}
                />
              )
            })}
            <DuelHero
              people={people}
              meId={mePerson.user_id}
              standings={standings}
              includeProtein={includeProtein}
              today={today}
              daysLeft={weekLeft}
            />
            {showNutrition && (
              <ProteinDuelHero
                people={people}
                meId={mePerson.user_id}
                rows={protein.rows}
                leaderId={protein.leaderId}
                maxToday={protein.maxToday}
                today={today}
                daysLeft={weekLeft}
              />
            )}
            <TeamGoalCard
              title="Zusammen trainieren"
              icon={<Users size={17} />}
              done={team.done}
              target={team.target}
              unit="Trainings"
              people={people}
              meId={mePerson.user_id}
            />
            {showNutrition && (
              <TeamGoalCard
                title="Gemeinsam gesund"
                icon={<HeartPulse size={17} />}
                done={protein.totalDays}
                target={PROTEIN_TEAM_DAYS * people.length}
                unit="Eiweiß-Tage"
                people={people}
                meId={mePerson.user_id}
                tone="success"
              />
            )}
            <LeaderboardHero
              people={people}
              meId={mePerson.user_id}
              today={today}
              withFood={showNutrition}
              kudosGiven={kudosGiven}
              onKudos={(id) => giveKudos.mutate(id)}
            />
          </WeekCarousel>
        </section>
      )}

      {gymOpen && (
        <Sheet title="Gym-Treff" onClose={() => setGymOpen(false)}>
          <GymMeetCard
            me={mePerson}
            friends={friends}
            today={today}
            onOpenFriend={(u) => {
              setGymOpen(false)
              setOpenId(u.user_id)
            }}
          />
        </Sheet>
      )}

      <section style={enter(4)}>
        <SectionTitle right={allLink}>Aktivitäten</SectionTitle>
        {latest.length > 0 ? (
          <>
            <DigestList digests={latest} authorOf={authorOf} />
            {digest.length > latest.length && (
              <button
                className="card mt-3 flex w-full items-center justify-between py-3.5 text-sm font-semibold"
                onClick={() => navigate('/feed')}
              >
                Alle Aktivitäten
                <ChevronRight size={18} className="text-cocoa-muted" />
              </button>
            )}
          </>
        ) : (
          <div className="rounded-2xl bg-cream p-5 text-center text-sm text-cocoa-light">
            {hasFriends
              ? 'Noch nichts los. Trainings deiner Freunde und deine Rekorde erscheinen hier.'
              : 'Sobald du Freunde hast, siehst du hier ihre Trainings – und sie deine Rekorde.'}
          </div>
        )}
      </section>

      {inboxOpen && <InboxSheet people={people} today={today} onClose={() => setInboxOpen(false)} />}

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
