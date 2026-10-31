import { useEffect, useState, type ReactNode } from 'react'
import { Dumbbell, Lock, Users, Utensils, Watch } from 'lucide-react'
import { usePrefs } from '../../lib/prefs'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { lastHealthSync, useHealthSync } from '../../hooks/useHealth'
import { agoText } from '../../lib/health'
import { withWatchWidgets } from '../../lib/dashboard'
import {
  LIVE_FASTING_KEY,
  healthAvailability,
  healthConnect,
  healthHasPermissions,
  healthMissing,
  healthOpenSettings,
  isNative,
  liveFastingEnabled,
  liveStop,
} from '../../lib/native'

function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-success' : 'bg-sand-dark'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

function ModuleRow({
  icon,
  tint,
  title,
  hint,
  children,
}: {
  icon: ReactNode
  tint: string
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cream p-3.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-cocoa-light">{hint}</span>
      </span>
      {children}
    </div>
  )
}

/**
 * Profil → Bereiche: Was man nicht nutzt, verschwindet komplett (Tab, Widgets,
 * Erinnerungen). Die Smartwatch-Funktionen sind ohne Uhr gar nicht sichtbar.
 */
export function ModuleSettings() {
  const { showNutrition, setShowNutrition, showSocial, setShowSocial, hasWatch, setHasWatch } = usePrefs()
  const { prefs, save } = useUserPrefs()
  const sync = useHealthSync()
  const native = isNative()
  const [hc, setHc] = useState<'available' | 'not_installed' | 'update_required' | 'unsupported' | null>(null)
  const [granted, setGranted] = useState(false)
  const [missing, setMissing] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [liveFasting, setLiveFasting] = useState(liveFastingEnabled)
  const [lastSync, setLastSync] = useState(lastHealthSync)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void healthAvailability().then(setHc)
    void healthHasPermissions().then(setGranted)
    void healthMissing().then(setMissing)
  }, [])

  function enableWatch() {
    setHasWatch(true)
    void save({ dashboard: withWatchWidgets(prefs.dashboard) })
  }

  async function connect() {
    setBusy(true)
    setMsg(null)
    try {
      const ok = await healthConnect()
      setGranted(ok)
      void healthMissing().then(setMissing)
      if (ok) {
        enableWatch()
        setMsg('Verbunden – deine Daten werden jetzt abgeglichen.')
        void sync()
      } else setMsg('Keine Berechtigung erteilt. Du kannst sie in Health Connect jederzeit nachholen.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Verbinden hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-cocoa-light">
        Blende aus, was du nicht brauchst – Tabs, Widgets und Erinnerungen dazu verschwinden komplett.
      </p>

      <section className="space-y-2">
        <ModuleRow
          icon={<Dumbbell size={19} />}
          tint="bg-sand text-cocoa-light"
          title="Krafttraining"
          hint="Pläne, Sätze, Fortschritt – immer dabei"
        >
          <Switch on label="Krafttraining" onChange={() => {}} disabled />
        </ModuleRow>
        <ModuleRow
          icon={<Utensils size={19} />}
          tint="bg-sand text-cocoa-light"
          title="Ernährung"
          hint="Kalorien, Eiweiß, Wasser, Rezepte, Supplemente"
        >
          <Switch on={showNutrition} label="Ernährung" onChange={setShowNutrition} />
        </ModuleRow>
        <ModuleRow
          icon={<Users size={19} />}
          tint="bg-sand text-cocoa-light"
          title="Community"
          hint="Freunde, Bestenliste, Duelle, Challenges"
        >
          <Switch on={showSocial} label="Community" onChange={setShowSocial} />
        </ModuleRow>
        <ModuleRow
          icon={<Watch size={19} />}
          tint="bg-sand text-cocoa-light"
          title="Smartwatch"
          hint="Laufen, Rad, Schlaf, Schritte & Tagesform"
        >
          <Switch on={hasWatch} label="Smartwatch" onChange={(v) => (v ? enableWatch() : setHasWatch(false))} />
        </ModuleRow>
      </section>

      {hasWatch && (
        <section className="space-y-2.5 rounded-2xl bg-cream p-4">
          <h3 className="font-semibold">Uhr verbinden</h3>
          {!native ? (
            <p className="text-sm text-cocoa-light">
              Die Uhr-Daten kommen über <b>Health Connect</b> in der Android-App – von Samsung Galaxy Watch, Pixel
              Watch, Fitbit, Garmin, Polar, Withings, Oura und allen Apps, die dorthin schreiben.
            </p>
          ) : hc === 'not_installed' || hc === 'update_required' ? (
            <>
              <p className="text-sm text-cocoa-light">
                Dafür brauchst du die App <b>Health Connect</b> von Google
                {hc === 'update_required' ? ' in einer neueren Version' : ''}.
              </p>
              <a
                className="btn-primary w-full rounded-2xl py-3"
                href="https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
              >
                Health Connect im Play Store
              </a>
            </>
          ) : granted ? (
            <>
              <p className="text-sm text-success">✓ Mit Health Connect verbunden</p>
              {missing.length > 0 && (
                <div className="space-y-2 rounded-xl bg-gold/15 p-3">
                  <p className="text-xs">
                    {missing.length} Datentypen sind noch nicht freigegeben (z. B. Sauerstoff, Atmung, Blutdruck, ältere
                    Daten). Mit Freigabe bekommst du die komplette Auswertung.
                  </p>
                  <button className="btn-primary w-full rounded-xl py-2.5" onClick={connect} disabled={busy}>
                    Alle Daten freigeben
                  </button>
                </div>
              )}
              {agoText(lastSync) && (
                <p className="px-1 text-xs text-cocoa-muted">Zuletzt abgeglichen: {agoText(lastSync)}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-ghost rounded-2xl py-2.5"
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true)
                    await sync()
                    setLastSync(lastHealthSync())
                    setSyncing(false)
                  }}
                >
                  {syncing ? 'Gleiche ab …' : 'Jetzt abgleichen'}
                </button>
                <button className="btn-ghost rounded-2xl py-2.5" onClick={() => void healthOpenSettings()}>
                  Berechtigungen
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-cocoa-light">
                Erlaube den Zugriff auf Aktivitäten, Schlaf, Puls und Schritte. Wir speichern nur Zusammenfassungen.
              </p>
              <button className="btn-primary w-full rounded-2xl py-3" onClick={connect} disabled={busy}>
                {busy ? 'Verbinde…' : 'Mit Health Connect verbinden'}
              </button>
            </>
          )}
          {msg && <p className="text-xs text-cocoa-light">{msg}</p>}
        </section>
      )}

      {native && showNutrition && (
        <ModuleRow
          icon={<Lock size={19} />}
          tint="bg-sand text-cocoa-light"
          title="Fasten auf dem Sperrbildschirm"
          hint="Countdown bis zum Essensfenster dauerhaft anzeigen"
        >
          <Switch
            on={liveFasting}
            label="Fasten auf dem Sperrbildschirm"
            onChange={(v) => {
              try {
                localStorage.setItem(LIVE_FASTING_KEY, v ? '1' : '0')
              } catch {
                /* ignore */
              }
              setLiveFasting(v)
              if (!v) void liveStop('fasting')
            }}
          />
        </ModuleRow>
      )}
    </div>
  )
}
