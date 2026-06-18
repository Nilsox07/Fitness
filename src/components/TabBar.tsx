import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Training', icon: '🏋️' },
  { to: '/history', label: 'Verlauf', icon: '🗓️' },
  { to: '/analytics', label: 'Auswertung', icon: '📈' },
  { to: '/exercises', label: 'Übungen', icon: '📋' },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-slate-800 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="grid grid-cols-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                isActive ? 'text-brand' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
