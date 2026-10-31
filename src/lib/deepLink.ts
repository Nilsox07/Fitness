// Deep Links der Android-App (fitnessbuddy://open/<pfad>) aus Widgets, Benachrichtigungen
// und dem Teilen-Menü. Reine Logik – getestet in deepLink.test.ts.

import { Capacitor } from '@capacitor/core'

/** fitnessbuddy://open/nutrition?x=1 → '/nutrition?x=1'; ohne Pfad → '/today'; fremd → null */
export function deepLinkRoute(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /^fitnessbuddy:\/\/open(\/[^#]*)?/.exec(url)
  if (!m) return null
  return m[1] || '/today'
}

let handledAt = 0
let lastRoute = ''

/** Ein Deep Link wurde gerade geöffnet → die Startseiten-Umleitung kurz auslassen. */
export function markDeepLinkHandled(now = Date.now()): void {
  handledAt = now
}

/**
 * Deep Link öffnen? Beim Kaltstart kommt derselbe Link doppelt (Start-URL und
 * appUrlOpen) – den zweiten innerhalb weniger Sekunden ignorieren.
 */
export function claimDeepLink(route: string, now = Date.now()): boolean {
  if (route === lastRoute && now - handledAt <= 3000) return false
  lastRoute = route
  handledAt = now
  return true
}

export function recentDeepLink(now = Date.now(), withinMs = 5000): boolean {
  return handledAt > 0 && now - handledAt <= withinMs
}

let launch: Promise<string | null> | null = null

/** Route, mit der die App (kalt) gestartet wurde – einmalig gelesen, im Browser null. */
export function launchRoute(): Promise<string | null> {
  if (!launch) {
    launch = Capacitor.isNativePlatform()
      ? import('@capacitor/app')
          .then(({ App }) => App.getLaunchUrl())
          .then((r) => deepLinkRoute(r?.url))
          .catch(() => null)
      : Promise.resolve(null)
  }
  return launch
}
