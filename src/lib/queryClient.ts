import { QueryClient } from '@tanstack/react-query'

/** localStorage-Schlüssel des persistierten Query-Caches (inkl. pausierter Mutationen). */
export const PERSIST_KEY = 'fitness-rq-cache'

/**
 * Der eine QueryClient der App. Eigenes Modul, damit auch Nicht-Komponenten
 * (z. B. Abmelden/Kontowechsel in `auth.tsx`) den Cache leeren können, ohne
 * `main.tsx` zu importieren (sonst zirkuläre Imports).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 2,
    },
    mutations: {
      // Schreibvorgänge bei schwachem Netz mehrfach wiederholen; networkMode
      // 'online' pausiert sie offline und setzt sie fort, sobald wieder
      // Verbindung besteht.
      retry: 5,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20000),
      networkMode: 'online',
    },
  },
})
