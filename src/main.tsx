import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { PrefsProvider } from './lib/prefs'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 2,
    },
    mutations: {
      // Schreibvorgänge (Sätze anlegen/ändern) bei schwachem Netz mehrfach
      // wiederholen, statt sie sofort zu verwerfen. networkMode 'online'
      // pausiert sie zudem, solange offline, und setzt sie fort, sobald wieder
      // Verbindung besteht — so gehen Sätze im Gym nicht mehr verloren.
      retry: 5,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20000),
      networkMode: 'online',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrefsProvider>
        <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        </AuthProvider>
        </PrefsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
