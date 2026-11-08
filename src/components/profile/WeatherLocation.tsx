// Ort fürs Homescreen-Widget „Laufwetter“ (nur Android-App). Grob gerundet und nur auf diesem Gerät gespeichert.

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { isNative } from '../../lib/native'
import { usePrefs } from '../../lib/prefs'
import { getWeatherLoc, roundLoc, setWeatherLoc } from '../../lib/outdoorWidget'

export function WeatherLocation() {
  const { hasHybrid } = usePrefs()
  const [loc, setLoc] = useState(getWeatherLoc)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!isNative() || !hasHybrid) return null

  const locate = () => {
    if (!navigator.geolocation) return setMsg('Standort ist auf diesem Gerät nicht verfügbar.')
    setBusy(true)
    setMsg(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const r = roundLoc(p.coords.latitude, p.coords.longitude)
        setWeatherLoc(r)
        setLoc(r)
        setBusy(false)
      },
      () => {
        setBusy(false)
        setMsg('Kein Standort – erlaube „Ungefährer Standort“ in den App-Einstellungen.')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 3600_000 },
    )
  }

  return (
    <section className="space-y-1.5">
      <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">Wetter-Widget</h2>
      <div className="overflow-hidden rounded-2xl bg-cream">
        <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">
            <MapPin size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Ort fürs Laufwetter</div>
            <div className="text-xs text-cocoa-light">
              {loc
                ? 'Gespeichert – nur auf diesem Gerät, auf ~1 km gerundet'
                : 'Für das Homescreen-Widget „Laufwetter“'}
            </div>
          </div>
          <button
            onClick={locate}
            disabled={busy}
            className="shrink-0 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-cocoa disabled:opacity-50"
          >
            {busy ? 'Suche …' : loc ? 'Aktualisieren' : 'Standort nutzen'}
          </button>
        </div>
        {loc && (
          <button
            onClick={() => {
              setWeatherLoc(null)
              setLoc(null)
            }}
            className="w-full border-t border-sand-dark/40 px-4 py-2.5 text-left text-xs font-semibold text-cocoa-muted"
          >
            Ort entfernen
          </button>
        )}
      </div>
      {msg && <p className="px-4 text-xs text-cocoa-light">{msg}</p>}
      <p className="px-4 text-[11px] text-cocoa-muted">Wetterdaten: Deutscher Wetterdienst (über Bright Sky).</p>
    </section>
  )
}
