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

const PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

function activeKey() {
  return PROVIDER === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY
}
function activeModel() {
  return PROVIDER === 'groq' ? GROQ_MODEL : GEMINI_MODEL
}

async function callGemini({ system, prompt, json, temperature }) {
  const key = process.env.GEMINI_API_KEY
  const model = GEMINI_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: temperature ?? 0.4,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  return text
}

async function callGroq({ system, prompt, json, temperature }) {
  const key = process.env.GROQ_API_KEY
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: temperature ?? 0.4,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
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
  if (!activeKey()) {
    res.status(503).json({ error: 'KI nicht konfiguriert (API-Key fehlt).' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { system, prompt, json, temperature } = body
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt fehlt' })
      return
    }
    const text =
      PROVIDER === 'groq'
        ? await callGroq({ system, prompt, json, temperature })
        : await callGemini({ system, prompt, json, temperature })
    res.status(200).json({ text })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'KI-Fehler' })
  }
}
