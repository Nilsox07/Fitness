import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Drumstick,
  Dumbbell,
  Flame,
  Hand,
  HandFist,
  Laugh,
  Medal,
  Megaphone,
  Pencil,
  Share2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { Sheet } from '../components/workout/Sheet'
import { useAuth } from '../lib/auth'
import { useAllSets } from '../hooks/useWorkouts'
import { useAllFoodEntries } from '../hooks/useNutrition'
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
  const [gymEditing, setGymEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const [code, setCode] = useState('')
  const [metric, setMetric] = useState<Metric>('monthly_prs')
  const [chMetric, setChMetric] = useState<'weekly_sessions' | 'weekly_volume'>('weekly_sessions')
  const [msg, setMsg] = useState<string | null>(null)

  const nameOf = (id: string) => board?.find((u) => u.user_id === id)?.display_name ?? 'Freund'
  const myRow = board?.find((u) => u.user_id === user?.id)
  const friends = (board ?? []).filter((u) => u.user_id !== user?.id)
  useEffect(() => {
    if (!gymTouched && myRow?.gym_status) setGymInput(myRow.gym_status)
  }, [myRow, gymTouched])

  const daysLeft = 6 - ((new Date().getDay() + 6) % 7)
  const podium = useMemo(
    () => [...(board ?? [])].sort((a, b) => (b[chMetric] as number) - (a[chMetric] as number)).slice(0, 3),
    [board, chMetric],
  )

  // Eigene Aggregat-Statistik beim Öffnen teilen
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const myStats = useMemo(() => {
    const sets = allSets ?? []
    const fe = food ?? []
    const proteinToday = Math.round(
      fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.protein, 0),
    )
    const kcalToday = Math.round(
      fe.filter((e) => e.date === todayStr).reduce((s, e) => s + e.kcal, 0),
    )
    const byDay = new Map<string, number>()
    fe.forEach((e) => byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.protein))
    const last7 = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
    const proteinWeek = last7.length
      ? Math.round(last7.reduce((s, [, v]) => s + v, 0) / last7.length)
      : 0
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const thisWeek = isoWeekKey(new Date().toISOString().slice(0, 10))
    const wv = weeklyVolume(sets).find((w) => w.week === thisWeek)?.volume ?? 0
    const weeklySessions = new Set(
      sets.filter((s) => isoWeekKey(s.date) === thisWeek).map((s) => s.date),
    ).size
    const dates = sets.map((s) => s.date).sort()
    const lvl = levelInfo(computeXp(sets))
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
      protein_today: proteinToday,
      kcal_today: kcalToday,
      protein_week: proteinWeek,
    }
  }, [allSets, food, profile, user, todayStr])

  useEffect(() => {
    if (allSets) syncStats.mutate(myStats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStats.total_sessions, myStats.weekly_volume, myStats.level, myStats.weekly_sessions, myStats.season_xp, myStats.monthly_prs, myStats.protein_today, myStats.protein_week])

  const kudosReceived = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of kudos ?? []) map.set(k.to_user, (map.get(k.to_user) ?? 0) + 1)
    return map
  }, [kudos])
  const gaveToday = useMemo(() => new Set((kudos ?? []).map((k) => k.to_user)), [kudos])

  const ranked = useMemo(
    () => [...(board ?? [])].sort((a, b) => (b[metric] as number) - (a[metric] as number)),
    [board, metric],
  )

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
                  <span className="text-cocoa-light">{u.gym_status || '– kein Plan –'}</span>
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
                  chMetric === m ? 'bg-brand text-white' : 'bg-sand text-cocoa'
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
                  ? `${u.weekly_volume.toLocaleString('de-DE')} kg`
                  : `${u.weekly_sessions}×`
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
            {[...(board ?? [])]
              .sort((a, b) => (b.protein_today ?? 0) - (a.protein_today ?? 0))
              .map((u, i) => {
                const me = u.user_id === user?.id
                return (
                  <li key={u.user_id} className="flex items-center gap-2 text-sm">
                    <span className="tabular w-5 text-center text-cocoa-light">{i + 1}</span>
                    <span className="flex-1">
                      <span className="font-medium">{me ? 'Du' : u.display_name ?? 'Freund'}</span>{' '}
                      <span className="tabular text-cocoa-light">
                        {u.protein_today ?? 0} g · {u.kcal_today ?? 0} kcal
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
                            text: `😂 Nur ${u.protein_today ?? 0} g Protein heute? Schwach!`,
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
              metric === m ? 'bg-brand text-white' : 'bg-sand text-cocoa'
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
                    {u.monthly_prs ?? 0}
                    <Trophy size={14} className="text-cocoa-light" />
                  </span>
                )
              : metric === 'season_xp'
              ? `${u.season_id === seasonId() ? u.season_xp : 0} XP`
              : metric === 'level'
              ? `Lvl ${u.level ?? 1}`
              : metric === 'weekly_volume'
                ? `${u.weekly_volume.toLocaleString('de-DE')} kg`
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
  const friendsPlanList = (
    <>
        {friends.length > 0 && (
          <ul className="space-y-1.5">
            {friends.map((u) => (
              <li key={u.user_id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{u.display_name ?? 'Freund'}</span>{' '}
                  <span className="text-cocoa-light">{u.gym_status || '– kein Plan –'}</span>
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
    </>
  )

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

  const myPlan = myRow?.gym_status ?? ''
  const showGymEdit = gymEditing || !myPlan
  function saveGym() {
    setGymStatus.mutate(gymInput.trim(), { onSuccess: () => setGymEditing(false) })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Community</h1>
        <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={() => navigate('/feed')}>
          <Megaphone size={16} className="text-cocoa-light" />
          Feed
        </button>
        <button
          className="grid h-10 w-10 place-items-center rounded-full bg-sand text-cocoa"
          onClick={() => setAddOpen(true)}
          aria-label="Freund hinzufügen"
        >
          <UserPlus size={18} />
        </button>
      </header>

      {friends.length === 0 && (
        <div className="card space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sand text-cocoa-light">
            <Users size={22} />
          </div>
          <div>
            <div className="font-semibold">Zusammen trainiert es sich besser</div>
            <p className="text-sm text-cocoa-light">
              Füge Freunde hinzu und vergleicht Trainings, Streaks und Bestleistungen.
            </p>
          </div>
          <button
            className="btn-primary flex w-full items-center justify-center gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus size={18} />
            Freund hinzufügen
          </button>
        </div>
      )}

      {/* Leaderboard zuerst */}
      {metricBlock}
      {leaderboardBlock}

      {pokesBlock}

      {/* Wann Gym? — kompakt */}
      <div className="card space-y-2">
        {showGymEdit ? (
          <div className="flex items-center gap-2">
            <input
              className="input min-w-0 flex-1 py-2 text-sm"
              placeholder="Wann gehst du heute?"
              value={gymInput}
              onChange={(e) => {
                setGymInput(e.target.value)
                setGymTouched(true)
              }}
              onKeyDown={(e) => e.key === 'Enter' && saveGym()}
              aria-label="Wann gehst du heute?"
            />
            <button
              className="btn-primary shrink-0 px-3 py-2 text-sm"
              onClick={saveGym}
              disabled={setGymStatus.isPending}
            >
              Setzen
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="shrink-0 text-cocoa-light" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-cocoa-light">Wann gehst du heute?</div>
              <div className="truncate font-semibold">{myPlan}</div>
            </div>
            <button
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-cocoa-light"
              onClick={() => {
                setGymInput(myPlan)
                setGymEditing(true)
              }}
              aria-label="Plan bearbeiten"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
        {friendsPlanList}
      </div>

      {challengeBlock}
      {proteinBlock}

      {addOpen && (
        <Sheet title="Freund hinzufügen" onClose={() => setAddOpen(false)}>
          {codeContent}
        </Sheet>
      )}
    </div>
  )
}
