import { useRef, useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'

/** Vorher/Nachher übereinander – Griff ziehen, um zwischen beiden Fotos zu wischen. */
export function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)

  function move(clientX: number) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={ref}
      className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden rounded-3xl bg-sand"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
        {afterLabel}
      </span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-cocoa shadow-lg">
          <ChevronsLeftRight size={20} />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Vorher/Nachher vergleichen"
        className="sr-only"
      />
    </div>
  )
}
