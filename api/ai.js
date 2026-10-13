// Sicherer KI-Vermittler (Vercel Serverless Function).
//
// Der API-Key liegt ausschließlich hier als Umgebungsvariable und wird nie an
// die App ausgeliefert. Provider und Modell sind per Env-Variable austauschbar:
//   AI_PROVIDER = 'gemini' (Standard) | 'groq'
//   GEMINI_API_KEY / GEMINI_MODEL   (Standard: gemini-flash-latest)
//   GROQ_API_KEY   / GROQ_MODEL     (Standard: llama-3.3-70b-versatile)
//
// GET  /api/ai            -> { enabled, provider, model }  (für die UI)
// POST /api/ai { system, prompt, json, temperature } -> { text }
//
// Schutz (api/_aiguard.js): nur angemeldete Nutzer, Größenlimits, feste
// Themen-Grenze (nur Fitness/Ernährung) und Limits pro Minute/Tag
// (Tabelle ai_calls, Migration 0036). Ohne Limit: AI_UNLIMITED_EMAILS (kommagetrennt).

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './_supabase.js'
import { envList, quotaError, sanitizeRequest } from './_aiguard.js'
const PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

// Modell-Liste: erst das (optional konfigurierte) Standardmodell, danach
// Ausweichmodelle. Bei Ueberlastung (503) des einen wird das naechste probiert.
// GEMINI_MODEL darf mehrere kommagetrennte Modelle enthalten.
const GEMINI_MODELS = Array.from(
  new Set(
    `${process.env.GEMINI_MODEL || 'gemini-3.6-flash'},gemini-flash-latest`
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  ),
)
const GEMINI_MODEL = GEMINI_MODELS[0]

// Vorübergehende Fehler, bei denen sich ein erneuter Versuch lohnt.
const TRANSIENT = new Set([429, 500, 502, 503, 504])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function activeKey() {
  return PROVIDER === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY
}
function activeModel() {
  return PROVIDER === 'groq' ? GROQ_MODEL : GEMINI_MODEL
}

function imagePart(image) {
  // image: Data-URL ("data:image/jpeg;base64,....") oder reines Base64
  const m = /^data:(.+?);base64,(.*)$/.exec(image)
  const mimeType = m ? m[1] : 'image/jpeg'
  const data = m ? m[2] : image
  return { inlineData: { mimeType, data } }
}

