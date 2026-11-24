// Sätze per Gedrückthalten verschieben: Satznummer kurz halten → Satz hebt sich an und folgt dem Finger,
// die anderen rücken zur Seite, Loslassen setzt ihn ab. Kurzes Tippen bleibt „Optionen öffnen“.

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { haptic } from '../../lib/native'
import { dropIndex } from '../../lib/workoutSession'

export interface DragHandle {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: (e: PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  /** Klick nach einem Ziehen schlucken (sonst ginge das Menü auf) */
  onClickCapture: (e: React.MouseEvent) => void
  style: CSSProperties
}

const HOLD_MS = 320

export function SortableSets<T extends { id: string }>({
  items,
  render,
  onMove,
}: {
  items: readonly T[]
  render: (item: T, index: number, handle: DragHandle, dragging: boolean) => ReactNode
  onMove: (from: number, to: number) => void
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const press = useRef<{ index: number; y: number; timer: ReturnType<typeof setTimeout> | undefined } | null>(null)
  const swallowClick = useRef(false)
  const [drag, setDrag] = useState<{ from: number; dy: number; heights: number[]; startY: number } | null>(null)

  const target = drag ? dropIndex(drag.from, drag.dy, drag.heights) : -1

  function handleFor(index: number): DragHandle {
    return {
      style: { touchAction: 'none' },
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const el = e.currentTarget
        const id = e.pointerId
        const y = e.clientY
        press.current = {
          index,
          y,
          timer: setTimeout(() => {
            const heights = refs.current.slice(0, items.length).map((r) => (r?.offsetHeight ?? 56) + 4)
            try {
              el.setPointerCapture(id)
            } catch {
              /* ignore */
            }
            void haptic('medium')
            setDrag({ from: index, dy: 0, heights, startY: y })
          }, HOLD_MS),
        }
      },
      onPointerMove: (e) => {
        if (drag) {
          setDrag((d) => (d ? { ...d, dy: e.clientY - d.startY } : d))
          return
        }
        // vor dem Anheben bewegt → kein Ziehen
        if (press.current && Math.abs(e.clientY - press.current.y) > 8) {
          clearTimeout(press.current.timer)
          press.current = null
        }
      },
      onPointerUp: () => {
        if (press.current) clearTimeout(press.current.timer)
        press.current = null
        if (drag) {
          swallowClick.current = true
          const to = dropIndex(drag.from, drag.dy, drag.heights)
          setDrag(null)
          if (to !== drag.from) {
            onMove(drag.from, to)
            void haptic('light')
          }
        }
      },
      onPointerCancel: () => {
        if (press.current) clearTimeout(press.current.timer)
        press.current = null
        setDrag(null)
      },
      onClickCapture: (e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      },
    }
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        let style: CSSProperties | undefined
        if (drag) {
          const h = drag.heights[drag.from]
          if (i === drag.from)
            style = {
              transform: `translateY(${drag.dy}px) scale(1.02)`,
              zIndex: 20,
              position: 'relative',
              transition: 'none',
              boxShadow: '0 10px 24px rgb(0 0 0 / 0.18)',
              borderRadius: 16,
            }
          else if (drag.from < i && i <= target)
            style = { transform: `translateY(${-h}px)`, transition: 'transform 150ms' }
          else if (target <= i && i < drag.from)
            style = { transform: `translateY(${h}px)`, transition: 'transform 150ms' }
          else style = { transition: 'transform 150ms' }
        }
        return (
          <div
            key={item.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            style={style}
            className="rounded-2xl bg-cream"
          >
            {render(item, i, handleFor(i), drag?.from === i)}
          </div>
        )
      })}
    </div>
  )
}
