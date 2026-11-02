import { useSyncExternalStore } from 'react'
import { loadExtras, subscribeExtras, type ShoppingExtra } from '../lib/shoppingExtras'

/** Eigene Einkaufsliste („Fehlt mir“-Artikel), live aktualisiert. */
export function useShoppingExtras(): ShoppingExtra[] {
  return useSyncExternalStore(subscribeExtras, loadExtras, loadExtras)
}