async function geminiOnce({ model, key, body, json }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${await res.text()}`)
    err.status = res.status
    throw err
  }
  const data = await res.json()
  const cand = data?.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  const reason = cand?.finishReason
  // Abgeschnittene/blockierte Antworten klar melden statt halbes JSON an die App zu geben.
  if (reason === 'MAX_TOKENS' && (json || !text.trim())) {
    throw userError('Die KI-Antwort war zu lang und wurde abgeschnitten — bitte nochmal versuchen.')
  }
  if (
    reason === 'SAFETY' ||
    reason === 'PROHIBITED_CONTENT' ||
    reason === 'BLOCKLIST' ||
    data?.promptFeedback?.blockReason
  ) {
    throw userError('Die KI hat die Anfrage aus Sicherheitsgründen abgelehnt. Bitte anders formulieren.')
  }
  if (!text.trim()) {
    throw userError('Die KI hat keine Antwort geliefert — bitte nochmal versuchen.')
  }
  return text
}

/** Fehler mit fertiger, nutzerfreundlicher Meldung (kein erneuter Versuch). */
function userError(message) {
  const err = new Error(message)
  err.status = 422
  err.userMessage = message
  return err
}

const THINKING_HEADROOM = 4096

async function callGemini({ system, prompt, json, temperature, image, images, maxTokens }) {
  const key = process.env.GEMINI_API_KEY
  const parts = [{ text: prompt }]
  if (image) parts.push(imagePart(image))
  // Mehrere Bilder (z. B. mehrseitige Speisekarte), höchstens 4
  if (Array.isArray(images))
    for (const img of images.slice(0, 4)) if (typeof img === 'string') parts.push(imagePart(img))
  // maxTokens ist das Budget für die eigentliche Antwort. Gemini zählt sein
  // internes „Denken" mit dazu — deshalb Puffer obendrauf und Denken auf „low"
  // begrenzen (spart Kosten; bezahlt wird nur, was wirklich verbraucht wird).
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: temperature ?? 0.4,
      ...(maxTokens ? { maxOutputTokens: maxTokens + THINKING_HEADROOM } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
      thinkingConfig: { thinkingLevel: 'low' },
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  }

  let lastErr
  // Pro Modell mehrere Versuche mit wachsender Wartezeit; bei anhaltender
  // Ueberlastung zum naechsten Modell wechseln.
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await geminiOnce({ model, key, body, json })
      } catch (e) {
        lastErr = e
        const s = e.status
        // Modell kennt thinkingLevel nicht (ältere Generation) → ohne Denk-Einstellung erneut
        if (s === 400 && body.generationConfig.thinkingConfig && /thinking/i.test(String(e.message))) {
          delete body.generationConfig.thinkingConfig
          attempt--
          continue
        }
        if (s === 400 || s === 401 || s === 403 || e.userMessage) throw e // echter Fehler (Key/Anfrage/Antwort) -> sofort melden
        if (s === 404) break // Modell gibt es nicht -> naechstes Modell probieren
        if (!TRANSIENT.has(s)) throw e
        if (attempt < 2) await sleep(500 * (attempt + 1)) // 0,5s / 1,0s
      }
    }
    // dieses Modell blieb ueberlastet -> naechstes probieren
  }
  throw lastErr
}

async function callGroq({ system, prompt, json, temperature }) {
  const key = process.env.GROQ_API_KEY
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: temperature ?? 0.4,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const choice = data?.choices?.[0]
  const text = choice?.message?.content ?? ''
  if (choice?.finish_reason === 'length' && (json || !text.trim())) {
    throw userError('Die KI-Antwort war zu lang und wurde abgeschnitten — bitte nochmal versuchen.')
  }
  if (!text.trim()) throw userError('Die KI hat keine Antwort geliefert — bitte nochmal versuchen.')
  return text
}

/**
 * Nur angemeldete Nutzer dürfen die KI nutzen (sonst könnte jeder das Kontingent verbrauchen).
 * Prüft das Supabase-Access-Token und liefert den Nutzer ({ id, email }) oder null.
 */
async function currentUser(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: auth },
    })
    if (!r.ok) return null
    const u = await r.json()
    return u?.id ? { id: u.id, email: String(u.email || '').toLowerCase() } : null
  } catch {
    return null
  }
}

/**
 * Limits pro Nutzer zählen und den Aufruf vermerken. Ohne Service-Role-Key oder
 * fehlende Tabelle wird nicht blockiert (nur geloggt), damit die KI nicht ausfällt.
 */
async function checkQuota(user) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  const unlimited = envList(process.env.AI_UNLIMITED_EMAILS).includes(user.email)
  try {
    const db = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
    const since = (ms) => new Date(Date.now() - ms).toISOString()
    const count = async (ms) => {
      const { count: n, error } = await db
        .from('ai_calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('at', since(ms))
      if (error) throw error
      return n || 0
    }
    if (!unlimited) {
      const [lastMinute, today] = await Promise.all([count(60_000), count(86_400_000)])
      const err = quotaError({ lastMinute, today, unlimited })
      if (err) return err
    }
    await db.from('ai_calls').insert({ user_id: user.id })
  } catch (e) {
    console.error('ai quota', e?.message)
  }
  return null
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ enabled: Boolean(activeKey()), provider: PROVIDER, model: activeModel() })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Bitte neu anmelden, um die KI zu nutzen.' })
    return
  }

  if (!activeKey()) {
    res.status(503).json({ error: 'KI nicht konfiguriert (API-Key fehlt).' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const checked = sanitizeRequest(body)
    if (checked.error) {
      res.status(400).json({ error: checked.error })
      return
    }
    const { system, prompt, json, temperature, image, images, maxTokens } = checked.req
    const limited = await checkQuota(user)
    if (limited) {
      res.status(429).json({ error: limited })
      return
    }
    if ((image || images) && PROVIDER === 'groq') {
      res.status(400).json({ error: 'Bild-Analyse wird von diesem Provider nicht unterstützt (Gemini nutzen).' })
      return
    }
    const text =
      PROVIDER === 'groq'
        ? await callGroq({ system, prompt, json, temperature })
        : await callGemini({ system, prompt, json, temperature, image, images, maxTokens })
    res.status(200).json({ text })
  } catch (err) {
    if (err?.userMessage) {
      res.status(502).json({ error: err.userMessage })
      return
    }
    const msg = err instanceof Error ? err.message : 'KI-Fehler'
    // Ueberlastung freundlich melden statt roher API-Fehler.
    if (err?.status === 503 || err?.status === 429 || /UNAVAILABLE|overloaded|high demand/i.test(msg)) {
      res.status(503).json({
        error: 'Die KI ist gerade stark ausgelastet. Bitte in ein paar Sekunden nochmal versuchen.',
      })
      return
    }
    res.status(500).json({ error: msg })
  }
}
