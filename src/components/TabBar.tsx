import { NavLink } from 'react-router-dom'
import { usePrefs } from '../lib/prefs'

type IconProps = { className?: string }
const S = 'h-5 w-5'
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

function IconTrain({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M6.5 8v8M17.5 8v8M4 9.5v5M20 9.5v5M6.5 12h11" />
    </svg>
  )
}
function IconFood({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M12 8c-1.5-2.5-5-2.2-6 0-1.2 2.6.4 8 3 10 1 .8 2 .8 3 0 2.6-2 4.2-7.4 3-10-1-2.2-4.5-2.5-6 0Z" />
      <path d="M12 8V5M12 5c0-1 .8-2 2-2" />
    </svg>
  )
}
function IconHistory({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3M8 13h4" />
    </svg>
  )
}
function IconChart({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M4 20V4M4 20h16M8 16v-3M12 16V9M16 16v-6" />
    </svg>
  )
}
function IconList({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}

export function TabBar() {
  const { showNutrition } = usePrefs()

  const tabs = [
    { to: '/', label: 'Training', Icon: IconTrain },
    ...(showNutrition ? [{ to: '/nutrition', label: 'Essen', Icon: IconFood }] : []),
    { to: '/history', label: 'Verlauf', Icon: IconHistory },
    { to: '/analytics', label: 'Auswertung', Icon: IconChart },
    { to: '/exercises', label: 'Übungen', Icon: IconList },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-sand-dark bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs ${
                isActive ? 'text-brand' : 'text-cocoa-muted'
              }`
            }
          >
            <t.Icon />
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
