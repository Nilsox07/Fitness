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
function IconChart({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M4 20V4M4 20h16M8 16v-3M12 16V9M16 16v-6" />
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

function IconToday({ className = S }: IconProps) {
  return (
    <svg className={className} {...common}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="17" height="7" rx="2" />
    </svg>
  )
}

type Tab = { to: string; label: string; Icon: (p: IconProps) => ReactElement; end?: boolean; also?: string[] }

// Heute + Bereiche je nach Modulen. Unterseiten zählen zu ihrem Bereich (also),
// Zurück geht über die obere Leiste – höchstens zwei Ebenen.
const NUTRITION_TAB: Tab = {
  to: '/nutrition',
  label: 'Ernährung',
  Icon: IconFood,
  end: true,
  also: ['/recipes', '/shopping'],
}
const TODAY_TAB: Tab = { to: '/today', label: 'Heute', Icon: IconToday, end: true }
const TRAINING_TAB: Tab = {
  to: '/',
  label: 'Training',
  Icon: IconTrain,
  end: true,
  also: ['/plans', '/exercises', '/quick'],
}
const PROGRESS_TAB: Tab = {
  to: '/analytics',
  label: 'Fortschritt',
  Icon: IconChart,
  also: ['/history', '/badges', '/body', '/cardio', '/sleep', '/vitals'],
}
const SOCIAL_TAB: Tab = { to: '/social', label: 'Community', Icon: IconPeople, also: ['/feed'] }

export function TabBar() {
  const { showNutrition, showSocial } = usePrefs()
  const { pathname } = useLocation()

  // Höchstens fünf Bereiche – ausgeblendete Module verschwinden
  const tabs: Tab[] = [
    TODAY_TAB,
    TRAINING_TAB,
    ...(showNutrition ? [NUTRITION_TAB] : []),
    PROGRESS_TAB,
    ...(showSocial ? [SOCIAL_TAB] : []),
  ]

  return <FloatingTabBar tabs={tabs} pathname={pathname} />
}

function isTabActive(t: Tab, pathname: string): boolean {
  if (t.also?.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (t.end) return pathname === t.to
  return pathname === t.to || pathname.startsWith(t.to + '/')
}

/** Schwebende Pillen-Leiste mit gleitendem Aktiv-Indikator. */
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
