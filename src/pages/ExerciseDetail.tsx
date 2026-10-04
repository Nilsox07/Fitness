import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  ChevronRight,
  Lightbulb,
  ListOrdered,
  PlayCircle,
  Settings2,
  Trash2,
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
  isPerformed,
  onlyWorking,
  personalRecords,
  progressionSuggestion,
  setBest1RM,
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
import { ExerciseHowTo, Steps } from "../components/library/ExerciseHowTo";
import { ExerciseAnimation } from "../components/library/ExerciseAnimation";
import { GroupLabel, GroupList } from "../components/ui/GroupList";
import { MuscleChip } from "../components/exercises/MuscleBits";
import { enter } from "../components/home/motion";
import { useLibraryMatch } from "../components/library/useLibrary";

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

type Period = "3m" | "6m" | "1y" | "all";

const PERIODS: { key: Period; label: string; months: number | null }[] = [
  { key: "3m", label: "3 M", months: 3 },
  { key: "6m", label: "6 M", months: 6 },
  { key: "1y", label: "1 J", months: 12 },
  { key: "all", label: "Alle", months: null },
];

/** YYYY-MM-DD vor `months` Monaten (lokal). */
function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Rekord-Kachel der neuen App: goldener Pokal in getönter Kachel, große Zahl. */
function RecordTileNew({
  label,
  value,
  unit,
  sub,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="rounded-2xl bg-cream p-3.5" style={style}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
          <Trophy size={14} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-cocoa-muted">
          {label}
        </span>
      </div>
      <div className="tabular mt-2 truncate text-2xl font-bold tracking-tight text-cocoa">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-cocoa-light">{unit}</span>}
      </div>
      <div className="tabular h-4 truncate text-xs text-cocoa-muted">{sub ?? ""}</div>
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
  // Ausführung aus der Übungsbibliothek (nur neue App, wenn verknüpft/Name passt)
  const howTo = useLibraryMatch(exercise, isNew);
  const [howToOpen, setHowToOpen] = useState(true);
  // Neue App: Zeitraum des Diagramms, Ausführungs-Schritte, ganzer Verlauf
  const [period, setPeriod] = useState<Period>("all");
  const [stepsOpen, setStepsOpen] = useState(false);
  const [historyAll, setHistoryAll] = useState(false);

  // Formular mit der geladenen Übung befüllen (und nach dem Speichern synchron halten)
  useEffect(() => {
    if (exercise) setForm(exerciseToInput(exercise));
  }, [exercise]);

  // Nur ausgeführte Sätze — leere Vorlagen-Sätze (0 Wdh) zählen nicht.
  const sets = useMemo(
    () => (allSets ?? []).filter((s) => s.exercise_id === id && isPerformed(s)),
    [allSets, id],
  );
  const working = useMemo(() => onlyWorking(sets), [sets]);
  const prs = useMemo(() => personalRecords(sets), [sets]);

  // Bester Satz — bei einseitigen Übungen zählt die stärkere Seite (wie bei der Rekord-Feier).
  const bestSet = useMemo(() => {
    let best: { weight: number; reps: number; date: string } | null = null;
    let bestE1 = 0;
    for (const s of working) {
      const left = { weight: s.weight, reps: s.reps, e1: setBest1RM({ weight: s.weight, reps: s.reps }) };
      const right =
        s.reps_right != null && s.weight_right != null
          ? { weight: s.weight_right, reps: s.reps_right, e1: setBest1RM({ weight: s.weight_right, reps: s.reps_right }) }
          : null;
      const side = right && right.e1 > left.e1 ? right : left;
      if (side.e1 > bestE1 || (best && side.e1 === bestE1 && side.weight > best.weight)) {
        best = { weight: side.weight, reps: side.reps, date: s.date };
        bestE1 = side.e1;
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

  const periodChartData = useMemo(() => {
    const months = PERIODS.find((p) => p.key === period)?.months ?? null;
    if (months == null) return chartData;
    const from = monthsAgo(months);
    return sessions
      .map((s, i) => ({ date: s.date, row: chartData[i] }))
      .filter((x) => x.date >= from)
      .map((x) => x.row);
  }, [period, sessions, chartData]);

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
          ...work.map(setBest1RM),
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

  // ---------- Neue App: dunkler Hero, Rekord-Kacheln, gruppierte Listen ----------
  if (isNew) {
    const secondary = exercise.secondary_muscles ?? [];
    const shownHistory = historyAll ? history : history.slice(0, 6);
    const chips = (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <MuscleChip muscle={exercise.muscle_group} onDark />
        {secondary.map((m) => (
          <span
            key={m}
            className="rounded-full bg-bg/10 px-2.5 py-1 text-[11px] font-medium text-bg/70 dark:bg-white/5 dark:text-cocoa-light"
          >
            + {m}
          </span>
        ))}
      </div>
    );

    return (
      <div className="space-y-5 pb-2">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-3xl bg-cocoa p-4 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
          style={enter(0)}
        >
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg/10 text-bg transition active:scale-90 dark:bg-white/5 dark:text-cocoa"
              onClick={() => navigate(-1)}
              aria-label="Zurück"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-2xl font-bold leading-tight tracking-tight">{exercise.name}</h1>
              {chips}
            </div>
          </div>

          {howTo ? (
            <>
              <ExerciseAnimation
                images={howTo.images}
                alt={`Animation: ${howTo.name_de}`}
                className="relative mt-4 aspect-[4/3] w-full shadow-inner"
              />
              {hasData && (
                <div className="relative mt-3 flex items-center gap-2 text-sm">
                  <Trophy size={15} className="shrink-0 text-gold" strokeWidth={2.5} />
                  <span className="tabular truncate text-bg/80 dark:text-cocoa-light">
                    Max <span className="font-bold text-bg dark:text-cocoa">~{num(prs.maxEstimated1RM)} kg</span>
                    {bestSet && ` · Bester Satz ${num(bestSet.weight, 2)} kg × ${bestSet.reps}`}
                  </span>
                </div>
              )}
            </>
          ) : hasData ? (
            <div className="relative mt-5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                <Trophy size={13} className="text-gold" strokeWidth={2.5} />
                Geschätztes Maximum
              </p>
              <p className="tabular mt-0.5 text-5xl font-bold tracking-tight">
                {num(prs.maxEstimated1RM)}
                <span className="ml-1.5 text-xl font-semibold text-bg/60 dark:text-cocoa-light">kg</span>
              </p>
              <p className="tabular mt-1 text-sm text-bg/70 dark:text-cocoa-light">
                {bestSet
                  ? `Bester Satz ${num(bestSet.weight, 2)} kg × ${bestSet.reps} · ${dayLabel(bestSet.date)}`
                  : null}
                {sessions.length > 0 && ` · ${sessions.length} ${sessions.length === 1 ? "Training" : "Trainings"}`}
              </p>
            </div>
          ) : (
            <p className="relative mt-4 text-sm text-bg/70 dark:text-cocoa-light">
              Noch keine Arbeitssätze — nach deinem ersten Training siehst du hier Rekorde und Verlauf.
            </p>
          )}
        </section>

        {howTo && !hasData && (
          <p className="px-1 text-sm text-cocoa-light">
            Noch keine Arbeitssätze — nach deinem ersten Training siehst du hier Rekorde und Verlauf.
          </p>
        )}

        {/* Rekorde */}
        {hasData && (
          <section>
            <GroupLabel>Rekorde</GroupLabel>
            <div className="grid grid-cols-2 gap-2">
              <RecordTileNew style={enter(1)} label="Schwerstes" value={num(prs.maxWeight, 2)} unit="kg" />
              <RecordTileNew style={enter(2)} label="Geschätztes 1RM" value={num(prs.maxEstimated1RM)} unit="kg" />
              <RecordTileNew
                style={enter(3)}
                label="Bester Satz"
                value={bestSet ? `${num(bestSet.weight, 2)}×${bestSet.reps}` : "–"}
                unit={bestSet ? "kg" : undefined}
                sub={bestSet ? dayLabel(bestSet.date) : undefined}
              />
              <RecordTileNew
                style={enter(4)}
                label="Bestes Volumen"
                value={num(prs.maxVolumeSession, 0)}
                unit="kg"
                sub="pro Training"
              />
            </div>
          </section>
        )}

        {/* Entwicklung */}
        {hasData && (
          <section className="space-y-3 rounded-2xl bg-cream p-4" style={enter(5)}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold tracking-tight">Entwicklung</h2>
              <div className="flex gap-0.5 rounded-full bg-sand p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    aria-pressed={period === p.key}
                    className={`tabular rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200 ${
                      period === p.key ? "bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark" : "text-cocoa-light"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                    metric === m.key ? "bg-cocoa text-cream" : "bg-sand text-cocoa-light"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {periodChartData.length < 2 ? (
              <p className="py-8 text-center text-sm text-cocoa-light">
                {chartData.length < 2
                  ? "Ab zwei Trainings siehst du hier deine Entwicklung."
                  : "In diesem Zeitraum gibt es noch zu wenige Trainings."}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={periodChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={{ stroke: chart.grid }} />
                  <YAxis tick={axisStyle} width={40} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: chart.tipBg,
                      border: `1px solid ${chart.tipBorder}`,
                      color: chart.tipText,
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: chart.tipText }}
                    formatter={(v: number) => [`${num(v)} kg`, metricLabel]}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    name={metricLabel}
                    stroke={chart.primary}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: chart.primary }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>
        )}

        {/* Nächstes Mal */}
        {suggestion && suggestion.action !== "start" && (
          <section
            className="relative overflow-hidden rounded-2xl bg-brand/10 p-4 ring-1 ring-brand/20"
            style={enter(6)}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
                <Lightbulb size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-brand">Nächstes Mal</h2>
                  {suggestion.suggestedWeight > 0 && (
                    <span className="tabular text-2xl font-bold tracking-tight text-cocoa">
                      {num(suggestion.suggestedWeight, 2)}
                      <span className="ml-1 text-sm font-semibold text-cocoa-light">kg</span>
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm leading-snug text-cocoa">{suggestion.reason}</p>
              </div>
            </div>
          </section>
        )}

        {/* Ausführung */}
        {howTo && howTo.steps_de.length > 0 && (
          <section>
            <GroupList>
              <button
                type="button"
                className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-sand-light"
                onClick={() => setStepsOpen((o) => !o)}
                aria-expanded={stepsOpen}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <ListOrdered size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-cocoa">Ausführung</span>
                  <span className="tabular block text-xs text-cocoa-light">{howTo.steps_de.length} Schritte</span>
                </span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${stepsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {stepsOpen && (
                <div className="anim-fade px-4 py-3.5">
                  <Steps steps={howTo.steps_de} />
                </div>
              )}
            </GroupList>
          </section>
        )}

        {/* Verlauf */}
        {history.length > 0 && (
          <section>
            <GroupLabel right="A = Aufwärmsatz">Verlauf</GroupLabel>
            <GroupList>
              {shownHistory.map((h) => (
                <div key={h.date} className="flex gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      h.isPr ? "bg-gold/15 text-gold" : "bg-sand text-cocoa-light"
                    }`}
                    aria-hidden
                  >
                    {h.isPr ? (
                      <Trophy size={16} strokeWidth={2.5} />
                    ) : (
                      <span className="tabular text-[11px] font-bold">{shortDate(h.date)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold text-cocoa">
                        {dayLabel(h.date)}
                        {h.isPr && (
                          <span className="rounded-full bg-gold/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-gold">
                            Rekord
                          </span>
                        )}
                      </span>
                      {h.volume > 0 && (
                        <span className="tabular shrink-0 text-xs text-cocoa-muted">{num(h.volume, 0)} kg</span>
                      )}
                    </div>
                    <p className="tabular mt-0.5 text-sm leading-snug text-cocoa-light">
                      {h.sets.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && " · "}
                          {s.set_type === "warmup" ? (
                            <span className="text-cocoa-muted">A {setLabel(s)}</span>
                          ) : (
                            <>
                              {setLabel(s)}
                              {s.set_type === "drop" && <span className="text-cocoa-muted"> (Drop)</span>}
                            </>
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              ))}
              {history.length > shownHistory.length && (
                <button
                  type="button"
                  className="flex min-h-[3rem] w-full items-center justify-center gap-1 text-sm font-semibold text-brand active:bg-sand-light"
                  onClick={() => setHistoryAll(true)}
                >
                  Alle {history.length} Trainings anzeigen
                  <ChevronRight size={15} />
                </button>
              )}
            </GroupList>
          </section>
        )}

        {/* Einstellungen (eingeklappt) */}
        <section className="space-y-2">
          <GroupList>
            <button
              type="button"
              className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-sand-light"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
                <Settings2 size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-cocoa">Einstellungen</span>
                <span className="block truncate text-xs text-cocoa-light">
                  Name, Muskeln, Wiederholungen, Gewichtsschritte
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
              />
            </button>
          </GroupList>
          {settingsOpen && (
            <div className="card anim-fade space-y-3">
              <ExerciseForm key={exercise.id} form={form} setForm={setForm} aiOn={aiOn} />
              <button
                className="btn-primary w-full py-3"
                onClick={save}
                disabled={!dirty || !form.name.trim() || updateEx.isPending}
              >
                {updateEx.isPending ? "Speichere…" : saved && !dirty ? "Gespeichert" : "Speichern"}
              </button>
            </div>
          )}
        </section>

        <GroupList>
          <button
            type="button"
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 px-4 text-[15px] font-semibold text-red-500 transition-colors active:bg-sand-light disabled:opacity-40 dark:text-red-400"
            onClick={remove}
            disabled={deleteEx.isPending}
          >
            <Trash2 size={17} />
            Übung löschen
          </button>
        </GroupList>
      </div>
    );
  }

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

      {howTo && (
        <section className="space-y-2">
          <button
            className="card flex w-full items-center gap-2 py-3 text-left font-semibold"
            onClick={() => setHowToOpen((o) => !o)}
            aria-expanded={howToOpen}
          >
            <PlayCircle size={18} className="text-cocoa-light" />
            <span className="flex-1">Ausführung</span>
            <ChevronDown
              size={18}
              className={`text-cocoa-muted transition-transform duration-200 ${howToOpen ? "rotate-180" : ""}`}
            />
          </button>
          {howToOpen && (
            <div className="card anim-fade">
              <ExerciseHowTo item={howTo} />
            </div>
          )}
        </section>
      )}

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
