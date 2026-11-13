// Aktivität eintragen: Sportart (Kacheln + Suche, zuletzt genutzte oben), Dauer, Intensität, optional Strecke.
// Die Kalorien stehen live darunter (Mehrverbrauch, aus MET × Dauer × Gewicht).

import { useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import { Sheet } from '../workout/Sheet'
import { useAddManualActivity, useManualActivities } from '../../hooks/useManualActivities'
import { useTrainingKcal } from '../../hooks/useTrainingKcal'
import { localDate, shiftDate, dayLabel } from '../../lib/day'
import {
  INTENSITY_LABEL,
  SPORTS,
  activityKcal,
  activityTitle,
  recentActivities,
  searchSports,
  sportById,
  type Intensity,
} from '../../lib/sports'
import { sportIcon } from './sportIcons'

const MINUTES = [15, 30, 45, 60, 90, 120]

export function ActivitySheet({ onClose, date: initialDate }: { onClose: () => void; date?: string }) {
  const today = localDate()
  const { data: list = [] } = useManualActivities()
  const add = useAddManualActivity()
  const { kgOn } = useTrainingKcal()
  const [sport, setSport] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [distance, setDistance] = useState('')
  const [date, setDate] = useState(initialDate ?? today)
  const recent = useMemo(() => recentActivities(list), [list])
  const found = useMemo(() => (q.trim() ? searchSports(q) : SPORTS), [q])
  const kcal = sport ? activityKcal(sport, intensity, minutes, kgOn(date)) : 0
  const s = sport ? sportById(sport) : null

  const save = (p: { sport: string; minutes: number; intensity: Intensity; distance_km: number | null }) => {
    add.mutate({
      ...p,
      date,
      note: null,
      kcal: activityKcal(p.sport, p.intensity, p.minutes, kgOn(date)),
    })
    onClose()
  }

  return (
    <Sheet title="Aktivität eintragen" onClose={onClose}>
      {/* Tag: heute, gestern, vorgestern */}
      <div className="flex gap-1.5">
        {[0, -1, -2].map((k) => {
          const d = shiftDate(today, k)
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              aria-pressed={date === d}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${date === d ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'}`}
            >
              {dayLabel(d, today)}
            </button>
          )
        })}
      </div>

      {!sport ? (
        <>
          {recent.length > 0 && !q && (
            <div>
              <p className="label">Nochmal eintragen</p>
              <div className="space-y-1.5">
                {recent.map((r) => {
                  const Icon = sportIcon(r.sport)
                  return (
                    <button
                      key={r.id}
                      onClick={() =>
                        save({ sport: r.sport, minutes: r.minutes, intensity: r.intensity, distance_km: r.distance_km })
                      }
                      className="flex w-full items-center gap-3 rounded-2xl bg-sand px-3 py-2.5 text-left active:scale-[0.99]"
                    >
                      <Icon size={18} className="shrink-0 text-cocoa-light" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activityTitle(r)}</span>
                      <span className="text-xs text-cocoa-muted">{INTENSITY_LABEL[r.intensity]}</span>
                      <Plus size={16} className="shrink-0 text-brand" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cocoa-muted"
            />
            <input
              className="input pl-9"
              placeholder="Sportart suchen …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {found.map((x) => {
              const Icon = sportIcon(x.id)
              return (
                <button
                  key={x.id}
                  onClick={() => setSport(x.id)}
                  className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-sand px-1.5 py-2 text-center text-cocoa-light transition active:scale-95"
                >
                  <Icon size={20} />
                  <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{x.label}</span>
                </button>
              )
            })}
          </div>
          {found.length === 0 && (
            <button className="btn-ghost w-full" onClick={() => setSport('other')}>
              Als „Sonstiges“ eintragen
            </button>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setSport(null)}
            className="flex w-full items-center gap-3 rounded-2xl bg-sand px-3 py-3 text-left"
          >
            {(() => {
              const Icon = sportIcon(sport)
              return (
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-on-brand">
                  <Icon size={19} />
                </span>
              )
            })()}
            <span className="flex-1 font-semibold">{s!.label}</span>
            <span className="text-xs font-semibold text-brand">Ändern</span>
          </button>

          <div>
            <p className="label">Dauer</p>
            <div className="flex items-center gap-3">
              <button
                aria-label="Weniger"
                className="grid h-11 w-11 place-items-center rounded-full bg-sand"
                onClick={() => setMinutes((m) => Math.max(5, m - 5))}
              >
                <Minus size={18} />
              </button>
              <span className="tabular flex-1 text-center text-3xl font-bold">{minutes} min</span>
              <button
                aria-label="Mehr"
                className="grid h-11 w-11 place-items-center rounded-full bg-sand"
                onClick={() => setMinutes((m) => Math.min(600, m + 5))}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={`tabular rounded-full px-3 py-1 text-xs font-semibold ${minutes === m ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'}`}
                >
                  {m < 60 ? `${m} min` : `${(m / 60).toLocaleString('de-DE')} h`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Wie anstrengend?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(INTENSITY_LABEL) as Intensity[]).map((i) => (
                <button
                  key={i}
                  onClick={() => setIntensity(i)}
                  aria-pressed={intensity === i}
                  className={`rounded-2xl py-2.5 text-sm font-semibold ${intensity === i ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'}`}
                >
                  {INTENSITY_LABEL[i]}
                </button>
              ))}
            </div>
          </div>

          {s!.distance && (
            <div>
              <p className="label">Strecke (optional)</p>
              <input
                className="input tabular"
                inputMode="decimal"
                placeholder="km"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          )}

          <p className="text-center text-sm text-cocoa-light">
            ≈ <b className="tabular text-cocoa">{kcal} kcal</b> verbraucht
          </p>
          <button
            className="btn-primary w-full rounded-2xl py-3"
            onClick={() => {
              const km = parseFloat(distance.replace(',', '.'))
              save({ sport, minutes, intensity, distance_km: Number.isFinite(km) && km > 0 ? km : null })
            }}
          >
            Eintragen
          </button>
        </>
      )}
    </Sheet>
  )
}
