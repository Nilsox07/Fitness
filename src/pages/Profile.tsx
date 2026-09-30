import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Apple, Award, Bell, ChevronLeft, Dumbbell, Lock, LogOut, Users } from 'lucide-react'
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
import { GoalEditor } from '../components/GoalEditor'
import { getStoredReview } from '../lib/weeklyReview'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-success' : 'bg-sand-dark'
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

/** Segment-Schalter wie in der TopBar: ausgewählt = helle Fläche auf bg-sand-Spur. */
const SEG_TRACK = 'grid gap-1 rounded-full bg-sand p-1'
const segBtn = (active: boolean, size = 'text-sm') =>
  `rounded-full px-2 py-1.5 ${size} font-semibold transition-colors duration-200 ${
    active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
  }`
const TILE = 'btn gap-1.5 bg-sand text-cocoa'

const MODES: { v: ThemeMode; label: string }[] = [
  { v: 'system', label: 'System' },
  { v: 'light', label: 'Hell' },
  { v: 'dark', label: 'Dunkel' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode, setMode } = useTheme()
  const { showNutrition, setShowNutrition, appMode, setAppMode, isNew } = usePrefs()
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
      setFitbitMsg('Fitbit verbunden')
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
      setPushMsg('Erinnerungen aktiviert')
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Profil</h1>
      </header>

      <div className="card">
        <div className="label">Angemeldet als</div>
        <div className="font-medium break-all">{user?.email ?? '—'}</div>
      </div>

      <div className="card space-y-2">
        <div className="label">App-Version</div>
        <p className="text-xs text-cocoa-light">
          Wechsle jederzeit zwischen der schlanken, gewohnten Basis und der neuen Version mit
          allen Features. Deine Daten bleiben in beiden gleich.
        </p>
        <div className={`${SEG_TRACK} grid-cols-2`}>
          <button
            type="button"
            onClick={() => setAppMode('classic')}
            aria-pressed={appMode === 'classic'}
            className={segBtn(appMode === 'classic')}
          >
            Klassisch
          </button>
          <button
            type="button"
            onClick={() => setAppMode('new')}
            aria-pressed={appMode === 'new'}
            className={segBtn(appMode === 'new')}
          >
            Neu (alle Features)
          </button>
        </div>
        <p className="text-xs text-cocoa-light">
          {isNew
            ? 'Neu: KI-Assistent, Gamification, Social, KI-Ernährung, automatische Aufwärmsätze …'
            : 'Klassisch: nur Training, Essen, Verlauf, Auswertung & Übungen – ohne Extras.'}
        </p>
      </div>

      <div className="card space-y-2">
        <div className="label">Schnellzugriff</div>
        <div className="grid grid-cols-2 gap-2">
          <button className={TILE} onClick={() => navigate('/exercises')}>
            <Dumbbell size={16} className="text-cocoa-light" />
            Übungen
          </button>
          {isNew && (
            <button className={TILE} onClick={() => navigate('/badges')}>
              <Award size={16} className="text-cocoa-light" />
              Abzeichen · <span className="tabular">Lvl {level}</span>
            </button>
          )}
          {isNew && (
            <button className={TILE} onClick={() => navigate('/social')}>
              <Users size={16} className="text-cocoa-light" />
              Community
            </button>
          )}
        </div>
      </div>

      {isNew && (
        <div className="card space-y-2">
          <div className="label">Wochenfazit</div>
          {(() => {
            const r = getStoredReview()
            return r ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-cocoa">{r.text}</p>
            ) : (
              <p className="text-xs text-cocoa-light">
                Dein persönliches Gesamt-Fazit (Training + Ernährung) erscheint hier automatisch —
                jeden Montag früh, sobald du die App öffnest.
              </p>
            )
          })()}
        </div>
      )}

      {showNutrition && (
        <div className="card space-y-3">
          <div>
            <div className="label">Ziel & Körperdaten</div>
            <p className="text-xs text-cocoa-light">
              Passe deine Angaben und dein Ziel an — die Nährwerte werden automatisch berechnet.
            </p>
          </div>
          <GoalEditor />
        </div>
      )}

      <div className="card space-y-2">
        <div className="label">Darstellung</div>
        <div className={`${SEG_TRACK} grid-cols-3`}>
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              aria-pressed={mode === m.v}
              className={segBtn(mode === m.v)}
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

      {isNew && (
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
      )}

      {isNew && (
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
      )}

      {isNew && (
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
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <Lock size={14} />
                    </span>
                  )}
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
                  className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-lg transition-colors duration-200 ${
                    skin === s.id ? 'bg-sand-light ring-2 ring-cocoa dark:bg-sand-dark' : 'bg-sand'
                  } ${locked ? 'opacity-40' : ''}`}
                >
                  {s.stages[3]} {locked && <Lock size={14} className="text-cocoa-light" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {isNew && ai?.enabled && (
        <div className="card space-y-2">
          <div className="label">KI-Coach-Ton</div>
          <div className={`${SEG_TRACK} grid-cols-3`}>
            {tones.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTone(t)
                  setCoachTone(t)
                }}
                aria-pressed={tone === t}
                className={segBtn(tone === t, 'text-xs')}
              >
                {COACH_TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}


      {pushSupported && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Trainings-Erinnerungen</div>
              <div className="text-xs text-cocoa-light">
                Push, wenn du ein paar Tage nicht im Gym warst.
              </div>
            </div>
            <button className="btn-primary gap-1.5 text-sm" onClick={activatePush} disabled={pushBusy}>
              {pushBusy ? (
                '…'
              ) : (
                <>
                  <Bell size={16} />
                  Aktivieren
                </>
              )}
            </button>
          </div>
          {pushMsg && <p className="text-sm text-cocoa-light">{pushMsg}</p>}
        </div>
      )}

      <div className="card space-y-2">
        <div className="label">Daten exportieren (CSV)</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={TILE}
            onClick={() => exportSetsCsv(allSets ?? [], exercises ?? [])}
            disabled={!allSets?.length}
          >
            <Dumbbell size={16} className="text-cocoa-light" />
            Training
          </button>
          <button
            className={TILE}
            onClick={() => exportNutritionCsv(foodEntries ?? [])}
            disabled={!foodEntries?.length}
          >
            <Apple size={16} className="text-cocoa-light" />
            Ernährung
          </button>
        </div>
      </div>

      {isNew && fitbit?.configured && (
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
                <div className="tabular font-semibold text-cocoa">{fitbitData.steps ?? '–'}</div>
                <div className="text-cocoa-light">Schritte</div>
              </div>
              <div>
                <div className="tabular font-semibold text-cocoa">{fitbitData.restingHr ?? '–'}</div>
                <div className="text-cocoa-light">Ruhepuls</div>
              </div>
              <div>
                <div className="tabular font-semibold text-cocoa">
                  {fitbitData.weight != null ? `${fitbitData.weight} kg` : '–'}
                </div>
                <div className="text-cocoa-light">Gewicht</div>
              </div>
            </div>
          )}
          {fitbitMsg && <p className="text-sm text-cocoa-light">{fitbitMsg}</p>}
        </div>
      )}

      <button className="btn w-full gap-1.5 bg-sand text-cocoa" onClick={() => supabase.auth.signOut()}>
        <LogOut size={16} className="text-cocoa-light" />
        Abmelden
      </button>
    </div>
  )
}
