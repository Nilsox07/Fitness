import { useEffect, useMemo, useState } from "react";
import { accentColor } from '../lib/cosmetics'
import { useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  ChevronLeft,
  Lightbulb,
  Settings2,
  Trophy,
} from "lucide-react";
import {
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
  type ExerciseInput,
} from "../hooks/useExercises";
import { useAllSets } from "../hooks/useWorkouts";
import { useAiStatus } from "../hooks/useAi";
import { usePrefs } from "../lib/prefs";
import { useTheme } from "../lib/theme";
import { dayLabel } from "../lib/day";
import {
  estimate1RM,
  onlyWorking,
  personalRecords,
  progressionSuggestion,
  summarizeSessions,
  totalVolume,
} from "../lib/analytics";
import {
  EMPTY_EXERCISE,
  ExerciseForm,
  cleanExerciseInput,
  exerciseToInput,
} from "../components/ExerciseForm";
import type { SetWithDate } from "../types";

type Metric = "est1RM" | "topWeight" | "volume";

const METRICS: { key: Metric; label: string }[] = [
  { key: "est1RM", label: "Geschätztes Max" },
  { key: "topWeight", label: "Schwerstes Gewicht" },
  { key: "volume", label: "Volumen" },
];

const num = (n: number, digits = 1) =>
  n.toLocaleString("de-DE", { maximumFractionDigits: digits });

