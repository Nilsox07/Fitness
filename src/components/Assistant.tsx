import { BuddySheetHost } from './buddy/BuddySheet'
import { PlusSheetHost } from './premium/PlusSheet'

/**
 * Früherer KI-Assistent — jetzt das Buddy-Sheet (Stimmung, Level, Tipps + Chat).
 * Geöffnet über `open-buddy` oder (weiterhin) `open-assistant`. Dazu das „Buddy Plus“-Sheet (`open-plus`).
 */
export function Assistant() {
  return (
    <>
      <BuddySheetHost />
      <PlusSheetHost />
    </>
  )
}
