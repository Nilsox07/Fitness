import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { PrefsProvider } from './lib/prefs'
import { registerMutationDefaults } from './lib/mutationDefaults'
import { applyAccent, getAccentId } from './lib/cosmetics'
import { PERSIST_KEY, queryClient } from './lib/queryClient'
import './index.css'

// Freigeschaltete Akzentfarbe anwenden, bevor die App rendert.
applyAccent(getAccentId())

// Wenn ein neuer Service Worker die Kontrolle übernimmt (nach einem Update),
// die Seite EINMAL neu laden. So landet man nie in einem halb aktualisierten
// Zustand (neues HTML, aber altes/fehlendes CSS → „nur HTML").
// - Erstinstallation (vorher kein Controller): kein Reload nötig — die Seite
//   kam gerade frisch vom Netz.
// - Nicht mitten in der Benutzung neu laden (z. B. während eines Trainings):
//   das Update wird vorgemerkt und erst angewendet, sobald die App in den
//   Hintergrund geht (visibilitychange → hidden).
if ('serviceWorker' in navigator) {
  let hasController = Boolean(navigator.serviceWorker.controller)
  let updateReady = false
  let reloaded = false
  const tryReload = () => {
    if (reloaded || !updateReady || document.visibilityState !== 'hidden') return
    // Laufende Schreibvorgänge nicht abwürgen — beim nächsten Verstecken erneut.
    if (queryClient.isMutating() > 0) return
    reloaded = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true
      return
    }
    updateReady = true
    setTimeout(tryReload, 700)
  })
  document.addEventListener('visibilitychange', () => {
    // Kurz warten, damit der (gedrosselte) Cache-Persister noch schreiben kann.
    if (updateReady && document.visibilityState === 'hidden') setTimeout(tryReload, 700)
  })
}

// Wiederaufnehmbare Schreibvorgänge registrieren, BEVOR der persistierte Cache
// eingespielt wird — sonst könnten pausierte Mutationen nach Reload keine
// mutationFn finden.
registerMutationDefaults(queryClient)

// Cache (inkl. offline-pausierter Schreibvorgänge) auf der Platte sichern, damit
// im Gym erfasste Sätze auch einen App-Neustart überstehen.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_KEY,
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
