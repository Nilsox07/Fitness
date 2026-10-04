import { BuddySheetHost } from './buddy/BuddySheet'

/**
 * Früherer KI-Assistent — jetzt das Buddy-Sheet (Stimmung, Level, Tipps + Chat).
 * Geöffnet über `open-buddy` oder (weiterhin) `open-assistant`.
 */
export function Assistant() {
  return <BuddySheetHost />
}
