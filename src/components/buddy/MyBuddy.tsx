import { Buddy, type BuddyProps } from './Buddy'
import { useBuddyLook } from './useBuddy'

/** Der eigene Buddy — Stufe und Skin kommen automatisch aus den eigenen Daten. */
export function MyBuddy(props: Omit<BuddyProps, 'stage' | 'skin'>) {
  const look = useBuddyLook()
  return <Buddy {...props} stage={look.stage} skin={look.skin} />
}
