import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True, wenn die App korrekt mit Supabase-Zugangsdaten konfiguriert ist.
 * Wird genutzt, um vor dem Login einen hilfreichen Hinweis anzuzeigen, falls
 * die .env noch fehlt.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
)
