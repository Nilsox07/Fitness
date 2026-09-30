import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Apple,
  Award,
  Bell,
  ChevronLeft,
  Download,
  Dumbbell,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  Palette,
  Target,
  User,
  Users,
  Utensils,
  Volume2,
  Watch,
  Flame,
  Layers,
  ClipboardList,
} from 'lucide-react'
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
import { useNutritionSettings } from '../hooks/useNutrition'
import { GOAL_LABEL } from '../lib/nutrition'
import { Group, Row, SEG_TRACK, SubHeader, TILE, Toggle, segBtn } from '../components/profile/ui'
import { ProfileHeader } from '../components/profile/ProfileHeader'

/** Unterseiten des Profils (neue Version), per ?s=… in der URL → Zurück-Geste funktioniert. */
type Sub = 'goal' | 'review' | 'version' | 'coach' | 'push' | 'unlock' | 'export' | 'fitbit'

const SUB_TITLE: Record<Sub, string> = {
  goal: 'Ziel & Körperdaten',
  review: 'Wochenfazit',
  version: 'App-Version',
  coach: 'KI-Coach-Ton',
  push: 'Trainings-Erinnerungen',
  unlock: 'Freischaltungen',
  export: 'Daten exportieren',
  fitbit: 'Fitbit',
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
    // Neue Version: direkt die Fitbit-Unterseite zeigen (dort steht die Meldung).
    const cleanUrl = () =>
      isNew ? navigate('/profile?s=fitbit', { replace: true }) : window.history.replaceState({}, '', '/profile')
    if (p === 'connected') {
      setFitbitMsg('Fitbit verbunden')
      syncFitbit()
      cleanUrl()
    } else if (p === 'error') {
      setFitbitMsg('Fitbit-Verbindung fehlgeschlagen.')
      cleanUrl()
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

  // ---------- Neue Version: Kopfkarte + gruppierte Listen + Unterseiten ----------
  const [params, setParams] = useSearchParams()
  const { data: settings } = useNutritionSettings()

  const available: Record<Sub, boolean> = {
    goal: showNutrition,
    review: true,
    version: true,
    coach: Boolean(ai?.enabled),
    push: pushSupported,
    unlock: true,
    export: true,
    fitbit: Boolean(fitbit?.configured),
  }
  const rawSub = params.get('s') as Sub | null
  const sub: Sub | null = rawSub && Object.prototype.hasOwnProperty.call(SUB_TITLE, rawSub) && available[rawSub] ? rawSub : null

  // Beim Wechsel zwischen Liste und Unterseite oben anfangen.
  useEffect(() => {
    if (isNew) window.scrollTo(0, 0)
  }, [sub, isNew])

  /** Unterseite öffnen = neuer History-Eintrag → Browser-/Gesten-Zurück führt zur Liste. */
  const openSub = (s: Sub) => setParams({ s })
  const closeSub = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else setParams({}, { replace: true })
  }

  if (isNew) {
    if (sub) {
      return (
        <div className="anim-fade space-y-4">
          <SubHeader title={SUB_TITLE[sub]} onBack={closeSub} />

          {sub === 'goal' && (
            <div className="card space-y-3">
              <p className="text-xs text-cocoa-light">
                Passe deine Angaben und dein Ziel an — die Nährwerte werden automatisch berechnet.
              </p>
              <GoalEditor onSaved={closeSub} />
            </div>
          )}

          {sub === 'review' && (
            <div className="card space-y-2">
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

          {sub === 'version' && (
            <div className="card space-y-2">
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
                Neu: KI-Assistent, Gamification, Social, KI-Ernährung, automatische Aufwärmsätze …
              </p>
            </div>
          )}

          {sub === 'coach' && (
            <div className="card space-y-2">
              <p className="text-xs text-cocoa-light">So spricht der KI-Coach mit dir.</p>
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

          {sub === 'push' && (
            <div className="card space-y-3">
              <p className="text-sm text-cocoa-light">
                Push, wenn du ein paar Tage nicht im Gym warst.
              </p>
              <button
                className="btn-primary w-full gap-1.5"
                onClick={activatePush}
                disabled={pushBusy}
              >
                {pushBusy ? (
                  '…'
                ) : (
                  <>
                    <Bell size={16} />
                    Aktivieren
                  </>
                )}
              </button>
              {pushMsg && <p className="text-sm text-cocoa-light">{pushMsg}</p>}
            </div>
          )}

          {sub === 'unlock' && (
            <div className="card space-y-3">
              <p className="text-xs text-cocoa-light">
                Mit jedem Level schaltest du mehr frei — du bist auf{' '}
                <span className="tabular font-semibold text-cocoa">Level {level}</span>.
              </p>
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
                        aria-label={locked ? `${a.label} – ab Level ${a.minLevel}` : a.label}
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

          {sub === 'export' && (
            <div className="card space-y-2">
              <p className="text-xs text-cocoa-light">Alle Einträge als CSV-Datei herunterladen.</p>
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
          )}

          {sub === 'fitbit' && fitbit?.configured && (
            <div className="card space-y-3">
              <p className="text-sm text-cocoa-light">Gewicht, Schritte & Ruhepuls importieren.</p>
              {fitbit.connected ? (
                <button
                  className="btn-primary w-full"
                  onClick={syncFitbit}
                  disabled={fitbitSync.isPending}
                >
                  {fitbitSync.isPending ? '…' : 'Sync'}
                </button>
              ) : (
                <button className="btn-primary w-full" onClick={() => connectFitbit()}>
                  Verbinden
                </button>
              )}
              {fitbitData && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-sand p-2 text-center text-xs">
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
        </div>
      )
    }

    const review = getStoredReview()
    const goalValue = settings
      ? `${GOAL_LABEL[settings.goal] ?? ''}${
          settings.kcal_target ? ` · ${settings.kcal_target.toLocaleString('de-DE')} kcal` : ''
        }`
      : undefined
    const currentAccent = ACCENTS.find((a) => a.id === accent)
    const currentSkin = SKINS.find((s) => s.id === skin)

    return (
      <div className="space-y-5">
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

        <ProfileHeader
          sets={allSets ?? []}
          foodEntries={foodEntries ?? []}
          skin={skin}
          email={user?.email}
          showNutrition={showNutrition}
          onOpen={() => navigate('/badges')}
        />

        <Group title="Ziele">
          {showNutrition && (
            <Row
              icon={Target}
              label="Ziel & Körperdaten"
              value={goalValue}
              onClick={() => openSub('goal')}
            />
          )}
          <Row
            icon={ClipboardList}
            label="Wochenfazit"
            value={review ? review.weekId.replace(/^\d{4}-W/, 'KW ') : undefined}
            onClick={() => openSub('review')}
          />
        </Group>

        <Group title="App">
          <Row
            icon={Layers}
            label="App-Version"
            value={appMode === 'new' ? 'Neu' : 'Klassisch'}
            onClick={() => openSub('version')}
          />
          <Row
            icon={Moon}
            label="Darstellung"
            trailing={
              <div className="flex shrink-0 gap-1 rounded-full bg-sand p-1">
                {MODES.map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMode(m.v)}
                    aria-pressed={mode === m.v}
                    className={`${segBtn(mode === m.v, 'text-xs')} px-2.5`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            icon={Utensils}
            label="Ernährungstracking"
            hint={'Zeigt den „Essen"-Tab und die Ernährungs-Auswertung.'}
            trailing={
              <Toggle
                label="Ernährungstracking"
                checked={showNutrition}
                onChange={setShowNutrition}
              />
            }
          />
          <Row
            icon={Volume2}
            label="Sound-Effekte"
            hint="Töne bei Level-up und Quests."
            trailing={
              <Toggle
                label="Sound-Effekte"
                checked={sound}
                onChange={(v) => {
                  setSound(v)
                  setSoundEnabled(v)
                }}
              />
            }
          />
          <Row
            icon={Flame}
            label="Cheat-Meal-Alarm"
            hint="Freunde sehen, wenn du dir was richtig Ungesundes gönnst (die KI entscheidet)."
            trailing={
              <Toggle
                label="Cheat-Meal-Alarm"
                checked={cheat}
                onChange={(v) => {
                  setCheat(v)
                  setShareCheatEnabled(v)
                }}
              />
            }
          />
          {ai?.enabled && (
            <Row
              icon={MessageSquare}
              label="KI-Coach-Ton"
              value={COACH_TONE_LABEL[tone]}
              onClick={() => openSub('coach')}
            />
          )}
          {pushSupported && (
            <Row icon={Bell} label="Trainings-Erinnerungen" onClick={() => openSub('push')} />
          )}
          <Row
            icon={Palette}
            label="Freischaltungen"
            value={[currentAccent?.label, currentSkin?.stages[3]].filter(Boolean).join(' · ')}
            onClick={() => openSub('unlock')}
          />
        </Group>

        <Group title="Mehr">
          <Row icon={Dumbbell} label="Übungen" onClick={() => navigate('/exercises')} />
          <Row
            icon={Award}
            label="Sammlung"
            value={<span className="tabular">Lv {level}</span>}
            onClick={() => navigate('/badges')}
          />
          <Row icon={Users} label="Community" onClick={() => navigate('/social')} />
          <Row icon={Download} label="Daten exportieren" value="CSV" onClick={() => openSub('export')} />
          {fitbit?.configured && (
            <Row
              icon={Watch}
              label="Fitbit"
              value={fitbit.connected ? 'Verbunden' : 'Nicht verbunden'}
              onClick={() => openSub('fitbit')}
            />
          )}
        </Group>

        <Group title="Konto">
          <Row icon={User} label="Angemeldet als" value={user?.email ?? '—'} />
          <Row
            icon={LogOut}
            label="Abmelden"
            danger
            onClick={() => supabase.auth.signOut()}
          />
        </Group>
      </div>
    )
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
              <span className="whitespace-nowrap">
                Abzeichen <span className="tabular text-sm font-medium text-cocoa-light">Lv {level}</span>
              </span>
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
