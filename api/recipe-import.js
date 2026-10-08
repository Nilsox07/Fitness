// Holt zu einem geteilten Link (TikTok, Instagram, YouTube, Pinterest, Rezeptseiten)
// Bildunterschrift, Titel, Vorschaubild und – falls vorhanden – strukturierte
// Rezeptdaten (schema.org/Recipe). Die eigentliche Rezept-Erkennung macht danach
// die KI im Browser über /api/ai.
//
// POST /api/recipe-import { url } -> { source, url, title, caption, author, image, recipe }
import { userFromAuth } from './_fitbit.js'

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const MAX_IMAGE_BYTES = 1_500_000

function sourceOf(host) {
  if (/tiktok\.com$/.test(host)) return 'TikTok'
  if (/instagram\.com$/.test(host)) return 'Instagram'
  if (/(youtube\.com|youtu\.be)$/.test(host)) return 'YouTube'
  if (/pinterest\.[a-z.]+$|pin\.it$/.test(host)) return 'Pinterest'
  if (/facebook\.com$|fb\.watch$/.test(host)) return 'Facebook'
  return host.replace(/^www\./, '')
}

/** Nur öffentliche http(s)-Adressen – keine internen Hosts oder IP-Literale. */
function safeUrl(raw) {
  let u
  try {
    u = new URL(String(raw).trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const h = u.hostname
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal)$/.test(h)) return null
  return u
}

async function get(url, accept = 'text/html') {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    return await fetch(url, {
      headers: { 'user-agent': UA, accept, 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

function decode(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')
  const tag = re.exec(html)?.[0]
  if (!tag) return ''
  return decode(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '')
}

/** schema.org/Recipe aus JSON-LD (Rezeptseiten wie Chefkoch, Lecker, Blogs). */
function jsonLdRecipe(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []
  for (const b of blocks) {
    try {
      const data = JSON.parse(b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''))
      const items = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] || [])].flat()
      const r = items.find((x) => x && [].concat(x['@type']).includes('Recipe'))
      if (!r) continue
      const steps = []
      for (const s of [].concat(r.recipeInstructions || [])) {
        if (typeof s === 'string') steps.push(s)
        else if (s?.itemListElement) for (const x of s.itemListElement) steps.push(x.text || x.name || '')
        else if (s?.text) steps.push(s.text)
      }
      return {
        name: decode(r.name || ''),
        yield: decode([].concat(r.recipeYield || [])[0] || ''),
        ingredients: [].concat(r.recipeIngredient || []).map(decode).slice(0, 40),
        steps: steps.map(decode).filter(Boolean).slice(0, 20),
        nutrition: r.nutrition || null,
      }
    } catch {
      /* kaputtes JSON-LD ignorieren */
    }
  }
  return null
}

async function imageAsDataUrl(src) {
  const u = safeUrl(src)
  if (!u) return null
  try {
    const r = await get(u.href, 'image/*')
    if (!r.ok) return null
    const type = r.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_IMAGE_BYTES) return null
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  try {
    await importHandler(req, res)
  } catch (e) {
    res.status(500).json({ error: `Link konnte nicht geladen werden (${e?.message || 'Serverfehler'}).` })
  }
}

async function importHandler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method' })
    return
  }
  const user = await userFromAuth(req)
  if (!user) {
    res.status(401).json({ error: 'Bitte anmelden.' })
    return
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const u = safeUrl(body.url)
  if (!u) {
    res.status(400).json({ error: 'Das ist kein gültiger Link.' })
    return
  }

  const out = { source: sourceOf(u.hostname), url: u.href, title: '', caption: '', author: '', image: null, recipe: null }
  let thumb = ''

  try {
    // TikTok und YouTube haben offene oEmbed-Schnittstellen mit der Bildunterschrift bzw. dem Titel.
    if (out.source === 'TikTok' || out.source === 'YouTube') {
      const api =
        out.source === 'TikTok'
          ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(u.href)}`
          : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.href)}`
      const r = await get(api, 'application/json')
      if (r.ok) {
        const o = await r.json()
        out.caption = decode(o.title || '')
        out.author = decode(o.author_name || '')
        thumb = o.thumbnail_url || ''
      }
    }

    // Seite selbst: Open-Graph-Texte, Vorschaubild, ggf. strukturiertes Rezept.
    const page = await get(u.href)
    if (page.ok && (page.headers.get('content-type') || '').includes('html')) {
      const html = (await page.text()).slice(0, 2_000_000)
      out.title = meta(html, 'og:title') || decode(/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '')
      const desc = meta(html, 'og:description') || meta(html, 'description')
      if (desc && desc.length > out.caption.length) out.caption = desc
      thumb = thumb || meta(html, 'og:image')
      out.recipe = jsonLdRecipe(html)
    }
  } catch {
    /* Netzwerkfehler → mit dem weitermachen, was da ist */
  }

  // Vorschaubild hilft der KI, wenn im Text kaum etwas steht.
  if (thumb && !out.recipe && out.caption.length < 400) out.image = await imageAsDataUrl(thumb)

  res.status(200).json(out)
}
