import { NavLink, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
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
function IconPlan({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  )
}
function IconBook({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5V5.5Z" />
      <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v2.5H6.5A1.5 1.5 0 0 1 5 19.5Z" />
    </svg>
  )
}
function IconCart({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M4 5h2l1.5 9.5A2 2 0 0 0 9.5 16h7a2 2 0 0 0 2-1.6L20 8H7" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </svg>
  )
}
function IconPeople({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  )
}

type Tab = { to: string; label: string; Icon: (p: IconProps) => ReactElement; end?: boolean; also?: string[] }

const FITNESS_TABS: Tab[] = [
  { to: '/', label: 'Heute', Icon: IconTrain, end: true },
  { to: '/plans', label: 'Pläne', Icon: IconPlan },
  { to: '/analytics', label: 'Fortschritt', Icon: IconChart, also: ['/history'] },
  { to: '/social', label: 'Community', Icon: IconPeople },
]

const FOOD_TABS: Tab[] = [
  { to: '/nutrition', label: 'Heute', Icon: IconFood, end: true },
  { to: '/recipes', label: 'Rezepte', Icon: IconBook },
  { to: '/shopping', label: 'Plan', Icon: IconCart },
  { to: '/analytics', label: 'Fortschritt', Icon: IconChart, also: ['/history'] },
  { to: '/social', label: 'Community', Icon: IconPeople },
]

export function TabBar() {
  const { showNutrition, isNew, world } = usePrefs()
  const { pathname } = useLocation()

  // Klassisch = alte, schlanke App
  const classicTabs: Tab[] = [
    { to: '/', label: 'Training', Icon: IconTrain, end: true },
    ...(showNutrition ? [{ to: '/nutrition', label: 'Essen', Icon: IconFood }] : []),
    { to: '/history', label: 'Verlauf', Icon: IconHistory },
    { to: '/analytics', label: 'Auswertung', Icon: IconChart },
    { to: '/exercises', label: 'Übungen', Icon: IconList },
  ]

  const tabs = !isNew ? classicTabs : world === 'food' ? FOOD_TABS : FITNESS_TABS

  if (isNew) return <FloatingTabBar tabs={tabs} pathname={pathname} />

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-sand-dark bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to + t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive || t.also?.includes(pathname) ? 'text-brand' : 'text-cocoa-muted'
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

function isTabActive(t: Tab, pathname: string): boolean {
  if (t.also?.includes(pathname)) return true
  if (t.end) return pathname === t.to
  return pathname === t.to || pathname.startsWith(t.to + '/')
}

/** Neue App: schwebende Pillen-Leiste mit gleitendem Aktiv-Indikator. */
function FloatingTabBar({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  const active = tabs.findIndex((t) => isTabActive(t, pathname))
  const n = tabs.length

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="pointer-events-auto relative mx-auto max-w-md rounded-[28px] bg-cream/80 p-1.5 shadow-[0_12px_32px_-10px_rgb(0_0_0/0.35)] ring-1 ring-black/5 backdrop-blur-xl dark:bg-sand-light/90 dark:ring-white/10">
        {/* Gleitende Pille hinter dem aktiven Tab */}
        {active >= 0 && (
          <div
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 rounded-[22px] bg-brand shadow-[0_6px_16px_-4px_rgb(var(--c-ruby)/0.6)] transition-transform duration-300 ease-[cubic-bezier(0.3,1.35,0.5,1)]"
            style={{ width: `calc((100% - 12px) / ${n})`, transform: `translateX(${active * 100}%)` }}
          />
        )}
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {tabs.map((t, i) => {
            const on = i === active
            return (
              <NavLink
                key={t.to + t.label}
                to={t.to}
                end={t.end}
                aria-current={on ? 'page' : undefined}
                className={`flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10px] font-semibold transition-colors duration-200 active:scale-95 ${
                  on ? 'text-on-brand' : 'text-cocoa-muted hover:text-cocoa'
                }`}
              >
                <span className={`transition-transform duration-300 ${on ? '-translate-y-px scale-110' : ''}`}>
                  <t.Icon />
                </span>
                <span className="max-w-full truncate tracking-tight">{t.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
