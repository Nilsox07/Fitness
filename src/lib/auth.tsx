import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearUserData, getLastUserId, setLastUserId } from './userData'

/**
 * Daten des vorherigen Kontos verwerfen: beim Abmelden und wenn sich ein
 * anderer Nutzer anmeldet (Vergleich mit der zuletzt gemerkten User-ID).
 * Läuft synchron VOR `setSession`, damit nie fremde Daten gerendert werden.
 */
function handleUserChange(event: string | null, s: Session | null) {
  if (event === 'SIGNED_OUT') {
    clearUserData()
    setLastUserId(null)
    return
  }
  const id = s?.user?.id
  if (!id) return
  const last = getLastUserId()
  if (last && last !== id) clearUserData()
  if (last !== id) setLastUserId(id)
}

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  recovery: boolean
  clearRecovery: () => void
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  recovery: false,
  clearRecovery: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleUserChange(null, data.session)
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      handleUserChange(event, s)
      setSession(s)
      // Klick auf den Passwort-Reset-Link → in den „neues Passwort setzen"-Modus
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recovery,
        clearRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
