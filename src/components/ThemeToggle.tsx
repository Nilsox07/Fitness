import { useTheme } from '../lib/theme'

/** Schwebender ☀️/🌙-Umschalter (oben rechts). */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md justify-end p-2">
      <button
        type="button"
        onClick={toggle}
        aria-label="Hell-/Dunkelmodus wechseln"
        title={resolved === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
        className="pointer-events-auto rounded-full bg-cream/90 p-2 text-lg leading-none ring-1 ring-sand-dark backdrop-blur active:scale-95"
      >
        {resolved === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
