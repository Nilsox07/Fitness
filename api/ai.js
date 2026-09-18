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

async function geminiOnce({ model, key, body }) {
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
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
}

async function callGemini({ system, prompt, json, temperature, image, maxTokens }) {
  const key = process.env.GEMINI_API_KEY
  const parts = [{ text: prompt }]
  if (image) parts.push(imagePart(image))
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: temperature ?? 0.4,
      ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  }

  let lastErr
  // Pro Modell mehrere Versuche mit wachsender Wartezeit; bei anhaltender
  // Ueberlastung zum naechsten Modell wechseln.
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await geminiOnce({ model, key, body })
      } catch (e) {
        lastErr = e
        const s = e.status
        if (s === 400 || s === 401 || s === 403) throw e // echter Fehler (Key/Anfrage) -> sofort melden
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
    const { system, prompt, json, temperature, image, maxTokens } = body
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt fehlt' })
      return
    }
    if (image && PROVIDER === 'groq') {
      res.status(400).json({ error: 'Bild-Analyse wird von diesem Provider nicht unterstützt (Gemini nutzen).' })
      return
    }
    const text =
      PROVIDER === 'groq'
        ? await callGroq({ system, prompt, json, temperature })
        : await callGemini({ system, prompt, json, temperature, image, maxTokens })
    res.status(200).json({ text })
  } catch (err) {
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
