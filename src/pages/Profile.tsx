import { isNative } from '../lib/native'
import { openPlanWizard } from '../components/onboarding/Onboarding'
import { AppearanceSettings } from '../components/profile/AppearanceSettings'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Wand2,
  Apple,
  Bell,
  Download,
  Dumbbell,
  LogOut,
  PenLine,
  MessageSquare,
  Palette,
  Target,
  User,
  Volume2,
  LayoutGrid,
  ClipboardList,
  SlidersHorizontal,
  Search,
  CalendarDays,
  LayoutDashboard,
  Smile,
  Sparkles,
  Watch,
  FlaskConical,
  MessageSquareWarning,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react'
import { signOut } from '../lib/userData'
import { useAuth } from '../lib/auth'
import { useTheme, type ThemeMode } from '../lib/theme'
import { usePrefs } from '../lib/prefs'
import { useAiStatus } from '../hooks/useAi'
import { COACH_TONE_LABEL, getCoachTone, setCoachTone, type CoachTone } from '../lib/ai'
import { useAllSets } from '../hooks/useWorkouts'
import { useExercises } from '../hooks/useExercises'
import { useAllFoodEntries } from '../hooks/useNutrition'
import { exportNutritionCsv, exportSetsCsv } from '../lib/exportData'
import { pushSupported } from '../lib/push'
import { setSoundEnabled, soundEnabled } from '../lib/sound'
import { ACCENTS, getAccentId, getSkinId } from '../lib/cosmetics'
import { GoalEditor } from '../components/GoalEditor'
import { getStoredReview } from '../lib/weeklyReview'
import { WeeklyReviewView } from '../components/review/WeeklyReviewView'
import { useNutritionSettings } from '../hooks/useNutrition'
import { GOAL_LABEL } from '../lib/nutrition'
import { Group, Row, SEG_TRACK, SubCard, SubHeader, TILE, Toggle, segBtn } from '../components/profile/ui'
import { ProfileHeader } from '../components/profile/ProfileHeader'
import { NameSheet } from '../components/profile/NameSheet'
import { useMyProfile } from '../hooks/useSocial'
import { SettingsEditor } from '../components/profile/SettingsEditor'
import { NotificationSettings } from '../components/profile/NotificationSettings'
import { ModuleSettings } from '../components/profile/ModuleSettings'
import { openSearch } from '../components/search/SearchSheet'
import { openBuddySheet } from '../components/buddy/BuddySheet'
import { usePremium } from '../hooks/usePremium'
import { openPlusSheet } from '../lib/premium'
import { FeedbackSheet } from '../components/profile/FeedbackSheet'
import { DeleteAccountSheet } from '../components/privacy/DeleteAccountSheet'

/**
 * Unterseiten des Profils, per ?s=… in der URL → Zurück-Geste funktioniert.
 * Der Trainingsrhythmus liegt jetzt bei den Plänen (/plans?rhythm=1); alte Links
 * auf ?s=rhythm werden dorthin umgeleitet.
 */
type Sub = 'settings' | 'goal' | 'review' | 'coach' | 'push' | 'export' | 'modules' | 'appearance'

const SUB_TITLE: Record<Sub, string> = {
  settings: 'Meine Einstellungen',
  goal: 'Ziel & Körperdaten',
  review: 'Wochenfazit',
  coach: 'Buddy-Ton',
  push: 'Benachrichtigungen',
  export: 'Daten exportieren',
  modules: 'Bereiche',
  appearance: 'Aussehen',
}

const SUB_SUBTITLE: Record<Sub, string> = {
  settings: 'Training & Ernährung',
  goal: 'Nährwerte automatisch berechnet',
  review: 'Jeden Montag neu',
  coach: 'So spricht dein Buddy',
  push: 'Erinnerungen einzeln einstellen',
  export: 'CSV-Download',
  modules: 'Ein- und ausblenden, Uhr verbinden',
  appearance: 'App-Farbe, Buddy & Hell/Dunkel',
}

