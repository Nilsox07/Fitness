// Training → Hybrid-Einheiten: Laufen + Stationen im Wechsel, Zeit läuft durch, „Weiter“ nimmt die Zwischenzeit.
// Nur mit Hybrid-Bereich. Laufender Stand liegt in localStorage (übersteht Neuladen), Ergebnisse in prefs.hybridRuns.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Footprints, Pause, Play, SkipForward, Timer, Trophy, X } from 'lucide-react'
import { enter } from '../components/home/motion'
import { useHeroBuddy } from '../components/home/useHeroBuddy'
import { Hero, HeroPill } from '../components/health/ui'
import { SectionLabel } from '../components/progress/ProgressHeader'
import { useUserPrefs } from '../hooks/usePrefsSync'
import { localDate } from '../lib/day'
import {
  HYBRID_TEMPLATES,
  bestRun,
  clock,
  splitsFrom,
  summarize,
  templateById,
  type HybridRun,
  type HybridTemplate,
} from '../lib/hybridSessions'

const RUN_KEY = 'hybrid_run'
const EQUIP: Record<HybridTemplate['equipment'], string> = {
  hyrox: 'Wettkampf-Geräte',
  gym: 'Gym',
  none: 'Ohne Geräte',
}

interface Live {
  template: string
  start: number
  marks: number[]
  /** Pausenzeit je Abschnitt (ms) */
  paused: number[]
  pausedAt: number | null
}

function loadLive(): Live | null {
  try {
    const v = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as Live | null
    return v && templateById(v.template) ? v : null
  } catch {
    return null
  }
}
function saveLive(v: Live | null) {
  try {
    if (v) localStorage.setItem(RUN_KEY, JSON.stringify(v))
    else localStorage.removeItem(RUN_KEY)
  } catch {
    /* egal */
  }
}

/** Abschnitte als Runden: Laufstrecke + die Stationen danach */
function rounds(t: HybridTemplate): { run: string | null; stations: HybridTemplate['parts'] }[] {
  const out: { run: string | null; stations: HybridTemplate['parts'] }[] = []
  for (const p of t.parts) {
    if (p.kind === 'run') out.push({ run: p.target, stations: [] })
    else if (out.length) out[out.length - 1].stations.push(p)
    else out.push({ run: null, stations: [p] })
  }
  return out
}

