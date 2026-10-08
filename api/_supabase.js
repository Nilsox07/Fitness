// Öffentliche Supabase-Verbindung (dieselben Werte wie .env.production der App –
// Adresse und anon-Key sind öffentlich und stecken ohnehin im App-Bundle).
// In Vercel gesetzte Variablen haben Vorrang. Der geheime Service-Role-Key
// kommt NUR aus Vercel (SUPABASE_SERVICE_ROLE_KEY), nie aus dem Code.
export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://tgoldugmypyefawqvzky.supabase.co'
export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2xkdWdteXB5ZWZhd3F2emt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzE3NjgsImV4cCI6MjA5NzM0Nzc2OH0.qjN8mWV2L8EwYfY2JcKcIqOMsmA2Uo0xvgs0z0UvkNc'
