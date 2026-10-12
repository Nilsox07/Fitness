// Gesammelte Saison-Abzeichen (exklusiv pro Monat). Die Liste der verdienten
// Abzeichen liegt im Profil (prefs.achievements: `season-YYYY-MM`); Emoji und
// Name des jeweiligen Monats werden hier lokal gemerkt, damit Buddy den Anstecker
// auch ohne Netz anzeigen kann.

const KEY = 'season_badges'

export interface SeasonBadge {
  emoji: string
  label: string
}

export function seasonBadges(): Record<string, SeasonBadge> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function rememberSeasonBadge(id: string, badge: SeasonBadge) {
  try {
    const all = seasonBadges()
    if (all[id]?.emoji === badge.emoji && all[id]?.label === badge.label) return
    localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: badge }))
  } catch {
    /* ignore */
  }
}

/** Accessoire-ID → Props für <Buddy>: Saison-Abzeichen werden als Anstecker gezeigt. */
export function accessoryProps(acc: string | null | undefined): { accessory?: string; pin?: string } {
  if (!acc || acc === 'none') return {}
  if (acc.startsWith('season-')) {
    const b = seasonBadges()[acc]
    return b ? { pin: b.emoji } : {}
  }
  return { accessory: acc }
}