/** Sekündlich neu zeichnen, solange etwas läuft */
function useTick(on: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => set((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}

export default function Hybrid() {
  const navigate = useNavigate()
  const heroBuddy = useHeroBuddy('hybrid')
  const { prefs, save } = useUserPrefs()
  const [live, setLiveState] = useState<Live | null>(loadLive)
  const [open, setOpen] = useState<string | null>(null)
  const [done, setDone] = useState<HybridRun | null>(null)
  const setLive = (v: Live | null) => {
    saveLive(v)
    setLiveState(v)
  }
  const runs = prefs.hybridRuns
  const month = localDate().slice(0, 7)
  const thisMonth = runs.filter((r) => r.date.startsWith(month)).length
  const last = runs[runs.length - 1]

  if (done) return <Finish run={done} runs={runs} onClose={() => setDone(null)} />
  if (live) {
    return (
      <Runner
        live={live}
        best={bestRun(runs, templateById(live.template)!)}
        onChange={setLive}
        onFinish={(run) => {
          setLive(null)
          const today = localDate()
          void save({
            hybridRuns: [...runs, run],
            cardioDone: prefs.cardioDone.includes(today) ? prefs.cardioDone : [...prefs.cardioDone, today],
          })
          setDone(run)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2" style={enter(0)}>
        <button
          onClick={() => navigate(-1)}
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-95"
          aria-label="Zurück"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Hybrid-Einheiten</h1>
          <p className="text-sm text-cocoa-light">Laufen + Stationen, Zeit je Abschnitt</p>
        </div>
      </header>

      <Hero
        buddy={heroBuddy}
        index={1}
        overline="Hybrid"
        value={last ? clock(last.total) : '–'}
        unit={last ? undefined : undefined}
      >
        <p className="mt-1 text-sm font-semibold">
          {last
            ? `Zuletzt: ${templateById(last.template)?.name ?? 'Einheit'}`
            : 'Such dir eine Einheit aus und leg los.'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <HeroPill value={thisMonth} label="Einheiten im Monat" icon={<Timer size={15} />} />
          <HeroPill
            value={new Set(runs.map((r) => r.template)).size}
            label="Verschiedene Einheiten"
            icon={<Footprints size={15} />}
          />
        </div>
      </Hero>

      <section style={enter(2)}>
        <SectionLabel>Einheit wählen</SectionLabel>
        <div className="space-y-2">
          {HYBRID_TEMPLATES.map((t) => {
            const best = bestRun(runs, t)
            const isOpen = open === t.id
            return (
              <div key={t.id} className="overflow-hidden rounded-2xl bg-cream">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sand/60"
                  onClick={() => setOpen(isOpen ? null : t.id)}
                  aria-expanded={isOpen}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
                    <Footprints size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.name}</span>
                    <span className="block truncate text-xs text-cocoa-light">{t.sub}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block text-sm font-bold">
                      {best ? clock(best.total) : `~${t.minutes} min`}
                    </span>
                    <span className="block text-[10px] text-cocoa-muted">{best ? 'Bestzeit' : EQUIP[t.equipment]}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-3 px-4 pb-4">
                    <ol className="space-y-1.5 text-xs">
                      {rounds(t).map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="tabular w-14 shrink-0 rounded-lg bg-brand/10 px-2 py-1.5 text-center font-semibold text-brand">
                            {r.run ?? '–'}
                          </span>
                          <span className="min-w-0 flex-1 rounded-lg bg-sand px-2 py-1.5">
                            {r.stations.map((p, j) => (
                              <span key={j} className="block">
                                <span className="font-semibold">{p.name}</span>{' '}
                                <span className="tabular text-cocoa-light">{p.target}</span>
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3"
                      onClick={() =>
                        setLive({ template: t.id, start: Date.now(), marks: [], paused: [], pausedAt: null })
                      }
                    >
                      <Play size={16} /> Starten
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** Läuft: Gesamtzeit, aktueller Abschnitt groß, „Weiter“ nimmt die Zwischenzeit. */
function Runner({
  live,
  best,
  onChange,
  onFinish,
}: {
  live: Live
  best: HybridRun | null
  onChange: (v: Live | null) => void
  onFinish: (run: HybridRun) => void
}) {
  const t = templateById(live.template)!
  const paused = live.pausedAt != null
  useTick(!paused)
  const now = paused ? live.pausedAt! : Date.now()
  const idx = live.marks.length
  const part = t.parts[idx]
  const nextPart = t.parts[idx + 1]
  const pausedTotal = live.paused.reduce((s, x) => s + x, 0)
  const total = (now - live.start - pausedTotal) / 1000
  const lastMark = idx ? live.marks[idx - 1] : live.start
  const cur = (now - lastMark - (live.paused[idx] ?? 0)) / 1000
  const splits = splitsFrom(live.start, live.marks, live.paused)
  const bestSplit = best?.splits[idx]

  const next = () => {
    if (paused) return
    const marks = [...live.marks, Date.now()]
    if (marks.length >= t.parts.length) {
      const sp = splitsFrom(live.start, marks, live.paused).map(Math.round)
      onFinish({ template: t.id, date: localDate(), total: sp.reduce((a, b) => a + b, 0), splits: sp })
    } else onChange({ ...live, marks })
  }
  const togglePause = () => {
    if (paused) {
      const add = Date.now() - live.pausedAt!
      const p = [...live.paused]
      p[idx] = (p[idx] ?? 0) + add
      onChange({ ...live, paused: p, pausedAt: null })
    } else onChange({ ...live, pausedAt: Date.now() })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{t.name}</p>
          <p className="text-sm text-cocoa-light">
            Abschnitt {idx + 1} von {t.parts.length}
          </p>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa"
          aria-label="Abbrechen"
          onClick={() => {
            if (confirm('Einheit abbrechen? Die Zeiten gehen verloren.')) onChange(null)
          }}
        >
          <X size={18} />
        </button>
      </header>

      <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            Gesamt{paused ? ' · Pause' : ''}
          </p>
          <p className="tabular text-6xl font-bold tracking-tight">{clock(total)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(idx / t.parts.length) * 100}%` }}
            />
          </div>
        </div>
      </section>

      {part && (
        <section className="card space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                part.kind === 'run' ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
              }`}
            >
              {part.kind === 'run' ? <Footprints size={22} /> : <Timer size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
                {part.kind === 'run' ? 'Laufen' : 'Station'}
              </p>
              <p className="line-clamp-2 text-xl font-bold leading-tight">{part.name}</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-cocoa-muted">Abschnitt</p>
              <p className="tabular text-4xl font-bold leading-none">{clock(cur)}</p>
            </div>
            <div className="text-right">
              <p className="tabular text-2xl font-bold leading-none">{part.target}</p>
              {bestSplit != null && (
                <p className={`tabular mt-1 text-xs font-semibold ${cur <= bestSplit ? 'text-good' : 'text-gold'}`}>
                  Bestzeit {clock(bestSplit)}
                </p>
              )}
            </div>
          </div>
          {nextPart && (
            <p className="text-xs text-cocoa-muted">
              Danach: {nextPart.name} · {nextPart.target}
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          onClick={togglePause}
          className="grid h-16 w-16 place-items-center rounded-2xl bg-sand text-cocoa"
          aria-label={paused ? 'Fortsetzen' : 'Pause'}
        >
          {paused ? <Play size={22} /> : <Pause size={22} />}
        </button>
        <button
          onClick={next}
          disabled={paused}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-on-brand transition active:scale-[0.98] disabled:opacity-50"
        >
          {idx + 1 >= t.parts.length ? (
            <>
              <Trophy size={20} /> Ziel!
            </>
          ) : (
            <>
              <SkipForward size={20} /> Weiter
            </>
          )}
        </button>
      </div>

      {splits.length > 0 && (
        <section>
          <SectionLabel>Zwischenzeiten</SectionLabel>
          <ol className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
            {splits
              .map((sec, i) => ({ sec, i }))
              .reverse()
              .map(({ sec, i }) => (
                <SplitRow
                  key={i}
                  name={t.parts[i].name}
                  sec={sec}
                  best={best?.splits[i]}
                  run={t.parts[i].kind === 'run'}
                />
              ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function SplitRow({ name, sec, best, run }: { name: string; sec: number; best?: number; run: boolean }) {
  const diff = best != null ? Math.round(sec - best) : null
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${run ? 'bg-brand' : 'bg-sand-dark'}`} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {diff != null && diff !== 0 && (
        <span className={`tabular text-xs font-semibold ${diff < 0 ? 'text-good' : 'text-gold'}`}>
          {diff < 0 ? '−' : '+'}
          {clock(Math.abs(diff))}
        </span>
      )}
      <span className="tabular font-semibold">{clock(sec)}</span>
    </li>
  )
}

/** Geschafft: Zeit, Bestzeit?, Lauf- vs. Stationszeit, langsamste Station, alle Zwischenzeiten. */
function Finish({ run, runs, onClose }: { run: HybridRun; runs: HybridRun[]; onClose: () => void }) {
  const t = templateById(run.template)!
  const s = useMemo(() => summarize(t, run.splits), [t, run])
  const prev = bestRun(
    runs.filter((r) => r !== run),
    t,
  )
  const record = !prev || run.total < prev.total
  const runPct = s.total ? (s.runTime / s.total) * 100 : 0
  return (
    <div className="space-y-4">
      <Hero overline={t.name} value={clock(run.total)} index={0}>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
          {record ? (
            <>
              <Trophy size={15} className="text-gold" />{' '}
              {prev ? `Neue Bestzeit – ${clock(prev.total - run.total)} schneller` : 'Erste Zeit – deine Messlatte'}
            </>
          ) : (
            `Bestzeit ${clock(prev!.total)} · ${clock(run.total - prev!.total)} langsamer`
          )}
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bg/10 dark:bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${runPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-bg/70 dark:text-cocoa-light">
          <span>Laufen {clock(s.runTime)}</span>
          <span>Stationen {clock(s.stationTime)}</span>
        </div>
      </Hero>
      {s.slowest && (
        <p className="card text-sm">
          Längste Station: <b>{s.slowest.name}</b> mit {clock(s.slowest.sec)} – da steckt die meiste Zeit drin.
        </p>
      )}
      <section>
        <SectionLabel>Zwischenzeiten</SectionLabel>
        <ol className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
          {run.splits.map((sec, i) => (
            <SplitRow key={i} name={t.parts[i].name} sec={sec} best={prev?.splits[i]} run={t.parts[i].kind === 'run'} />
          ))}
        </ol>
      </section>
      <button className="btn-primary w-full rounded-2xl py-3" onClick={onClose}>
        Fertig
      </button>
    </div>
  )
}
