import { Buddy, type BuddyProps } from './Buddy'
import { useBuddyLook } from './useBuddy'
import { accessoryProps } from '../../lib/seasonBadges'

/** Der eigene Buddy — Stufe und Skin kommen automatisch aus den eigenen Daten. */
export function MyBuddy(props: Omit<BuddyProps, 'stage' | 'skin' | 'variant' | 'accessory' | 'pin'>) {
  const look = useBuddyLook()
  return (
    <Buddy {...props} stage={look.stage} skin={look.skin} variant={look.variant} {...accessoryProps(look.accessory)} />
  )
}
