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
import { useAllFoodEntries } from '../hooks/useNutrition'
import { useTheme } from '../lib/theme'
import { usePrefs } from '../lib/prefs'
import {
  frequencyStats,
  onlyWorking,
  personalRecords,
  summarizeSessions,
  weeklyVolume,
} from '../lib/analytics'
import type { MuscleGroup } from '../types'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-brand">{value}</div>
      <div className="text-xs text-cocoa-light">{label}</div>
    </div>
  )
}

export default function Analytics() {
  const { data: exercises } = useExercises()
  const { data: allSets } = useAllSets()
  const [exerciseId, setExerciseId] = useState('')

  // Diagramm-Farben passend zum aktiven Theme
  const dark = useTheme().resolved === 'dark'
  const chart = {
    grid: dark ? '#243044' : '#E5E7EB',
    axis: dark ? '#94A3B8' : '#5B6472',
    tipBg: dark ? '#161D2B' : '#FFFFFF',
    tipBorder: dark ? '#344155' : '#D2D6DD',
    tipText: dark ? '#E5E9F0' : '#0B0F19',
    primary: '#E11D48',
    secondary: dark ? '#FB7185' : '#BE123C',
  }
  const axisStyle = { fontSize: 11, fill: chart.axis }

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
      // Kraftverlauf nur aus Arbeitssätzen (Aufwärm-/Dropsätze ausgeblendet)
      summarizeSessions(onlyWorking(exerciseSets)).map((s) => ({
        date: new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        topWeight: s.topWeight,
        est1RM: s.bestEstimated1RM,
      })),
    [exerciseSets],
  )

  const prs = useMemo(() => personalRecords(exerciseSets), [exerciseSets])

  // Ernährung (nur wenn aktiviert)
  const { showNutrition } = usePrefs()
  const { data: foodEntries } = useAllFoodEntries()
  const dailyKcal = useMemo(() => {
    const map = new Map<string, { kcal: number; protein: number }>()
    ;(foodEntries ?? []).forEach((e) => {
      const d = map.get(e.date) ?? { kcal: 0, protein: 0 }
      d.kcal += e.kcal
      d.protein += e.protein
      map.set(e.date, d)
    })
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        kcal: Math.round(v.kcal),
        protein: Math.round(v.protein),
      }))
  }, [foodEntries])
  const avgKcal = dailyKcal.length
    ? Math.round(dailyKcal.reduce((s, d) => s + d.kcal, 0) / dailyKcal.length)
    : 0
  const avgProtein = dailyKcal.length
    ? Math.round(dailyKcal.reduce((s, d) => s + d.protein, 0) / dailyKcal.length)
    : 0
  const showNutritionSection = showNutrition && dailyKcal.length > 0

  const hasData = (allSets?.length ?? 0) > 0

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Auswertung</h1>

      {!hasData && !showNutritionSection && (
        <p className="text-cocoa-light">Noch keine Daten — erfasse dein erstes Training.</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="week" tick={axisStyle} />
                <YAxis tick={axisStyle} width={40} />
                <Tooltip
                  contentStyle={{ background: chart.tipBg, border: `1px solid ${chart.tipBorder}`, color: chart.tipText, borderRadius: 8 }}
                  labelStyle={{ color: chart.tipText }}
                />
                <Bar dataKey="volume" fill={chart.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Volumen pro Muskelgruppe */}
          <section className="card">
            <h2 className="mb-3 font-semibold">Volumen pro Muskelgruppe (kg)</h2>
            <ResponsiveContainer width="100%" height={Math.max(120, byMuscle.length * 34)}>
              <BarChart data={byMuscle} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis type="number" tick={axisStyle} />
                <YAxis type="category" dataKey="group" tick={axisStyle} width={80} />
                <Tooltip
                  contentStyle={{ background: chart.tipBg, border: `1px solid ${chart.tipBorder}`, color: chart.tipText, borderRadius: 8 }}
                  labelStyle={{ color: chart.tipText }}
                />
                <Bar dataKey="volume" fill={chart.secondary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Kraft-Fortschritt pro Übung */}
          <section className="card space-y-3">
            <h2 className="font-semibold">Kraft-Fortschritt</h2>
            <p className="-mt-1 text-xs text-cocoa-muted">Basierend auf deinen Arbeitssätzen.</p>
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
              <p className="text-sm text-cocoa-light">Noch keine Sätze für diese Übung.</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} width={40} />
                    <Tooltip
                      contentStyle={{ background: chart.tipBg, border: `1px solid ${chart.tipBorder}`, color: chart.tipText, borderRadius: 8 }}
                  labelStyle={{ color: chart.tipText }}
                    />
                    <Line
                      type="monotone"
                      dataKey="topWeight"
                      name="Top-Gewicht"
                      stroke={chart.primary}
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
                <div className="flex gap-4 text-xs text-cocoa-light">
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

      {/* Ernährung – Tagesverlauf (nur wenn aktiviert & Daten vorhanden) */}
      {showNutritionSection && (
        <>
          <section className="grid grid-cols-2 gap-2">
            <Stat label="Ø kcal/Tag" value={avgKcal} />
            <Stat label="Ø Eiweiß/Tag" value={`${avgProtein} g`} />
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Kalorien pro Tag</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyKcal}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="date" tick={axisStyle} />
                <YAxis tick={axisStyle} width={40} />
                <Tooltip
                  contentStyle={{ background: chart.tipBg, border: `1px solid ${chart.tipBorder}`, color: chart.tipText, borderRadius: 8 }}
                  labelStyle={{ color: chart.tipText }}
                />
                <Bar dataKey="kcal" fill={chart.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  )
}
