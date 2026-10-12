import { useMemo, useState } from 'react'
import { Camera, Check, Lock, ScanLine, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useBodyScans, useDeleteBodyScan, usePhotoUrls } from '../hooks/useBodyScans'
import { useBodyWeights } from '../hooks/useBodyWeight'
import { useNutritionSettings, useUpsertNutritionSettings } from '../hooks/useNutrition'
import { BodyScanFlow } from '../components/body/BodyScanFlow'
import { CompareSlider } from '../components/body/CompareSlider'
import { SectionTitle } from '../components/food-progress/ui'
import { localDate } from '../lib/day'
import { daysBetween } from '../components/social/format'
import {
  PHOTO_INTERVAL_DAYS,
  bfCategory,
  bfChange,
  bfMid,
  bfRangeLabel,
  composition,
  daysSinceLastPhoto,
  katchMcArdle,
  proteinFromLean,
  type BodyScan,
} from '../lib/bodyScan'

const dateLong = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

const dateShort = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`

function ago(days: number): string {
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 14) return `vor ${days} Tagen`
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen`
  return `vor ${Math.round(days / 30)} Monaten`
}

/** Körper: Startfoto, Körperfett-Verlauf, Vorher/Nachher-Vergleich. */
export default function Body() {
  const today = localDate()
  const { data: scans = [], isLoading } = useBodyScans()
  const { data: weights } = useBodyWeights()
  const { data: settings } = useNutritionSettings()
  const saveSettings = useUpsertNutritionSettings()
  const del = useDeleteBodyScan()
  const [flow, setFlow] = useState(false)
  const [pair, setPair] = useState<{ a?: string; b?: string }>({})
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...scans].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
    [scans],
  )
  const withPhoto = sorted.filter((s) => s.photo_path)
  const { data: urls = {} } = usePhotoUrls(withPhoto.map((s) => s.photo_path!))
  const latest = sorted[sorted.length - 1]
  const latestWeight = weights?.length ? Number(weights[weights.length - 1].weight_kg) : (settings?.weight_kg ?? null)
  const mid = latest ? bfMid(latest) : null
  const comp = mid !== null && latestWeight ? composition(latestWeight, mid) : null
  const change = bfChange(sorted)
  const since = daysSinceLastPhoto(sorted, today)
  const proteinSuggest = comp ? proteinFromLean(comp.leanKg) : null
  const proteinDiff = proteinSuggest !== null && settings ? proteinSuggest - settings.protein_target : 0

  const a = withPhoto.find((s) => s.id === pair.a) ?? withPhoto[0]
  const b = withPhoto.find((s) => s.id === pair.b) ?? withPhoto[withPhoto.length - 1]

  function adoptProtein() {
    if (!settings || proteinSuggest === null) return
    const { user_id: _u, updated_at: _t, ...rest } = settings as typeof settings & { updated_at?: string }
    saveSettings.mutate({ ...rest, protein_target: proteinSuggest })
  }

  if (isLoading) return <p className="text-cocoa-light">Lädt…</p>

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Körper</h1>
        <p className="text-sm text-cocoa-light">Körperfett & Fortschrittsfotos</p>
      </header>

      {!latest && (
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg dark:bg-sand-light dark:text-cocoa">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative space-y-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-on-brand">
              <ScanLine size={22} />
            </span>
            <h2 className="text-xl font-bold leading-tight">Dein Startfoto</h2>
            <p className="text-sm leading-snug text-bg/75 dark:text-cocoa-light">
              Ein Foto zum Start – die KI schätzt daraus deinen Körperfettanteil. In ein paar Monaten legst du das
              nächste daneben und siehst schwarz auf weiß, was sich getan hat.
            </p>
            <button className="btn-primary w-full gap-2" onClick={() => setFlow(true)}>
              <Camera size={18} /> Startfoto aufnehmen
            </button>
          </div>
        </section>
      )}

      {latest && (
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-4 text-bg dark:bg-sand-light dark:text-cocoa">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative flex items-center gap-4">
            {latest.photo_path && urls[latest.photo_path] ? (
              <img src={urls[latest.photo_path]} alt="" className="h-32 w-24 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-32 w-24 shrink-0 place-items-center rounded-2xl bg-bg/10 dark:bg-white/5">
                <ScanLine size={26} className="text-bg/50 dark:text-cocoa-muted" />
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                Körperfett · {ago(daysBetween(latest.date, today))}
              </div>
              <div className="tabular text-4xl font-bold tracking-tight">{bfRangeLabel(latest)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                {mid !== null && settings?.sex && (
                  <span className="rounded-full bg-bg/10 px-2 py-0.5 font-medium dark:bg-white/5">
                    {bfCategory(mid, settings.sex)}
                  </span>
                )}
                {change && change.delta !== 0 && (
                  <span
                    className={`tabular flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                      change.delta < 0 ? 'bg-success/20 text-success' : 'bg-bg/10 dark:bg-white/5'
                    }`}
                  >
                    {change.delta < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {change.delta > 0 ? '+' : '−'}
                    {Math.abs(change.delta).toLocaleString('de-DE')} Pkt. seit Start
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {latest && (
        <button
          className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ${
            since !== null && since >= PHOTO_INTERVAL_DAYS ? 'bg-brand/10 ring-1 ring-brand/25' : 'bg-cream'
          }`}
          onClick={() => setFlow(true)}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
            <Camera size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {since === null
                ? 'Foto hinzufügen'
                : since >= PHOTO_INTERVAL_DAYS
                  ? 'Zeit für ein Vergleichsfoto'
                  : 'Neue Messung'}
            </div>
            <div className="text-xs text-cocoa-light">
              {since === null
                ? 'Für den späteren Vorher/Nachher-Vergleich'
                : since >= PHOTO_INTERVAL_DAYS
                  ? `Dein letztes Foto ist ${Math.round(since / 7)} Wochen alt – jetzt sieht man Unterschiede.`
                  : `Sichtbare Unterschiede meist erst nach 8–12 Wochen · noch ca. ${Math.max(1, Math.ceil((PHOTO_INTERVAL_DAYS - since) / 7))} Wochen`}
            </div>
          </div>
        </button>
      )}

      {comp && (
        <section>
          <SectionTitle right={latestWeight ? `bei ${latestWeight.toLocaleString('de-DE')} kg` : undefined}>
            Zusammensetzung
          </SectionTitle>
          <div className="card space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-cocoa-light">Fettmasse</div>
                <div className="tabular text-xl font-bold">{comp.fatKg.toLocaleString('de-DE')} kg</div>
              </div>
              <div>
                <div className="text-xs text-cocoa-light">Fettfreie Masse</div>
                <div className="tabular text-xl font-bold">{comp.leanKg.toLocaleString('de-DE')} kg</div>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, mid!)}%` }} />
            </div>
            <p className="text-xs leading-snug text-cocoa-light">
              Grundumsatz nach fettfreier Masse: ca.{' '}
              <b className="tabular">{katchMcArdle(comp.leanKg).toLocaleString('de-DE')} kcal</b>. Eiweiß richtet sich
              am besten nach der fettfreien Masse: ca. <b className="tabular">{proteinSuggest} g</b> am Tag.
            </p>
            {settings && Math.abs(proteinDiff) >= 15 && (
              <button
                className="btn-ghost w-full gap-2 text-sm"
                onClick={adoptProtein}
                disabled={saveSettings.isPending || saveSettings.isSuccess}
              >
                {saveSettings.isSuccess ? (
                  <>
                    <Check size={16} /> Eiweißziel auf {proteinSuggest} g gesetzt
                  </>
                ) : (
                  `Eiweißziel ${settings.protein_target} → ${proteinSuggest} g übernehmen`
                )}
              </button>
            )}
          </div>
        </section>
      )}

      {withPhoto.length >= 2 && a && b && (
        <section>
          <SectionTitle right={`${daysBetween(a.date, b.date)} Tage dazwischen`}>Vorher / Nachher</SectionTitle>
          <div className="space-y-2">
            {urls[a.photo_path!] && urls[b.photo_path!] ? (
              <CompareSlider
                before={urls[a.photo_path!]}
                after={urls[b.photo_path!]}
                beforeLabel={dateLong(a.date)}
                afterLabel={dateLong(b.date)}
              />
            ) : (
              <div className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-sand" />
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['a', 'b'] as const).map((k) => (
                <select
                  key={k}
                  aria-label={k === 'a' ? 'Vorher-Foto' : 'Nachher-Foto'}
                  className="input py-2 text-sm"
                  value={(k === 'a' ? a : b).id}
                  onChange={(e) => setPair((p) => ({ ...p, [k]: e.target.value }))}
                >
                  {withPhoto.map((s) => (
                    <option key={s.id} value={s.id}>
                      {k === 'a' ? 'Vorher: ' : 'Nachher: '}
                      {dateShort(s.date)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </section>
      )}

      {sorted.length > 0 && (
        <section>
          <SectionTitle right={`${sorted.length} ${sorted.length === 1 ? 'Messung' : 'Messungen'}`}>
            Verlauf
          </SectionTitle>
          <div className="divide-y divide-sand-dark/50 overflow-hidden rounded-2xl bg-cream">
            {[...sorted].reverse().map((s: BodyScan) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                {s.photo_path && urls[s.photo_path] ? (
                  <img src={urls[s.photo_path]} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-14 w-11 shrink-0 place-items-center rounded-lg bg-sand text-cocoa-muted">
                    <ScanLine size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="tabular text-sm font-semibold">{bfRangeLabel(s)}</div>
                  <div className="text-xs text-cocoa-light">
                    {dateLong(s.date)} · {s.source === 'manual' ? 'selbst eingetragen' : 'KI-Schätzung'}
                    {s.weight_kg ? ` · ${Number(s.weight_kg).toLocaleString('de-DE')} kg` : ''}
                  </div>
                </div>
                {confirmDel === s.id ? (
                  <button
                    className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => del.mutate(s, { onSettled: () => setConfirmDel(null) })}
                    disabled={del.isPending}
                  >
                    Löschen
                  </button>
                ) : (
                  <button
                    className="grid h-9 w-9 place-items-center rounded-full text-cocoa-muted"
                    onClick={() => setConfirmDel(s.id)}
                    aria-label="Messung löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 px-1 text-xs leading-snug text-cocoa-muted">
        <Lock size={13} className="mt-0.5 shrink-0" />
        Deine Fotos sind privat und nur für dich sichtbar – auch nicht für Freunde in der Community. Beim Löschen einer
        Messung wird das Foto endgültig entfernt. Die Schätzung ist ein Richtwert, keine medizinische Messung.
      </p>

      {flow && <BodyScanFlow settings={settings} weightKg={latestWeight} onClose={() => setFlow(false)} />}
    </div>
  )
}
