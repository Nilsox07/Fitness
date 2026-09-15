import { useEffect, useMemo } from 'react'

const COLORS = ['#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#FB7185']

/** Leichtgewichtiges Konfetti (ohne Abhängigkeit) für PR-Feiern. */
export function Confetti({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.8 + Math.random() * 1.2,
        bg: COLORS[i % COLORS.length],
        rot: Math.random() * 360,
        size: 6 + Math.random() * 6,
      })),
    [],
  )

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onDone?.(), 2600)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <style>{`@keyframes confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
      }`}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.bg,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}
