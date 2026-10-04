import { useEffect } from 'react'
import { mascotEmoji } from '../../lib/cosmetics'
import { rankForSessions } from '../../lib/gamification'
import { shareStatCard } from '../../lib/statcard'
import { showBuddyMoment } from './BuddyMoment'
import { useBuddyLevelUp } from './useBuddy'

/**
 * Einzige Level-up-Feier der neuen App (Buddy-Level). Rendert nichts; steht ein
 * Aufstieg an, erscheint ein großer Buddy-Moment. Der gefeierte Level wird geteilt
 * gespeichert (`seen_buddy_level`) → keine Doppel-Feier, auch wenn die Komponente
 * mehrfach gemountet ist (BuddyMomentHost, Fortschritts-Karten).
 */
export function BuddyLevelUp() {
  const { info, celebrate, dismiss } = useBuddyLevelUp()
  const { level, sessions, xp } = info

  useEffect(() => {
    if (!celebrate) return
    dismiss()
    showBuddyMoment({
      key: `level-${level}`,
      mood: 'cheer',
      title: `Level ${level} erreicht!`,
      subtitle: 'Dein Buddy wächst mit dir.',
      chips: [
        { value: String(level), label: 'Level' },
        { value: String(sessions), label: sessions === 1 ? 'Training' : 'Trainings' },
        { value: xp.toLocaleString('de-DE'), label: 'XP' },
      ],
      action: {
        label: 'Teilen',
        onClick: () =>
          // Die geteilte Grafik (Canvas) nutzt weiterhin das Emoji-Maskottchen.
          void shareStatCard({
            title: `Buddy-Level ${level} erreicht! ⭐`,
            dateLabel: new Date().toLocaleDateString('de-DE'),
            volume: 0,
            sets: 0,
            exercises: 0,
            mascot: mascotEmoji(sessions),
            rank: rankForSessions(sessions).title,
            stats: [
              [`${level}`, 'Level'],
              [`${sessions}`, 'Trainings'],
              [`${xp.toLocaleString('de-DE')}`, 'XP'],
            ],
          }),
      },
    })
  }, [celebrate, dismiss, level, sessions, xp])

  return null
}
