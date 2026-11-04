import { useNavigate } from 'react-router-dom'
import { useBuddy } from '../buddy/useBuddy'
import { isTipHidden, usePageTip } from '../buddy/BuddyTip'
import { openBuddySheet } from '../buddy/BuddySheet'
import { useAiGate } from '../../hooks/usePremium'
import type { TipPage } from '../../lib/buddyTips'
import type { HeroBuddyData } from './HeroBuddy'

/**
 * Buddy für die große Karte eines Tabs: ein Spruch statt zwei. Ein passender Seiten-Tipp ersetzt
 * den allgemeinen Spruch; Antippen = Aktion bzw. „Frag Buddy“. `generic` = Tipp-Schlüssel, die nur
 * Füller sind (dann bleibt der allgemeine Spruch).
 */
export function useHeroBuddy(page: TipPage, generic: string[] = []): HeroBuddyData {
  const buddy = useBuddy()
  const { tip, day } = usePageTip(page)
  const navigate = useNavigate()
  const gate = useAiGate()
  if (!tip || generic.includes(tip.key) || isTipHidden(tip.key, day)) return buddy
  const onLine = tip.action
    ? () => navigate(tip.action!.to)
    : tip.ask && (gate.canUse || gate.locked)
      ? () => {
          if (gate.requirePlus()) openBuddySheet(tip.ask)
        }
      : undefined
  return { ...buddy, line: tip.text, mood: tip.mood, onLine }
}
