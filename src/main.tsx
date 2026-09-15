import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { PrefsProvider } from './lib/prefs'
import { registerMutationDefaults } from './lib/mutationDefaults'
import './index.css'

const queryClient = new QueryClient({
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

// Wiederaufnehmbare Schreibvorgänge registrieren, BEVOR der persistierte Cache
// eingespielt wird — sonst könnten pausierte Mutationen nach Reload keine
// mutationFn finden.
registerMutationDefaults(queryClient)

// Cache (inkl. offline-pausierter Schreibvorgänge) auf der Platte sichern, damit
// im Gym erfasste Sätze auch einen App-Neustart überstehen.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'fitness-rq-cache',
  throttleTime: 500,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 14, // 14 Tage
        buster: 'v1',
        dehydrateOptions: {
          // Pausierte (offline) Mutationen mitsichern, damit sie fortgesetzt werden.
          shouldDehydrateMutation: (m) => m.state.isPaused,
        },
      }}
      onSuccess={() => {
        // Nach dem Wiederherstellen die offline gepufferten Schreibvorgänge senden.
        queryClient.resumePausedMutations()
      }}
    >
      <ThemeProvider>
        <PrefsProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </PrefsProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
