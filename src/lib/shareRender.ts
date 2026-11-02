// Teilen-Bilder zeichnen (Canvas). Drei Stile:
//  - card:  Buddy-Karte als Sticker (PNG mit durchsichtigem Rand) – Buddy ragt oben aus der Karte,
//           große Zahl im Hintergrund, goldenes Siegel. Farbe = App-Farbe.
//  - story: dieselbe Karte auf vollem Story-Hintergrund (1080×1920) – für WhatsApp & Co.
//  - clean: nur weiße Schrift auf durchsichtigem Grund – zum Drüberlegen auf ein eigenes Foto.
// Inhalte kommen aus shareCard.ts.

import { accentColor } from './cosmetics'
import { wrapTwoLines, type ShareContent, type ShareStyle } from './shareCard'

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const BRAND = 'Fitness Buddy'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
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

function goldColor(alpha = 1): string {
  let rgb = '245 184 61'
  try {
    rgb = getComputedStyle(document.documentElement).getPropertyValue('--c-gold').trim() || rgb
  } catch {
    /* ignore */
  }
  // Im hellen Modus ist Gold dunkler – auf der dunklen Karte immer das helle Gold
  if (rgb.startsWith('217')) rgb = '245 184 61'
  return `rgba(${rgb.split(/\s+/).join(', ')}, ${alpha})`
}

/** Feine Körnung (macht Verläufe „analog“ statt glatt). */
function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.06) {
  const [tile, t] = canvas(160, 160)
  const img = t.createImageData(160, 160)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  t.putImageData(img, 0, 0)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/** Buddy als weiße Silhouette (für den cleanen Stil, wie ein Logo). */
function silhouette(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size)
  ctx.drawImage(img, 0, 0, size, size)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  return c
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, maxW: number): number {
  let size = start
  ctx.font = `${weight} ${size}px ${FONT}`
  while (size > 20 && ctx.measureText(text).width > maxW) {
    size -= 2
    ctx.font = `${weight} ${size}px ${FONT}`
  }
  return size
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) {
    c.letterSpacing = `${spacing}px`
    ctx.fillText(text, x, y)
    c.letterSpacing = '0px'
  } else ctx.fillText(text, x, y)
}

// ---------------------------------------------------------------- Karte

const CARD_W = 1080
const CARD_H = 1000
/** Oberkante der eigentlichen Karte – darüber ragt Buddy hinaus. */
const CARD_TOP = 250

