// Erzeugt eine teilbare Bild-Karte (Canvas) eines Trainings — ohne Foto von dir,
// nur Statistik. Teilt per Web-Share-API, sonst Download.

export interface StatCardData {
  title: string
  dateLabel: string
  volume: number
  sets: number
  exercises: number
  highlight?: string
  rank?: string
  mascot?: string
}

export async function shareStatCard(data: StatCardData): Promise<void> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Hintergrund-Verlauf
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0B0F19')
  grad.addColorStop(1, '#7F1D1D')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'

  if (data.mascot) {
    ctx.font = '140px serif'
    ctx.fillText(data.mascot, W / 2, 260)
  }

  ctx.font = 'bold 64px system-ui, sans-serif'
  ctx.fillText(data.title, W / 2, 380)

  ctx.font = '36px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(data.dateLabel, W / 2, 440)

  // Kennzahlen
  const stats: [string, string][] = [
    [`${data.volume.toLocaleString('de-DE')} kg`, 'Volumen'],
    [`${data.sets}`, 'Sätze'],
    [`${data.exercises}`, 'Übungen'],
  ]
  const startY = 640
  stats.forEach(([value, label], i) => {
    const y = startY + i * 180
    ctx.fillStyle = '#FB7185'
    ctx.font = 'bold 96px system-ui, sans-serif'
    ctx.fillText(value, W / 2, y)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '34px system-ui, sans-serif'
    ctx.fillText(label, W / 2, y + 46)
  })

  if (data.highlight) {
    ctx.fillStyle = '#F59E0B'
    ctx.font = 'bold 40px system-ui, sans-serif'
    ctx.fillText(`🏆 ${data.highlight}`, W / 2, 1200)
  }

  if (data.rank) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '36px system-ui, sans-serif'
    ctx.fillText(data.rank, W / 2, 1270)
  }

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/png'),
  )
  const file = new File([blob], 'training.png', { type: 'image/png' })

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], title: 'Mein Training', text: data.title })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'training.png'
    a.click()
    URL.revokeObjectURL(url)
  }
}
