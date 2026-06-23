import { useTheme } from '../lib/theme'

/** Hell-/Dunkelmodus-Umschalter (inline, z. B. in einer Kopfzeile). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Hell-/Dunkelmodus wechseln"
      title={resolved === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
      className={`btn-ghost text-base leading-none ${className}`}
    >
      {resolved === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
