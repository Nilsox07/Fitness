// GET /api/season[?month=YYYY-MM] -> Saison-Thema des Monats (für alle gleich).
// Beim ersten Abruf eines Monats denkt sich die KI das Thema aus; es wird in
// season_themes gespeichert (Migration 0033), damit alle dasselbe sehen. Ohne KI
// oder Tabelle gibt es ein festes Ersatz-Thema.

import { admin } from './_fitbit.js'
import { FALLBACK_THEMES, normalizeTheme, seasonPrompt } from './_season.js'

const MODELS = Array.from(
  new Set(
    `${process.env.GEMINI_MODEL || 'gemini-3.6-flash'},gemini-flash-latest`
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  ),
)

function berlinMonth(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(
    now,
  )
  return p.slice(0, 7)
}

async function generate(month) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const body = {
    contents: [{ role: 'user', parts: [{ text: seasonPrompt(month) }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json', maxOutputTokens: 4096 },
  }
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!r.ok) continue
      const data = await r.json()
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      const json = JSON.parse(text.replace(/```(?:json)?/g, '').trim())
      return normalizeTheme(json, month)
    } catch {
      /* nächstes Modell */
    }
  }
  return null
}

export default async function handler(req, res) {
  const q = String(req.query?.month || '')
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : berlinMonth()
  res.setHeader('cache-control', 'public, max-age=600, s-maxage=3600')

  let db = null
  try {
    db = admin()
  } catch {
    db = null
  }

  if (db) {
    const { data, error } = await db.from('season_themes').select('data').eq('id', month).maybeSingle()
    if (!error && data?.data) {
      res.status(200).json(normalizeTheme(data.data, month))
      return
    }
    // Nur den aktuellen oder nächsten Monat neu erfinden (keine Rückwirkung)
    if (!error && month >= berlinMonth()) {
      const theme = await generate(month)
      if (theme) {
        await db.from('season_themes').upsert({ id: month, data: theme }, { onConflict: 'id', ignoreDuplicates: true })
        const { data: saved } = await db.from('season_themes').select('data').eq('id', month).maybeSingle()
        res.status(200).json(normalizeTheme(saved?.data ?? theme, month))
        return
      }
    }
  }
  const fb = FALLBACK_THEMES[Number(month.slice(5, 7)) - 1]
  res.status(200).json(normalizeTheme(fb, month))
}
