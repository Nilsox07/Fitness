import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAllSets } from '../hooks/useWorkouts'
import {
  useAddFriend,
  useGiveKudos,
  useKudos,
  useLeaderboard,
  useMyProfile,
  useSyncMyStats,
} from '../hooks/useSocial'
import { frequencyStats, isoWeekKey, totalVolume, weeklyVolume } from '../lib/analytics'
import { rankForSessions } from '../lib/gamification'

type Metric = 'weekly_volume' | 'total_sessions' | 'week_streak'
const METRIC_LABEL: Record<Metric, string> = {
  weekly_volume: 'Volumen (Woche)',
  total_sessions: 'Trainings',
  week_streak: 'Streak',
}

export default function Social() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: allSets } = useAllSets()
  const { data: board } = useLeaderboard()
  const { data: kudos } = useKudos()
  const addFriend = useAddFriend()
  const giveKudos = useGiveKudos()
  const syncStats = useSyncMyStats()

  const [code, setCode] = useState('')
  const [metric, setMetric] = useState<Metric>('weekly_volume')
  const [msg, setMsg] = useState<string | null>(null)

  // Eigene Aggregat-Statistik beim Öffnen teilen
  const myStats = useMemo(() => {
    const sets = allSets ?? []
    const freq = frequencyStats([...new Set(sets.map((s) => s.date))])
    const thisWeek = isoWeekKey(new Date().toISOString().slice(0, 10))
    const wv = weeklyVolume(sets).find((w) => w.week === thisWeek)?.volume ?? 0
    const dates = sets.map((s) => s.date).sort()
    return {
      display_name: profile?.display_name ?? user?.email?.split('@')[0] ?? 'Ich',
      total_sessions: freq.totalSessions,
      week_streak: freq.weekStreak,
      tonnage: Math.round(totalVolume(sets)),
      weekly_volume: Math.round(wv),
      last_workout: dates[dates.length - 1] ?? null,
      rank_title: rankForSessions(freq.totalSessions).title,
    }
  }, [allSets, profile, user])

  useEffect(() => {
    if (allSets) syncStats.mutate(myStats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStats.total_sessions, myStats.weekly_volume])

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
      setMsg('Freund hinzugefügt! 🎉')
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

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
        </button>
        <h1 className="text-xl font-bold">Freunde</h1>
      </header>

      {/* Mein Code + Freund hinzufügen */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="label">Dein Freundescode</div>
            <div className="text-xl font-bold tracking-widest">{profile?.friend_code ?? '…'}</div>
          </div>
          <button className="btn-ghost text-sm" onClick={shareCode}>
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
          <button className="btn-primary shrink-0" onClick={submitCode} disabled={addFriend.isPending}>
            + Freund
          </button>
        </div>
        {msg && <p className="text-sm text-brand">{msg}</p>}
        <p className="text-xs text-cocoa-muted">
          Freunde sehen nur deine Kennzahlen (Trainings, Volumen, Streak) — keine einzelnen Sätze
          oder Ernährung.
        </p>
      </div>

      {/* Metrik-Auswahl */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ring-1 ${
              metric === m ? 'bg-ruby text-white ring-ruby' : 'bg-sand-light text-cocoa ring-sand-dark'
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <ol className="space-y-2">
        {ranked.map((u, i) => {
          const me = u.user_id === user?.id
          const value =
            metric === 'weekly_volume'
              ? `${u.weekly_volume.toLocaleString('de-DE')} kg`
              : metric === 'total_sessions'
                ? `${u.total_sessions}`
                : `🔥 ${u.week_streak}`
          return (
            <li
              key={u.user_id}
              className={`card flex items-center gap-3 ${me ? 'ring-2 ring-brand' : ''}`}
            >
              <span className="w-6 text-center text-lg font-bold text-cocoa-light">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <div className="flex-1">
                <div className="font-semibold">
                  {u.display_name ?? 'Athlet'} {me && <span className="text-xs text-brand">(du)</span>}
                </div>
                <div className="text-xs text-cocoa-light">
                  {u.rank_title ?? ''} · {u.total_sessions} Trainings
                  {kudosReceived.get(u.user_id) ? ` · 👏 ${kudosReceived.get(u.user_id)}` : ''}
                </div>
              </div>
              <div className="text-right text-sm font-semibold">{value}</div>
              {!me && (
                <button
                  className="rounded-full bg-sand-light px-2 py-1 text-sm ring-1 ring-sand-dark disabled:opacity-40"
                  onClick={() => giveKudos.mutate(u.user_id)}
                  disabled={gaveToday.has(u.user_id)}
                  aria-label="Kudos geben"
                >
                  👏
                </button>
              )}
            </li>
          )
        })}
        {ranked.length <= 1 && (
          <li className="text-sm text-cocoa-light">
            Noch keine Freunde. Teile deinen Code oder gib den Code eines Freundes ein.
          </li>
        )}
      </ol>
    </div>
  )
}
