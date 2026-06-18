import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useExercises } from '../hooks/useExercises'
import { useAllSets } from '../hooks/useWorkouts'
import {
  frequencyStats,
  personalRecords,
  summarizeSessions,
  weeklyVolume,
} from '../lib/analytics'
import type { MuscleGroup } from '../types'

const axisStyle = { fontSize: 11, fill: '#94a3b8' }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-brand">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}

export default function Analytics() {
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const [exerciseId, setExerciseId] = useState('')

  const freq = useMemo(() => {
    const dates = (allSets ?? []).map((s) => s.date)
    return frequencyStats(dates)
  }, [allSets])

  const weekly = useMemo(() => weeklyVolume(allSets ?? []), [allSets])

  const byMuscle = useMemo(() => {
    const groupOf = new Map<string, MuscleGroup>()
    exercises?.forEach((e) => groupOf.set(e.id, e.muscle_group))
    const acc = new Map<string, number>()
    ;(allSets ?? []).forEach((s) => {
      const g = groupOf.get(s.exercise_id) ?? 'Sonstige'
      acc.set(g, (acc.get(g) ?? 0) + s.reps * s.weight)
    })
    return [...acc.entries()]
      .map(([group, volume]) => ({ group, volume: Math.round(volume) }))
      .sort((a, b) => b.volume - a.volume)
  }, [allSets, exercises])

  const exerciseSets = useMemo(
    () => (allSets ?? []).filter((s) => s.exercise_id === exerciseId),
    [allSets, exerciseId],
  )

  const progress = useMemo(
    () =>
      summarizeSessions(exerciseSets).map((s) => ({
        date: new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        topWeight: s.topWeight,
        est1RM: s.bestEstimated1RM,
      })),
    [exerciseSets],
  )

  const prs = useMemo(() => personalRecords(exerciseSets), [exerciseSets])

  const hasData = (allSets?.length ?? 0) > 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Auswertung</h1>

      {!hasData && (
        <p className="text-slate-400">Noch keine Daten — erfasse dein erstes Training.</p>
      )}

      {hasData && (
        <>
          {/* Trainingshäufigkeit */}
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Trainings" value={freq.totalSessions} />
            <Stat label="Wochen-Streak" value={freq.weekStreak} />
            <Stat label="Ø / Woche" value={freq.sessionsPerWeek} />
          </section>

          {/* Wochen-Volumen */}
          <section className="card">
            <h2 className="mb-3 font-semibold">Volumen pro Woche (kg)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" tick={axisStyle} />
                <YAxis tick={axisStyle} width={40} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                />
                <Bar dataKey="volume" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Volumen pro Muskelgruppe */}
          <section className="card">
            <h2 className="mb-3 font-semibold">Volumen pro Muskelgruppe (kg)</h2>
            <ResponsiveContainer width="100%" height={Math.max(120, byMuscle.length * 34)}>
              <BarChart data={byMuscle} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={axisStyle} />
                <YAxis type="category" dataKey="group" tick={axisStyle} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                />
                <Bar dataKey="volume" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Kraft-Fortschritt pro Übung */}
          <section className="card space-y-3">
            <h2 className="font-semibold">Kraft-Fortschritt</h2>
            <select
              className="input"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              <option value="">— Übung wählen —</option>
              {exercises?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            {exerciseId && progress.length === 0 && (
              <p className="text-sm text-slate-400">Noch keine Sätze für diese Übung.</p>
            )}

            {progress.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Max kg" value={prs.maxWeight} />
                  <Stat label="Bestes 1RM" value={prs.maxEstimated1RM} />
                  <Stat label="Max Wdh" value={prs.maxReps} />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={progress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} width={40} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="topWeight"
                      name="Top-Gewicht"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="est1RM"
                      name="gesch. 1RM"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>
                    <span className="text-brand">●</span> Top-Gewicht
                  </span>
                  <span>
                    <span className="text-amber-500">●</span> geschätztes 1RM
                  </span>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
