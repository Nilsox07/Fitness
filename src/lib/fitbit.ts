import { supabase } from './supabase'

export const fitbitClientId = import.meta.env.VITE_FITBIT_CLIENT_ID as string | undefined

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('Nicht angemeldet')
  return t
}

/** Fitbit-Login starten (leitet zum Fitbit-OAuth). */
export async function connectFitbit(): Promise<void> {
  if (!fitbitClientId) throw new Error('Fitbit ist nicht konfiguriert.')
  const token = await accessToken()
  const redirect = `${location.origin}/api/fitbit/callback`
  const scope = 'weight activity heartrate profile'
  const url =
    'https://www.fitbit.com/oauth2/authorize?response_type=code' +
    `&client_id=${fitbitClientId}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&state=${encodeURIComponent(token)}` +
    '&expires_in=604800'
  location.href = url
}

export interface FitbitStatus {
  connected: boolean
  configured: boolean
}

export async function fitbitStatus(): Promise<FitbitStatus> {
  try {
    const r = await fetch('/api/fitbit/status', {
      headers: { authorization: `Bearer ${await accessToken()}` },
    })
    if (!r.ok) return { connected: false, configured: false }
    return (await r.json()) as FitbitStatus
  } catch {
    return { connected: false, configured: false }
  }
}

export interface FitbitSync {
  steps: number | null
  caloriesOut: number | null
  restingHr: number | null
  weight: number | null
  importedWeights: number
}

export async function fitbitSync(): Promise<FitbitSync> {
  const r = await fetch('/api/fitbit/sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}` },
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || 'Sync fehlgeschlagen')
  }
  return (await r.json()) as FitbitSync
}
