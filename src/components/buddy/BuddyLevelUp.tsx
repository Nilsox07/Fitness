import { useCallback, useState } from 'react'
import { mascotEmoji } from '../../lib/cosmetics'
import { rankForSessions } from '../../lib/gamification'
import { shareStatCard } from '../../lib/statcard'
import { Confetti } from '../Confetti'
import { MyBuddy } from './MyBuddy'
import { useBuddyLevelUp } from './useBuddy'

/**
 * Einzige Level-up-Feier der neuen App (Buddy-Level). Rendert nichts, solange kein
 * Aufstieg ansteht; der gefeierte Level wird geteilt gespeichert → kein Doppel-Konfetti.
 */
export function BuddyLevelUp() {
  const { info, celebrate } = useBuddyLevelUp()
  // Konfetti läuft einmal; das Banner (mit Teilen) bleibt, solange die Seite offen ist.
  const [confettiDone, setConfettiDone] = useState(false)
  const onConfettiDone = useCallback(() => setConfettiDone(true), [])
  if (!celebrate) return null
  return (
    <>
      <Confetti show={!confettiDone} onDone={onConfettiDone} />
      <div className="anim-fade flex items-center gap-3 rounded-2xl bg-gold/15 px-3 py-2.5">
        <MyBuddy size={52} mood="cheer" className="-my-2 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-cocoa">
            Buddy-Level <span className="tabular">{info.level}</span> erreicht!
          </div>
          <div className="text-xs text-cocoa-light">Dein Buddy wächst mit dir.</div>
        </div>
        <button
          className="shrink-0 rounded-full bg-gold px-3 py-1 text-sm font-semibold text-white"
          onClick={() =>
            // Die geteilte Grafik (Canvas) nutzt weiterhin das Emoji-Maskottchen.
            shareStatCard({
              title: `Buddy-Level ${info.level} erreicht! ⭐`,
              dateLabel: new Date().toLocaleDateString('de-DE'),
              volume: 0,
              sets: 0,
              exercises: 0,
              mascot: mascotEmoji(info.sessions),
              rank: rankForSessions(info.sessions).title,
              stats: [
                [`${info.level}`, 'Level'],
                [`${info.sessions}`, 'Trainings'],
                [`${info.xp.toLocaleString('de-DE')}`, 'XP'],
              ],
            })
          }
        >
          Teilen
        </button>
      </div>
    </>
  )
}
