import type { ReactNode } from 'react'
import { Buddy, type BuddyMood } from '../buddy/Buddy'
import { openBuddySheet } from '../buddy/BuddySheet'

export interface HeroBuddyData {
  mood: BuddyMood
  line: string
  stage: number
  skin: string
}

const SIZE = 84
/** Buddy-Oberkante relativ zum Wrapper (der obere SVG-Rand ist größtenteils leer). */
const TOP = -8
/** Abstand Wrapper → Karte: ≈ 40 % von Buddys sichtbarem Körper ragen über die Kante. */
const PEEK = 30

/**
 * Hero-Karte mit Buddy, der oben rechts über die Kante „lugt" (wie über ein Regal).
 * Die Karte selbst bleibt `overflow-hidden` (Schimmer), Buddy sitzt deshalb im
 * äußeren Wrapper. Ohne `buddy` wird nur `children` gerendert.
 */
export function HeroWithBuddy({ buddy, children }: { buddy?: HeroBuddyData; children: ReactNode }) {
  if (!buddy) return <>{children}</>
  return (
    <div className="relative" style={{ paddingTop: PEEK }}>
      {children}
      <button
        type="button"
        onClick={openBuddySheet}
        aria-label={`Buddy öffnen – „${buddy.line}"`}
        className="absolute right-3 z-10 rounded-full outline-offset-2 transition-transform active:scale-95"
        style={{
          top: TOP,
          width: SIZE,
          height: SIZE,
          transformOrigin: '50% 100%',
          animation: 'check-pop .4s ease-out both',
          animationDelay: '220ms',
          filter: 'drop-shadow(0 6px 8px rgb(0 0 0 / 0.18))',
        }}
      >
        <Buddy size={SIZE} mood={buddy.mood} stage={buddy.stage} skin={buddy.skin} title="Buddy" />
      </button>
    </div>
  )
}

/**
 * Buddys Spruch als kleine Sprechblase oben in der Hero-Karte (zeigt nach rechts
 * oben zu Buddy). `tone`: 'dark' = auf der dunklen Karte, 'light' = auf heller Karte.
 */
export function BuddyLine({ line, tone }: { line: string; tone: 'dark' | 'light' }) {
  const look =
    tone === 'dark'
      ? 'bg-bg/10 text-bg/80 dark:bg-white/5 dark:text-cocoa-light'
      : 'bg-sand/80 text-cocoa-light'
  return (
    <p
      className={`mb-3 mr-[5.5rem] line-clamp-2 w-fit rounded-2xl rounded-tr-md px-3 py-1.5 text-[13px] font-medium leading-snug ${look}`}
    >
      <span aria-hidden className="mr-0.5 font-bold opacity-60">
        „
      </span>
      {line}
      <span aria-hidden className="ml-0.5 font-bold opacity-60">
        “
      </span>
    </p>
  )
}
