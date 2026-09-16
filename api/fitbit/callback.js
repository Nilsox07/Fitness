// OAuth-Rückleitung von Fitbit: Code gegen Tokens tauschen und speichern.
import { admin, userFromToken } from '../_fitbit.js'

export default async function handler(req, res) {
  const base = `https://${req.headers.host}`
  const { code, state, error } = req.query
  if (error || !code || !state) return res.redirect(`${base}/profile?fitbit=error`)

  const user = await userFromToken(String(state))
  if (!user) return res.redirect(`${base}/profile?fitbit=error`)

  const redirect_uri = `${base}/api/fitbit/callback`
  const basic = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
  ).toString('base64')
  const r = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri,
    }),
  })
  const tok = await r.json()
  if (!tok.access_token) return res.redirect(`${base}/profile?fitbit=error`)

  await admin()
    .from('fitbit_tokens')
    .upsert({
      user_id: user.id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      scope: tok.scope,
      updated_at: new Date().toISOString(),
    })

  res.redirect(`${base}/profile?fitbit=connected`)
}