function drawCard(
  ctx: CanvasRenderingContext2D,
  d: ShareContent,
  buddy: HTMLImageElement | null,
  ox = 0,
  oy = 0,
  brand = true,
) {
  const x = ox + 40
  const y = oy + CARD_TOP
  const w = CARD_W - 80
  const h = CARD_H - CARD_TOP - 40

  // Schatten unter der Karte
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 20
  roundRect(ctx, x, y, w, h, 64)
  ctx.fillStyle = '#0B0F19'
  ctx.fill()
  ctx.restore()

  // Fläche: App-Farbe → fast Schwarz, Lichtschein hinter Buddy
  ctx.save()
  roundRect(ctx, x, y, w, h, 64)
  ctx.clip()
  // hell unten links, dunkel oben rechts – dort steht Buddy und hebt sich ab
  const bg = ctx.createLinearGradient(x, y + h, x + w, y)
  bg.addColorStop(0, accentColor('base'))
  bg.addColorStop(0.4, accentColor('dark'))
  bg.addColorStop(0.8, '#120A12')
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  const glow = ctx.createRadialGradient(x + w - 250, y + 60, 10, x + w - 250, y + 60, 380)
  glow.addColorStop(0, 'rgba(255,255,255,0.16)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(x, y, w, h)

  // Riesige Zahl im Hintergrund, angeschnitten
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 520px ${FONT}`
  ctx.fillText(d.bigNumber, x - 30, y + h + 90)

  grain(ctx, x, y, w, h)
  ctx.restore()

  // Texte links
  const left = x + 70
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `700 30px ${FONT}`
  spaced(ctx, `${d.title} · ${d.dateLabel}`.toUpperCase(), left, y + (d.seal ? 190 : 110), 3)

  ctx.fillStyle = '#fff'
  const headSize = 84
  ctx.font = `900 ${headSize}px ${FONT}`
  const lines = wrapTwoLines(d.headline, 500, (s) => ctx.measureText(s).width)
  lines.forEach((l, i) => ctx.fillText(l, left, y + (d.seal ? 290 : 210) + i * (headSize + 4)))

  // Kennzahlen unten
  const colW = (w - 140) / 3
  d.stats.forEach((s, i) => {
    const sx = left + i * colW
    ctx.fillStyle = '#fff'
    fitFont(ctx, s.value, 800, 76, colW - 20)
    ctx.fillText(s.value, sx, y + h - 110)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = `700 26px ${FONT}`
    spaced(ctx, s.label.toUpperCase(), sx, y + h - 66, 2)
  })
  // Trennlinie über den Kennzahlen
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(left, y + h - 205, w - 140, 2)

  // Buddy ragt oben aus der Karte (mit weichem Schatten)
  if (buddy) {
    const size = 520
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 18
    ctx.drawImage(buddy, x + w - size + 10, oy + 0, size, size)
    ctx.restore()
  }

  // Goldenes Siegel, schräg auf der Kante
  if (d.seal) {
    const cx = x + 150
    const cy = y + 10
    const r = 92
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-0.21)
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    // gezackter Rand wie ein Siegel
    ctx.beginPath()
    const spikes = 22
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2
      const rr = i % 2 === 0 ? r : r - 9
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    ctx.closePath()
    ctx.fillStyle = goldColor()
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, r - 22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#3B2606'
    ctx.textAlign = 'center'
    ctx.font = `900 ${d.seal.value.length > 2 ? 52 : 66}px ${FONT}`
    ctx.fillText(d.seal.value, 0, 14)
    ctx.font = `800 21px ${FONT}`
    spaced(ctx, d.seal.label.toUpperCase(), 0, 44, 2)
    ctx.restore()
  }

  // Marke klein unten rechts in der Karte
  if (brand) {
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `700 22px ${FONT}`
    ctx.fillText(BRAND, x + w - 50, y + h - 24)
  }
}

// ---------------------------------------------------------------- Clean

function drawClean(ctx: CanvasRenderingContext2D, d: ShareContent, buddy: HTMLImageElement | null) {
  const W = 1080
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'

  let tx = 90
  if (buddy) {
    ctx.drawImage(silhouette(buddy, 130), 80, 52)
    tx = 236
  }
  fitFont(ctx, d.title, 800, 66, W - tx - 90)
  ctx.fillText(d.title, tx, 128)
  ctx.font = `500 38px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText(d.dateLabel, tx, 182)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillRect(90, 240, W - 180, 3)

  const colW = (W - 180) / 3
  ctx.textAlign = 'center'
  d.stats.forEach((s, i) => {
    const cx = 90 + colW * i + colW / 2
    ctx.fillStyle = '#fff'
    fitFont(ctx, s.value, 900, 104, colW - 24)
    ctx.fillText(s.value, cx, 380)
    ctx.font = `700 30px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    spaced(ctx, s.label.toUpperCase(), cx, 428, 3)
  })

  ctx.font = `600 30px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(d.record ? `Rekord: ${d.record} · ${BRAND}` : BRAND, W / 2, 520)
}

// ---------------------------------------------------------------- Einstieg

export async function renderShare(style: ShareStyle, d: ShareContent, buddy: HTMLImageElement | null): Promise<Blob> {
  let c: HTMLCanvasElement
  if (style === 'clean') {
    const [cv, ctx] = canvas(1080, 580)
    drawClean(ctx, d, buddy)
    c = cv
  } else if (style === 'card') {
    const [cv, ctx] = canvas(CARD_W, CARD_H)
    drawCard(ctx, d, buddy)
    c = cv
  } else {
    const W = 1080
    const H = 1920
    const [cv, ctx] = canvas(W, H)
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0B0F19')
    bg.addColorStop(1, '#141B2D')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 900)
    glow.addColorStop(0, accentColor('base', 0.35))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    grain(ctx, 0, 0, W, H, 0.05)
    drawCard(ctx, d, buddy, 0, (H - CARD_H) / 2 - 40, false)
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `600 34px ${FONT}`
    ctx.fillText(BRAND, W / 2, H - 120)
    c = cv
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b as Blob), 'image/png'))
}