const MODES: { v: ThemeMode; label: string }[] = [
  { v: 'system', label: 'System' },
  { v: 'light', label: 'Hell' },
  { v: 'dark', label: 'Dunkel' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: myProfile } = useMyProfile()
  const [nameOpen, setNameOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'delete' | 'revoke' | null>(null)
  const { mode, setMode } = useTheme()
  const { showNutrition, hasWatch } = usePrefs()
  const { data: ai } = useAiStatus()
  const { data: allSets } = useAllSets()
  const { data: exercises } = useExercises()
  const { data: foodEntries } = useAllFoodEntries()
  const [tone, setTone] = useState<CoachTone>(getCoachTone())
  const accent = getAccentId()
  const skin = getSkinId()
  const [sound, setSound] = useState(soundEnabled())
  const { data: settings } = useNutritionSettings()
  const { premium, testFree, setTestFree } = usePremium()

  const tones: CoachTone[] = ['coach', 'sergeant', 'bro']
  const reviewHint = `Dein persönliches Wochenfazit (${
    showNutrition ? 'Training + Ernährung' : 'Training'
  }) erscheint hier automatisch — jeden Montag früh, sobald du die App öffnest.`

  // ---------- Kopfkarte + gruppierte Listen + Unterseiten ----------
  const [params, setParams] = useSearchParams()

  const available: Record<Sub, boolean> = {
    settings: true,
    goal: showNutrition,
    review: true,
    coach: Boolean(ai?.enabled),
    push: pushSupported || isNative(),
    export: true,
    modules: true,
    appearance: true,
  }
  const rawSub = params.get('s') as Sub | null
  const sub: Sub | null =
    rawSub && Object.prototype.hasOwnProperty.call(SUB_TITLE, rawSub) && available[rawSub] ? rawSub : null

  // Alte Links (/profile?s=rhythm) → Trainingsrhythmus bei den Plänen
  const legacyRhythm = rawSub === ('rhythm' as string)
  useEffect(() => {
    if (legacyRhythm) navigate('/plans?rhythm=1', { replace: true })
  }, [legacyRhythm, navigate])

  /** Unterseite öffnen = neuer History-Eintrag → Browser-/Gesten-Zurück führt zur Liste. */
  const openSub = (s: Sub) => setParams({ s })
  const closeSub = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else setParams({}, { replace: true })
  }

  const currentAccent = ACCENTS.find((a) => a.id === accent)

  if (legacyRhythm) return null
  if (sub) {
    return (
      <div className="anim-fade space-y-4">
        <SubHeader title={SUB_TITLE[sub]} subtitle={SUB_SUBTITLE[sub]} />

        {sub === 'settings' && (
          <SettingsEditor
            onOpenRhythm={() => navigate('/plans?rhythm=1')}
            onOpenGoal={showNutrition ? () => openSub('goal') : undefined}
          />
        )}

        {sub === 'goal' && <GoalEditor onSaved={closeSub} />}

        {sub === 'modules' && <ModuleSettings />}

        {sub === 'appearance' && (
          <>
            <SubCard>
              <p className="text-xs text-cocoa-light">Hell, dunkel oder wie dein Handy.</p>
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
            </SubCard>
            <AppearanceSettings />
            <Group>
              <Row
                icon={Volume2}
                label="Sound-Effekte"
                hint="Töne bei Level-up und Quests"
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
            </Group>
          </>
        )}

        {sub === 'review' && (
          <SubCard>
            {(() => {
              const r = getStoredReview()
              return r ? <WeeklyReviewView review={r} /> : <p className="text-xs text-cocoa-light">{reviewHint}</p>
            })()}
          </SubCard>
        )}

        {sub === 'coach' && (
          <SubCard>
            <p className="text-xs text-cocoa-light">So spricht dein Buddy mit dir.</p>
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
          </SubCard>
        )}

        {sub === 'push' && <NotificationSettings />}

        {sub === 'export' && (
          <SubCard>
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
              {showNutrition && (
                <button
                  className={TILE}
                  onClick={() => exportNutritionCsv(foodEntries ?? [])}
                  disabled={!foodEntries?.length}
                >
                  <Apple size={16} className="text-cocoa-light" />
                  Ernährung
                </button>
              )}
            </div>
          </SubCard>
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
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profil</h1>
      </header>

      <ProfileHeader
        sets={allSets ?? []}
        foodEntries={foodEntries ?? []}
        skin={skin}
        email={user?.email}
        showNutrition={showNutrition}
        onOpen={() => navigate('/badges')}
      />

      <button
        onClick={openSearch}
        className="flex w-full items-center gap-2 rounded-2xl bg-sand px-3.5 py-2.5 text-left text-[15px] text-cocoa-muted"
      >
        <Search size={18} /> Suchen
      </button>

      <Group title="Ich">
        {showNutrition && (
          <Row icon={Target} label="Ziel & Körperdaten" value={goalValue} onClick={() => openSub('goal')} />
        )}
        <Row icon={CalendarDays} label="Trainingsrhythmus" onClick={() => navigate('/plans?rhythm=1')} />
        <Row icon={Wand2} label="Plan neu erstellen" hint="Ziel, Tage, Ausdauer" onClick={openPlanWizard} />
        <Row
          icon={SlidersHorizontal}
          label="Meine Einstellungen"
          hint={showNutrition ? 'Wochenziel, Pausen, Kalorien-Bonus' : 'Wochenziel, Pausen & Tageswechsel'}
          onClick={() => openSub('settings')}
        />
      </Group>

      <Group title="Personalisieren">
        <Row
          icon={LayoutGrid}
          label="Bereiche"
          hint="Ernährung, Community & Smartwatch"
          onClick={() => openSub('modules')}
        />
        <Row
          icon={LayoutDashboard}
          label="Heute anpassen"
          hint="Widgets auswählen & sortieren"
          onClick={() => navigate('/today?edit=1')}
        />
        <Row
          icon={Palette}
          label="Aussehen"
          hint="App-Farbe, Buddy, Hell/Dunkel"
          value={currentAccent?.label}
          onClick={() => openSub('appearance')}
        />
      </Group>

      <Group title="Buddy">
        {ai?.enabled && (
          <Row
            icon={Sparkles}
            label="Buddy Plus"
            hint="Alle KI-Funktionen"
            value={premium ? 'Aktiv' : 'Kostenlos'}
            onClick={openPlusSheet}
          />
        )}
        {ai?.enabled && (
          <Row icon={MessageSquare} label="Buddy fragen" hint="Dein KI-Coach" onClick={() => openBuddySheet()} />
        )}
        {ai?.enabled && (
          <Row icon={Smile} label="Buddy-Ton" value={COACH_TONE_LABEL[tone]} onClick={() => openSub('coach')} />
        )}
        <Row
          icon={ClipboardList}
          label="Wochenfazit"
          value={review ? review.weekId.replace(/^\d{4}-W/, 'KW ') : undefined}
          onClick={() => openSub('review')}
        />
      </Group>

      <Group title="Mitteilungen & Geräte">
        {(pushSupported || isNative()) && (
          <Row icon={Bell} label="Benachrichtigungen" onClick={() => openSub('push')} />
        )}
        <Row icon={Watch} label="Smartwatch" value={hasWatch ? 'An' : 'Aus'} onClick={() => openSub('modules')} />
      </Group>

      <Group title="Konto & Daten">
        <Row
          icon={PenLine}
          tint="neutral"
          label="Name"
          value={myProfile?.display_name || '—'}
          onClick={() => setNameOpen(true)}
        />
        <Row icon={User} tint="neutral" label="E-Mail" value={user?.email ?? '—'} />
        <Row icon={Download} tint="neutral" label="Daten exportieren" value="CSV" onClick={() => openSub('export')} />
        <Row
          icon={FlaskConical}
          tint="neutral"
          label="Kostenlose Version testen"
          hint="Zeigt die App ohne Buddy Plus"
          trailing={<Toggle label="Kostenlose Version testen" checked={testFree} onChange={setTestFree} />}
        />
        <Row icon={LogOut} label="Abmelden" danger onClick={() => void signOut()} />
        <Row icon={Trash2} label="Konto & Daten löschen" danger onClick={() => setDeleteMode('delete')} />
      </Group>

      <Group title="Hilfe & Datenschutz">
        <Row
          icon={MessageSquareWarning}
          tint="neutral"
          label="Feedback & Problem melden"
          hint="Idee, Wunsch oder Fehler"
          onClick={() => setFeedbackOpen(true)}
        />
        <Row icon={ShieldCheck} tint="neutral" label="Datenschutzerklärung" onClick={() => navigate('/datenschutz')} />
        <Row
          icon={ShieldOff}
          tint="neutral"
          label="Einwilligung widerrufen"
          hint="Löscht dein Konto mit allen Daten"
          onClick={() => setDeleteMode('revoke')}
        />
      </Group>
      {nameOpen && <NameSheet current={myProfile?.display_name ?? ''} onClose={() => setNameOpen(false)} />}
      {feedbackOpen && <FeedbackSheet onClose={() => setFeedbackOpen(false)} />}
      {deleteMode && <DeleteAccountSheet revoke={deleteMode === 'revoke'} onClose={() => setDeleteMode(null)} />}
    </div>
  )
}
