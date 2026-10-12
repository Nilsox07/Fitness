// Teilbare Story-Karte (1080×1920, Instagram-/WhatsApp-Status-Format) für den
// Monats-Rückblick. Buddy wird aus dem gerenderten SVG übernommen.

import { accentColor } from './cosmetics'
import type { MonthRecap } from './monthRecap'

/** Gerendertes Buddy-SVG als Bild laden (CSS-Variablen werden aufgelöst). */
async function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  try {
    const cs = getComputedStyle(svg)
    let markup = new XMLSerializer().serializeToString(svg)
    for (const v of ['--c-ruby', '--c-ruby-dark', '--c-ruby-light', '--c-text-muted']) {
      const val = cs.getPropertyValue(v).trim()
      if (val) markup = markup.split(`var(${v})`).join(val)
    }
    if (!markup.includes('xmlns=')) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } catch {
    return null
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function renderMonthStory(
  r: MonthRecap,
  opts: { buddySvg?: SVGSVGElement | null; name?: string | null; nutrition: boolean },
): Promise<Blob> {
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0B0F19')
  bg.addColorStop(1, '#141B2D')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // Akzent-Schimmer
  const glow = ctx.createRadialGradient(W * 0.85, 260, 20, W * 0.85, 260, 620)
  glow.addColorStop(0, accentColor('base', 0.55))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '600 40px system-ui, sans-serif'
  ctx.fillText('MEIN MONAT', 90, 200)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 110px system-ui, sans-serif'
  ctx.fillText(r.monthName.split(' ')[0], 90, 320)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '44px system-ui, sans-serif'
  ctx.fillText(r.monthName.split(' ')[1] ?? '', 90, 385)

  if (opts.buddySvg) {
    const img = await svgToImage(opts.buddySvg)
    if (img) ctx.drawImage(img, W - 430, 120, 360, 360)
  }

  // Kacheln
  const tiles: [string, string][] = [
    [String(r.sessions), r.sessions === 1 ? 'Training' : 'Trainings'],
    [
      r.volume >= 1000
        ? `${(r.volume / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`
        : `${r.volume} kg`,
      'bewegt',
    ],
    [String(r.prs), r.prs === 1 ? 'Bestleistung' : 'Bestleistungen'],
    [String(r.weekStreak), r.weekStreak === 1 ? 'Woche Serie' : 'Wochen Serie'],
  ]
  if (opts.nutrition) {
    tiles.push([String(r.loggedDays), 'Tage getrackt'], [String(r.proteinDays), '× Eiweißziel'])
  }
  const cols = 2
  const tw = (W - 180 - 40) / cols
  const th = 250
  tiles.forEach(([v, l], i) => {
    const x = 90 + (i % cols) * (tw + 40)
    const y = 520 + Math.floor(i / cols) * (th + 40)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, x, y, tw, th, 48)
    ctx.fill()
    ctx.fillStyle = i === 0 ? accentColor('light') : '#fff'
    ctx.font = 'bold 104px system-ui, sans-serif'
    ctx.fillText(v, x + 50, y + 140)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '40px system-ui, sans-serif'
    ctx.fillText(l, x + 50, y + 200)
  })

  let y = 520 + Math.ceil(tiles.length / cols) * (th + 40) + 40
  const line = (label: string, value: string) => {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '40px system-ui, sans-serif'
    ctx.fillText(label, 90, y)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px system-ui, sans-serif'
    ctx.fillText(value, 90, y + 64)
    y += 150
  }
  if (r.topExercise) line('Lieblingsübung', r.topExercise)
  if (r.weightChange !== null && r.weightChange !== 0)
    line('Gewicht', `${r.weightChange > 0 ? '+' : '−'}${Math.abs(r.weightChange).toLocaleString('de-DE')} kg`)

  // Fuß
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '36px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(opts.name ? `${opts.name} · Fitness Tracker` : 'Fitness Tracker', W / 2, H - 110)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png'))
}

/** Per Web-Share teilen (Instagram, WhatsApp …), sonst herunterladen. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], text })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
