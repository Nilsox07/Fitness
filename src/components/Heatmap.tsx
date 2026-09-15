// GitHub-artige Trainings-Heatmap der letzten ~17 Wochen.

const WEEKS = 17

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function Heatmap({ dates }: { dates: string[] }) {
  const trained = new Set(dates)
  const today = new Date()
  // Auf Wochenraster: zurück bis Montag vor WEEKS Wochen
  const start = new Date(today)
  const dow = (start.getDay() + 6) % 7 // Mo=0
  start.setDate(start.getDate() - dow - (WEEKS - 1) * 7)

  const cols: { key: string; on: boolean; future: boolean }[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const col: { key: string; on: boolean; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start)
      cur.setDate(start.getDate() + w * 7 + d)
      const key = dayKey(cur)
      col.push({ key, on: trained.has(key), future: cur > today })
    }
    cols.push(col)
  }

  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Trainings-Kalender</h2>
      <div className="flex gap-[3px] overflow-x-auto">
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <span
                key={cell.key}
                title={cell.key}
                className={`h-3 w-3 rounded-[3px] ${
                  cell.future
                    ? 'bg-transparent'
                    : cell.on
                      ? 'bg-brand'
                      : 'bg-sand-dark/40'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-cocoa-muted">Jedes Kästchen = ein Tag. Gefüllt = trainiert.</p>
    </section>
  )
}
