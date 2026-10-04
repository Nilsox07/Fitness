import { useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Droplets,
  Dumbbell,
  Footprints,
  MessageCircle,
  Moon,
  Sandwich,
  StretchHorizontal,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { useAiStatus } from '../../hooks/useAi'
import { useTrainingRhythm } from '../../hooks/usePrefsSync'
import { trainingDay } from '../../lib/day'
import type { BuddyMood } from '../../lib/buddyMood'
import { PremiumSheet } from '../ui/PremiumSheet'
import { Buddy, BUDDY_STAGE_LABELS } from './Buddy'
import { BuddyChatComposer, BuddyChatMessages, useBuddyChat } from './BuddyChat'
import { useBuddy, useBuddyLevel } from './useBuddy'

/** Öffnet das Buddy-Sheet (Buddy-Gesicht oben rechts, Buddy auf der Hero-Karte …). */
export const OPEN_BUDDY_EVENT = 'open-buddy'
/** Älteres Event (KI-Assistent) — öffnet weiterhin dasselbe Sheet. */
export const OPEN_ASSISTANT_EVENT = 'open-assistant'

export function openBuddySheet(): void {
  window.dispatchEvent(new Event(OPEN_BUDDY_EVENT))
}

/** Route des Schnell-Workouts (falls vorhanden). */
const QUICK_ROUTE = '/quick'

export interface BuddyTip {
  icon: ComponentType<{ size?: number; className?: string }>
  text: string
  to?: string
}

/** 2–3 kurze Tipps passend zur Stimmung. Rein funktional. */
export function buddyTips(i: {
  mood: BuddyMood
  restDay: boolean
  proteinLeft: number
  weeklyLeft: number
  showQuick: boolean
}): BuddyTip[] {
  const quick: BuddyTip = i.showQuick
    ? { icon: Zap, text: 'Kurzes Schnell-Workout? 10 Min reichen.', to: QUICK_ROUTE }
    : { icon: Zap, text: 'Schon 20 Minuten zählen – Hauptsache anfangen.', to: '/' }
  if (i.mood === 'hungry' && i.proteinLeft > 0) {
    return [
      { icon: Sandwich, text: `Noch ${i.proteinLeft} g Eiweiß: Skyr, Thunfisch, Shake`, to: '/nutrition' },
      { icon: Droplets, text: 'Ein großes Glas Wasser dazu.' },
    ]
  }
  if (i.mood === 'sad' || i.mood === 'sleepy') {
    return [quick, { icon: Footprints, text: 'Oder erst mal 20 Min spazieren.' }]
  }
  if (i.restDay || i.mood === 'tired') {
    return [
      { icon: StretchHorizontal, text: 'Dehnen: 10 Min Mobility für Hüfte & Schultern' },
      { icon: Footprints, text: 'Spaziergang: 20–30 Min an der frischen Luft' },
      { icon: Moon, text: 'Früh schlafen – da wachsen die Muskeln.' },
    ]
  }
  if (i.mood === 'proud') {
    return [
      { icon: Trophy, text: 'Schau dir deine Erfolge an.', to: '/badges' },
      { icon: Moon, text: 'Gut essen und erholen – du hast es dir verdient.' },
    ]
  }
  if (i.mood === 'focus') {
    return [
      { icon: Moon, text: '1–3 Min Pause zwischen den Sätzen.' },
      { icon: Droplets, text: 'Zwischendurch trinken!' },
    ]
  }
  // happy
  const tips: BuddyTip[] = []
  if (i.weeklyLeft > 0)
    tips.push({
      icon: Dumbbell,
      text: `Noch ${i.weeklyLeft} ${i.weeklyLeft === 1 ? 'Training' : 'Trainings'} bis zum Wochenziel.`,
      to: '/',
    })
  if (i.proteinLeft > 0) tips.push({ icon: Sandwich, text: `Heute noch ${i.proteinLeft} g Eiweiß offen.`, to: '/nutrition' })
  tips.push({ icon: Droplets, text: 'Trinken nicht vergessen – 2 Liter am Tag.' })
  return tips.slice(0, 3)
}

/** Einmal mounten: lauscht auf `open-buddy` / `open-assistant` und zeigt das Buddy-Sheet. */
export function BuddySheetHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_BUDDY_EVENT, onOpen)
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen)
    return () => {
      window.removeEventListener(OPEN_BUDDY_EVENT, onOpen)
      window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen)
    }
  }, [])
  if (!open) return null
  return <BuddySheet onClose={() => setOpen(false)} />
}

