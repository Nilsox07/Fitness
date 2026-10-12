import { Children, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Wisch-Karussell mit Punkten (Duelle & Team-Ziele der Woche). */
export function WeekCarousel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const slides = Children.toArray(children).filter(Boolean)
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  function onScroll() {
    const el = ref.current
    if (!el) return
    const w = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth + 12 : el.clientWidth
    setActive(Math.round(el.scrollLeft / Math.max(1, w)))
  }

  function go(i: number) {
    const el = ref.current
    const child = el?.children[i] as HTMLElement | undefined
    if (el && child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft - 16, behavior: 'smooth' })
  }

  if (slides.length === 0) return null
  return (
    <div className="space-y-2" style={style}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className={`flex shrink-0 snap-start flex-col [&>*]:flex-1 ${slides.length > 1 ? 'w-[88%]' : 'w-full'}`}
          >
            {s}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Wochen-Challenges">
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === active}
              aria-label={`Karte ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-5 bg-brand' : 'w-1.5 bg-sand-dark'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
