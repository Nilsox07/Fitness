import { useEffect, useState } from 'react'

/**
 * Kurze Start-Animation (neue App): zwei Ringe (Fitness außen, Ernährung innen)
 * zeichnen sich und schließen sich, dann zoomt alles weg. < 1 s, nur einmal pro
 * App-Start (sessionStorage), bei „Bewegung reduzieren“ nur ein kurzes Ausblenden.
 */
const KEY = 'splash_shown'

export function Splash() {
  const [phase, setPhase] = useState<'draw' | 'out' | 'done'>(() => {
    try {
      return sessionStorage.getItem(KEY) ? 'done' : 'draw'
    } catch {
      return 'done'
    }
  })

  useEffect(() => {
    if (phase === 'done') return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setPhase('out'), reduce ? 150 : 750)
    const t2 = setTimeout(() => setPhase('done'), reduce ? 400 : 1100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // nur beim ersten Rendern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'done') return null

  const R1 = 44
  const R2 = 30
  const c1 = 2 * Math.PI * R1
  const c2 = 2 * Math.PI * R2

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{
        background: 'rgb(11 15 25)',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 320ms ease-out',
      }}
    >
      <style>{`
        @keyframes splash-draw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        @keyframes splash-pop { 0% { transform: scale(1); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
      `}</style>
      <svg
        width="128"
        height="128"
        viewBox="0 0 120 120"
        style={{
          transform: phase === 'out' ? 'scale(1.6)' : 'scale(1)',
          transition: 'transform 340ms cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'splash-pop 260ms ease-out 560ms both',
        }}
      >
        <g transform="rotate(-90 60 60)" fill="none" strokeLinecap="round">
          <circle cx="60" cy="60" r={R1} strokeWidth="11" style={{ stroke: 'rgb(var(--c-ruby) / 0.18)' }} />
          <circle cx="60" cy="60" r={R2} strokeWidth="11" style={{ stroke: 'rgb(var(--c-gold) / 0.18)' }} />
          <circle
            cx="60"
            cy="60"
            r={R1}
            strokeWidth="11"
            strokeDasharray={c1}
            style={
              {
                stroke: 'rgb(var(--c-ruby))',
                '--len': `${c1}`,
                animation: 'splash-draw 520ms cubic-bezier(0.5, 0, 0.2, 1) both',
              } as React.CSSProperties
            }
          />
          <circle
            cx="60"
            cy="60"
            r={R2}
            strokeWidth="11"
            strokeDasharray={c2}
            style={
              {
                stroke: 'rgb(var(--c-gold))',
                '--len': `${c2}`,
                animation: 'splash-draw 480ms cubic-bezier(0.5, 0, 0.2, 1) 90ms both',
              } as React.CSSProperties
            }
          />
        </g>
      </svg>
    </div>
  )
}