/**
 * Buddy-Sheet: großer Buddy mit Stimmung, Spruch, Level + XP, Tipps und Schnell-Links;
 * darunter (wenn KI an) der Chat.
 */
export function BuddySheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data: ai } = useAiStatus()
  const aiOn = Boolean(ai?.enabled)
  const buddy = useBuddy()
  const level = useBuddyLevel()
  const rhythm = useTrainingRhythm(trainingDay())
  const chat = useBuddyChat(onClose)
  const chatting = chat.messages.length > 0

  const tips = buddyTips({
    mood: buddy.mood,
    restDay: rhythm.today.kind === 'rest',
    proteinLeft: buddy.proteinLeft,
    weeklyLeft: Math.max(0, buddy.weeklyGoal - buddy.weeklySessions),
    showQuick: true,
  })

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const mood = chat.busy ? 'focus' : buddy.mood
  const stageLabel = BUDDY_STAGE_LABELS[buddy.stage] ?? ''

  const levelBar = (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-bold text-cocoa">
          Level <span className="tabular">{level.level}</span>
          <span className="ml-1.5 font-medium text-cocoa-muted">· {stageLabel}</span>
        </span>
        <span className="tabular text-cocoa-light">
          {level.xpInLevel.toLocaleString('de-DE')} / {level.xpForLevel.toLocaleString('de-DE')} XP
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-label="Fortschritt zum nächsten Level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level.progress)}
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(3, Math.min(100, level.progress))}%` }}
        />
      </div>
    </div>
  )

  const hero = chatting ? (
    // Kompakt, sobald gechattet wird — Platz für den Verlauf.
    <div className="flex items-center gap-3 pb-3 pr-10 pt-1">
      <Buddy size={56} mood={mood} stage={buddy.stage} skin={buddy.skin} className="-my-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-cocoa">{chat.busy ? 'Buddy tippt…' : buddy.line}</p>
        <div className="mt-1">{levelBar}</div>
      </div>
    </div>
  ) : (
    <div className="relative -mx-5 overflow-hidden px-5 pb-1 pt-1 text-center">
      <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex flex-col items-center">
        <Buddy size={140} mood={mood} stage={buddy.stage} skin={buddy.skin} title="Buddy" />
        <div className="relative mt-1 max-w-[19rem] rounded-2xl bg-cream px-4 py-2.5 text-[15px] font-medium leading-snug text-cocoa ring-1 ring-sand-dark/40">
          <span
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] bg-cream"
            aria-hidden
          />
          <span className="relative">{buddy.line}</span>
        </div>
        <div className="mt-4 w-full rounded-2xl bg-sand-light p-3 ring-1 ring-sand-dark/40 dark:bg-sand">
          {levelBar}
        </div>
      </div>
    </div>
  )

  return (
    <PremiumSheet
      title="Buddy"
      hero={hero}
      onClose={onClose}
      full={aiOn}
      z="z-40"
      bodyClassName="space-y-3"
      footer={aiOn ? <BuddyChatComposer chat={chat} /> : undefined}
    >
      {!chatting && (
        <>
          {tips.length > 0 && (
            <section aria-label="Buddy-Tipps" className="space-y-1.5">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
                Buddys Tipps
              </h3>
              <ul className="space-y-1.5">
                {tips.map((t) => {
                  const Icon = t.icon
                  const inner = (
                    <>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-cocoa">{t.text}</span>
                      {t.to && <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />}
                    </>
                  )
                  return (
                    <li key={t.text}>
                      {t.to ? (
                        <button
                          type="button"
                          onClick={() => go(t.to!)}
                          className="flex w-full items-center gap-3 rounded-2xl bg-cream px-3 py-2.5 text-left ring-1 ring-sand-dark/40 transition active:scale-[0.99]"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2.5 ring-1 ring-sand-dark/40">
                          {inner}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost gap-2 text-sm" onClick={() => go('/badges')}>
              <Trophy size={16} />
              Buddy-Seite
            </button>
            <button type="button" className="btn-ghost gap-2 text-sm" onClick={() => go('/profile')}>
              <User size={16} />
              Profil
            </button>
          </div>

          {aiOn && (
            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-cocoa-muted">
              <MessageCircle size={13} />
              Frag mich was — ich logge, lege an und bringe dich hin.
            </p>
          )}
        </>
      )}

      {aiOn && <BuddyChatMessages chat={chat} stage={buddy.stage} skin={buddy.skin} />}
    </PremiumSheet>
  )
}
