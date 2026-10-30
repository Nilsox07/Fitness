// CORS für die Android-App: Die WebView läuft unter https://localhost und ruft
// die API über die volle Vercel-Adresse auf. Nur die App-Ursprünge sind erlaubt.
const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost', 'http://localhost'])

/** Setzt CORS-Header; beantwortet Preflight (OPTIONS) direkt. true = Anfrage ist erledigt. */
export function cors(req, res) {
  const origin = req.headers.origin
  if (origin && APP_ORIGINS.has(origin)) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'origin')
    res.setHeader('access-control-allow-headers', 'authorization, content-type')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-max-age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
