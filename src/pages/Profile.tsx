import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemeMode } from '../lib/theme'
import { usePrefs } from '../lib/prefs'
import { useAiStatus } from '../hooks/useAi'
import { COACH_TONE_LABEL, getCoachTone, setCoachTone, type CoachTone } from '../lib/ai'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { useAllFoodEntries } from '../hooks/useNutrition'
import { exportNutritionCsv, exportSetsCsv } from '../lib/exportData'
import { enablePush, pushSupported, setShareCheatEnabled, shareCheatEnabled } from '../lib/push'
import { computeXp, levelInfo } from '../lib/xp'
import { setSoundEnabled, soundEnabled } from '../lib/sound'
import { useFitbitStatus, useFitbitSync } from '../hooks/useFitbit'
import { connectFitbit, type FitbitSync } from '../lib/fitbit'
import {
  ACCENTS,
  SKINS,
  applyAccent,
  getAccentId,
  getSkinId,
  setAccentId,
  setSkinId,
} from '../lib/cosmetics'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-ruby' : 'bg-sand-dark'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

const MODES: { v: ThemeMode; label: string }[] = [
  { v: 'system', label: 'System' },
  { v: 'light', label: 'Hell' },
  { v: 'dark', label: 'Dunkel' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode, setMode } = useTheme()
  const { showNutrition, setShowNutrition } = usePrefs()
  const { data: ai } = useAiStatus()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: foodEntries } = useAllFoodEntries()
  const [tone, setTone] = useState<CoachTone>(getCoachTone())
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [accent, setAccent] = useState(getAccentId())
  const [skin, setSkin] = useState(getSkinId())
  const [sound, setSound] = useState(soundEnabled())
  const [cheat, setCheat] = useState(shareCheatEnabled())
  const { data: fitbit } = useFitbitStatus()
  const fitbitSync = useFitbitSync()
  const [fitbitData, setFitbitData] = useState<FitbitSync | null>(null)
  const [fitbitMsg, setFitbitMsg] = useState<string | null>(null)

  async function syncFitbit() {
    setFitbitMsg(null)
    try {
      setFitbitData(await fitbitSync.mutateAsync())
    } catch (e) {
      setFitbitMsg(e instanceof Error ? e.message : 'Fehler')
    }
  }

  // Rückkehr vom Fitbit-OAuth: einmal synchronisieren
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('fitbit')
    if (p === 'connected') {
      setFitbitMsg('Fitbit verbunden ✅')
      syncFitbit()
      window.history.replaceState({}, '', '/profile')
    } else if (p === 'error') {
      setFitbitMsg('Fitbit-Verbindung fehlgeschlagen.')
      window.history.replaceState({}, '', '/profile')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const level = levelInfo(computeXp(allSets ?? [])).level

  function chooseAccent(id: string, min: number) {
    if (level < min) return
    setAccent(id)
    setAccentId(id)
    applyAccent(id)
  }
  function chooseSkin(id: string, min: number) {
    if (level < min) return
    setSkin(id)
    setSkinId(id)
  }

  const tones: CoachTone[] = ['coach', 'sergeant', 'bro']

  async function activatePush() {
    if (!user) return
    setPushBusy(true)
    setPushMsg(null)
    try {
      await enablePush(user.id)
      setPushMsg('Erinnerungen aktiviert ✅')
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button className="btn-ghost px-3 text-base" onClick={() => navigate(-1)} aria-label="Zurück">
          ←
        </button>
        <h1 className="text-xl font-bold">Profil</h1>
      </header>

      <div className="card">
        <div className="label">Angemeldet als</div>
        <div className="font-medium break-all">{user?.email ?? '—'}</div>
      </div>

      <div className="card space-y-2">
        <div className="label">Darstellung</div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className={`btn ${
                mode === m.v
                  ? 'bg-ruby text-white'
                  : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Ernährungstracking</div>
          <div className="text-xs text-cocoa-light">
            Zeigt den „Essen"-Tab und die Ernährungs-Auswertung.
          </div>
        </div>
        <Toggle checked={showNutrition} onChange={setShowNutrition} />
      </div>

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Sound-Effekte</div>
          <div className="text-xs text-cocoa-light">Töne bei Level-up und Quests.</div>
        </div>
        <Toggle
          checked={sound}
          onChange={(v) => {
            setSound(v)
            setSoundEnabled(v)
          }}
        />
      </div>

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Cheat-Meal-Alarm</div>
          <div className="text-xs text-cocoa-light">
            Freunde sehen, wenn du dir was richtig Ungesundes gönnst (die KI entscheidet).
          </div>
        </div>
        <Toggle
          checked={cheat}
          onChange={(v) => {
            setCheat(v)
            setShareCheatEnabled(v)
          }}
        />
      </div>

      <div className="card space-y-3">
        <div className="label">Freischaltbares (Level {level})</div>
        <div>
          <div className="mb-1 text-xs text-cocoa-light">Akzentfarbe</div>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const locked = level < a.minLevel
              return (
                <button
                  key={a.id}
                  onClick={() => chooseAccent(a.id, a.minLevel)}
                  disabled={locked}
                  title={locked ? `Ab Level ${a.minLevel}` : a.label}
                  className={`relative h-9 w-9 rounded-full ring-2 ${
                    accent === a.id ? 'ring-cocoa' : 'ring-transparent'
                  } ${locked ? 'opacity-40' : ''}`}
                  style={{ background: a.swatch }}
                >
                  {locked && <span className="absolute inset-0 grid place-items-center text-xs">🔒</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-cocoa-light">Maskottchen-Skin</div>
          <div className="flex flex-wrap gap-2">
            {SKINS.map((s) => {
              const locked = level < s.minLevel
              return (
                <button
                  key={s.id}
                  onClick={() => chooseSkin(s.id, s.minLevel)}
                  disabled={locked}
                  title={locked ? `Ab Level ${s.minLevel}` : s.label}
                  className={`rounded-xl px-3 py-1.5 text-lg ring-1 ${
                    skin === s.id ? 'bg-sand-light ring-cocoa' : 'ring-sand-dark'
                  } ${locked ? 'opacity-40' : ''}`}
                >
                  {s.stages[3]} {locked && '🔒'}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {ai?.enabled && (
        <div className="card space-y-2">
          <div className="label">KI-Coach-Ton</div>
          <div className="grid grid-cols-3 gap-2">
            {tones.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTone(t)
                  setCoachTone(t)
                }}
                className={`btn text-xs ${
                  tone === t ? 'bg-ruby text-white' : 'bg-sand-light text-cocoa ring-1 ring-sand-dark'
                }`}
              >
                {COACH_TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn w-full bg-sand-light text-cocoa ring-1 ring-sand-dark"
        onClick={() => navigate('/social')}
      >
        👥 Freunde & Leaderboard
      </button>

      {pushSupported && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Trainings-Erinnerungen</div>
              <div className="text-xs text-cocoa-light">
                Push, wenn du ein paar Tage nicht im Gym warst.
              </div>
            </div>
            <button className="btn-primary text-sm" onClick={activatePush} disabled={pushBusy}>
              {pushBusy ? '…' : '🔔 Aktivieren'}
            </button>
          </div>
          {pushMsg && <p className="text-sm text-brand">{pushMsg}</p>}
        </div>
      )}

      <div className="card space-y-2">
        <div className="label">Daten exportieren (CSV)</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn bg-sand-light text-cocoa ring-1 ring-sand-dark"
            onClick={() => exportSetsCsv(allSets ?? [], exercises ?? [])}
            disabled={!allSets?.length}
          >
            🏋️ Training
          </button>
          <button
            className="btn bg-sand-light text-cocoa ring-1 ring-sand-dark"
            onClick={() => exportNutritionCsv(foodEntries ?? [])}
            disabled={!foodEntries?.length}
          >
            🍎 Ernährung
          </button>
        </div>
      </div>

      {fitbit?.configured && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Fitbit</div>
              <div className="text-xs text-cocoa-light">
                Gewicht, Schritte & Ruhepuls importieren.
              </div>
            </div>
            {fitbit.connected ? (
              <button className="btn-primary text-sm" onClick={syncFitbit} disabled={fitbitSync.isPending}>
                {fitbitSync.isPending ? '…' : 'Sync'}
              </button>
            ) : (
              <button className="btn-primary text-sm" onClick={() => connectFitbit()}>
                Verbinden
              </button>
            )}
          </div>
          {fitbitData && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-cocoa">{fitbitData.steps ?? '–'}</div>
                <div className="text-cocoa-light">Schritte</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">{fitbitData.restingHr ?? '–'}</div>
                <div className="text-cocoa-light">Ruhepuls</div>
              </div>
              <div>
                <div className="font-semibold text-cocoa">
                  {fitbitData.weight != null ? `${fitbitData.weight} kg` : '–'}
                </div>
                <div className="text-cocoa-light">Gewicht</div>
              </div>
            </div>
          )}
          {fitbitMsg && <p className="text-sm text-brand">{fitbitMsg}</p>}
        </div>
      )}

      <button className="btn-ghost w-full" onClick={() => supabase.auth.signOut()}>
        Abmelden
      </button>
    </div>
  )
}