/** „8×80" bzw. einseitig „8×80 / 7×80". */
function setLabel(s: SetWithDate): string {
  const left = `${s.reps}×${num(s.weight, 2)}`;
  if (s.reps_right != null && s.weight_right != null) {
    return `${left} / ${s.reps_right}×${num(s.weight_right, 2)}`;
  }
  return left;
}

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}.`;
}

function RecordTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-xs text-cocoa-light">
        <Trophy size={14} className="shrink-0 text-gold" />
        {label}
      </div>
      <div className="tabular mt-1 text-xl font-bold text-cocoa">{value}</div>
      {sub && <div className="tabular text-xs text-cocoa-muted">{sub}</div>}
    </div>
  );
}

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: exercises, isLoading } = useExercises();
  const { data: allSets } = useAllSets();
  const updateEx = useUpdateExercise();
  const deleteEx = useDeleteExercise();
  const { data: ai } = useAiStatus();
  const { isNew } = usePrefs();
  const aiOn = Boolean(isNew && ai?.enabled);

  const exercise = exercises?.find((e) => e.id === id);

  const [metric, setMetric] = useState<Metric>("est1RM");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState<ExerciseInput>(EMPTY_EXERCISE);
  const [saved, setSaved] = useState(false);

  // Formular mit der geladenen Übung befüllen (und nach dem Speichern synchron halten)
  useEffect(() => {
    if (exercise) setForm(exerciseToInput(exercise));
  }, [exercise]);

  const sets = useMemo(
    () => (allSets ?? []).filter((s) => s.exercise_id === id),
    [allSets, id],
  );
  const working = useMemo(() => onlyWorking(sets), [sets]);
  const prs = useMemo(() => personalRecords(sets), [sets]);

  const bestSet = useMemo(() => {
    let best: SetWithDate | null = null;
    let bestE1 = 0;
    for (const s of working) {
      const e1 = estimate1RM(s.weight, s.reps);
      if (e1 > bestE1 || (best && e1 === bestE1 && s.weight > best.weight)) {
        best = s;
        bestE1 = e1;
      }
    }
    return best;
  }, [working]);

  const sessions = useMemo(() => summarizeSessions(working), [working]);
  const chartData = useMemo(
    () =>
      sessions.map((s) => ({
        date: shortDate(s.date),
        est1RM: s.bestEstimated1RM,
        topWeight: s.topWeight,
        volume: Math.round(s.volume),
      })),
    [sessions],
  );

  const suggestion = useMemo(
    () => (exercise ? progressionSuggestion(exercise, sets) : null),
    [exercise, sets],
  );

  // Verlauf: alle Sätze (inkl. Aufwärmen) je Tag, neueste zuerst
  const history = useMemo(() => {
    const byDate = new Map<string, SetWithDate[]>();
    for (const s of sets) {
      const list = byDate.get(s.date) ?? [];
      list.push(s);
      byDate.set(s.date, list);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => {
        const sorted = [...list].sort((a, b) => a.set_number - b.set_number);
        const work = onlyWorking(sorted);
        const bestE1 = Math.max(
          0,
          ...work.map((s) => estimate1RM(s.weight, s.reps)),
        );
        return {
          date,
          sets: sorted,
          volume: totalVolume(work),
          isPr:
            prs.maxEstimated1RM > 0 &&
            Math.round(bestE1 * 10) / 10 >= prs.maxEstimated1RM,
        };
      });
  }, [sets, prs.maxEstimated1RM]);

  // Diagramm-Farben passend zum aktiven Theme (wie in der Auswertung)
  const dark = useTheme().resolved === "dark";
  const chart = {
    grid: dark ? "#243044" : "#E5E7EB",
    axis: dark ? "#94A3B8" : "#5B6472",
    tipBg: dark ? "#161D2B" : "#FFFFFF",
    tipBorder: dark ? "#344155" : "#D2D6DD",
    tipText: dark ? "#E5E9F0" : "#0B0F19",
    primary: accentColor(),
  };
  const axisStyle = { fontSize: 11, fill: chart.axis };
  const metricLabel = METRICS.find((m) => m.key === metric)!.label;

  const dirty = exercise
    ? JSON.stringify(cleanExerciseInput(form)) !==
      JSON.stringify(exerciseToInput(exercise))
    : false;

  async function save() {
    if (!exercise || !form.name.trim()) return;
    await updateEx.mutateAsync({
      id: exercise.id,
      ...cleanExerciseInput(form),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function remove() {
    if (!exercise) return;
    if (!confirm(`„${exercise.name}" inkl. aller Sätze löschen?`)) return;
    await deleteEx.mutateAsync(exercise.id);
    navigate("/exercises", { replace: true });
  }

  const backButton = (
    <button
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa"
      onClick={() => navigate(-1)}
      aria-label="Zurück"
    >
      <ChevronLeft size={20} />
    </button>
  );

  if (!exercise) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          {backButton}
          <h1 className="text-xl font-bold">Übung</h1>
        </header>
        <p className="text-cocoa-light">
          {isLoading ? "Lädt…" : "Übung nicht gefunden."}
        </p>
      </div>
    );
  }

  const hasData = working.length > 0;

  return (
    <div className="anim-fade space-y-5">
      <header className="flex items-center gap-3">
        {backButton}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold leading-tight">
            {exercise.name}
          </h1>
          <p className="truncate text-sm text-cocoa-light">
            {exercise.muscle_group}
            {exercise.secondary_muscles?.length
              ? ` · +${exercise.secondary_muscles.join(", ")}`
              : ""}
          </p>
        </div>
      </header>

      {!hasData && (
        <p className="text-sm text-cocoa-light">
          Noch keine Arbeitssätze — nach deinem ersten Training siehst du hier
          Rekorde und Verlauf.
        </p>
      )}

      {hasData && (
        <section className="space-y-2">
          <h2 className="font-semibold">Rekorde</h2>
          <div className="grid grid-cols-2 gap-2">
            <RecordTile
              label="Schwerstes Gewicht"
              value={`${num(prs.maxWeight, 2)} kg`}
            />
            <RecordTile
              label="Geschätztes 1RM"
              value={`${num(prs.maxEstimated1RM)} kg`}
            />
            <RecordTile
              label="Bester Satz"
              value={
                bestSet ? `${num(bestSet.weight, 2)} kg × ${bestSet.reps}` : "–"
              }
              sub={bestSet ? dayLabel(bestSet.date) : undefined}
            />
            <RecordTile
              label="Bestes Volumen"
              value={`${num(prs.maxVolumeSession, 0)} kg`}
              sub="pro Training"
            />
          </div>
        </section>
      )}

      {hasData && (
        <section className="card space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  metric === m.key
                    ? "bg-cocoa text-cream"
                    : "bg-sand text-cocoa-light"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {chartData.length < 2 ? (
            <p className="py-6 text-center text-sm text-cocoa-light">
              Ab zwei Trainings siehst du hier deine Entwicklung.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chart.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <YAxis
                  tick={axisStyle}
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: chart.tipBg,
                    border: `1px solid ${chart.tipBorder}`,
                    color: chart.tipText,
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: chart.tipText }}
                  formatter={(v: number) => [`${num(v)} kg`, metricLabel]}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={metricLabel}
                  stroke={chart.primary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chart.primary }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      {suggestion && suggestion.action !== "start" && (
        <section className="card flex gap-3">
          <Lightbulb size={20} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">Nächstes Mal</h2>
              {suggestion.suggestedWeight > 0 && (
                <span className="tabular font-bold text-brand">
                  {num(suggestion.suggestedWeight, 2)} kg
                </span>
              )}
            </div>
            <p className="text-sm text-cocoa-light">{suggestion.reason}</p>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Verlauf</h2>
            <span className="text-xs text-cocoa-muted">A = Aufwärmsatz</span>
          </div>
          <ul className="divide-y divide-sand-dark/40 rounded-2xl bg-cream">
            {history.map((h) => (
              <li key={h.date} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-cocoa">
                    {dayLabel(h.date)}
                    {h.isPr && (
                      <Trophy
                        size={14}
                        className="text-gold"
                        aria-label="Rekord"
                      />
                    )}
                  </span>
                  {h.volume > 0 && (
                    <span className="tabular text-xs text-cocoa-muted">
                      {num(h.volume, 0)} kg
                    </span>
                  )}
                </div>
                <p className="tabular mt-0.5 text-sm text-cocoa-light">
                  {h.sets.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && " · "}
                      {s.set_type === "warmup" ? (
                        <span className="text-cocoa-muted">
                          A {setLabel(s)}
                        </span>
                      ) : (
                        <>
                          {setLabel(s)}
                          {s.set_type === "drop" && (
                            <span className="text-cocoa-muted"> (Drop)</span>
                          )}
                        </>
                      )}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <button
          className="card flex w-full items-center gap-2 py-3 text-left font-semibold"
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
        >
          <Settings2 size={18} className="text-cocoa-light" />
          <span className="flex-1">Einstellungen</span>
          <ChevronDown
            size={18}
            className={`text-cocoa-muted transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
          />
        </button>
        {settingsOpen && (
          <div className="card anim-fade space-y-3">
            <ExerciseForm
              key={exercise.id}
              form={form}
              setForm={setForm}
              aiOn={aiOn}
            />
            <button
              className="btn-primary w-full"
              onClick={save}
              disabled={!dirty || !form.name.trim() || updateEx.isPending}
            >
              {updateEx.isPending
                ? "Speichere…"
                : saved && !dirty
                  ? "Gespeichert"
                  : "Speichern"}
            </button>
          </div>
        )}
      </section>

      <button
        className="w-full py-3 text-center text-sm font-semibold text-red-500 disabled:opacity-40 dark:text-red-400"
        onClick={remove}
        disabled={deleteEx.isPending}
      >
        Übung löschen
      </button>
    </div>
  );
}
