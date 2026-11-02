import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { isWorkoutRunning } from './lib/activeWorkout'
import { useAuth } from './lib/auth'
import { historyIndex, recordNav } from './lib/navHistory'
import { launchRoute, recentDeepLink } from './lib/deepLink'
import { usePrefs } from './lib/prefs'
import { TabBar } from './components/TabBar'
import { TopBar } from './components/TopBar'
import { SaveStatus } from './components/SaveStatus'
import { AiActivityBar } from './components/AiActivityBar'
import { Assistant } from './components/Assistant'
import { BuddyMomentHost } from './components/buddy/BuddyMomentHost'
import { WhatsNew } from './components/WhatsNew'
import { WeeklyReview } from './components/WeeklyReview'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Workout from './pages/Workout'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import Plans from './pages/Plans'
import Social from './pages/Social'
import Badges from './pages/Badges'
import Recipes from './pages/Recipes'
import Shopping from './pages/Shopping'
import Feed from './pages/Feed'
import History from './pages/History'
import Analytics from './pages/Analytics'
import Progress from './pages/Progress'
import Cycle from './pages/Cycle'
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import QuickWorkout from './pages/QuickWorkout'
import Body from './pages/Body'
import Today from './pages/Today'
import Cardio from './pages/Cardio'
import Sleep from './pages/Sleep'
import Vitals from './pages/Vitals'
import Insights from './pages/Insights'
import ActivityDetail from './pages/ActivityDetail'
import { NativeNav, NativeSync } from './components/NativeSync'
import { SearchHost } from './components/search/SearchSheet'
import { Splash } from './components/Splash'
import { FloatingBuddy } from './components/buddy/FloatingBuddy'
import { OnboardingHost } from './components/onboarding/Onboarding'
import { ConsentGate } from './components/privacy/ConsentGate'
import Privacy from './pages/Privacy'
import { useChallengeSync } from './hooks/useChallenges'
import { useModulesSync } from './hooks/useModulesSync'

/** Module zusätzlich im Konto ablegen (Server-Erinnerungen richten sich danach). */
function ModulesSync() {
  useModulesSync()
  return null
}

/** Eigenen Stand in laufenden Wetten im Hintergrund aktuell halten. */
function ChallengeSync() {
  useChallengeSync()
  return null
}

// Welche Route zu welcher Welt gehört (geteilte Seiten lassen die Welt, wie sie ist).
const FOOD_ROUTES = ['/nutrition', '/recipes', '/shopping']
const FITNESS_ROUTES = ['/', '/plans', '/exercises']

export default function App() {
  const { session, loading, recovery } = useAuth()
  const { world, setWorld, showNutrition, showSocial, hasWatch, hasCycle } = usePrefs()
  const { pathname, search } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Gescrollt wird in <main>, nicht im Fenster → beim Seitenwechsel (auch
  // Profil-Unterseiten per ?s=…) wieder oben anfangen.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [pathname, search])

  // Verlauf merken, damit „Zurück“ dorthin führt, wo man herkam
  useEffect(() => {
    recordNav(historyIndex(), { pathname, search })
  }, [pathname, search])

  // Startbereich: „Heute“ (persönliches Dashboard), außer es läuft gerade ein
  // Training. Gilt beim Start und wenn die App nach längerer Pause (30 min)
  // wieder in den Vordergrund kommt.
  const navigate = useNavigate()
  const startChecked = useRef(false)
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  useEffect(() => {
    if (!session) return
    // Nicht, wenn die App gerade über einen Deep Link (Widget, Benachrichtigung) geöffnet wurde
    const goHome = () => {
      if (pathRef.current === '/' && !isWorkoutRunning() && !recentDeepLink()) navigate('/today', { replace: true })
    }
    if (!startChecked.current) {
      startChecked.current = true
      void launchRoute().then((route) => {
        if (!route) goHome()
      })
    }
    let hiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) goHome()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [session, navigate])

  // Top-Umschalter mit der aktuellen Seite synchron halten.
  useEffect(() => {
    if (FOOD_ROUTES.includes(pathname) && world !== 'food') setWorld('food')
    else if (FITNESS_ROUTES.includes(pathname) && world !== 'fitness') setWorld('fitness')
  }, [pathname, world, setWorld])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-cocoa-light">Lädt…</div>
  }

  if (recovery) {
    return <ResetPassword />
  }

  if (!session) {
    // Datenschutzerklärung auch ohne Anmeldung (Play Store, Health Connect)
    return pathname === '/datenschutz' ? <Privacy standalone /> : <Login />
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <AiActivityBar />
      <SaveStatus />
      <TopBar />
      {showSocial && <ChallengeSync />}
      <ModulesSync />
      <NativeSync />
      <NativeNav />
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4"
      >
        <div key={pathname} className="anim-page">
          <Routes>
            <Route path="/" element={<Workout />} />
            <Route path="/today" element={<Today />} />
            <Route path="/cardio" element={hasWatch ? <Cardio /> : <Navigate to="/progress" replace />} />
            <Route path="/cardio/:id" element={hasWatch ? <ActivityDetail /> : <Navigate to="/progress" replace />} />
            <Route path="/sleep" element={hasWatch ? <Sleep /> : <Navigate to="/progress" replace />} />
            <Route path="/vitals" element={hasWatch ? <Vitals /> : <Navigate to="/progress" replace />} />
            <Route path="/nutrition" element={showNutrition ? <Nutrition /> : <Navigate to="/" replace />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/exercises/:id" element={<ExerciseDetail />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/social" element={showSocial ? <Social /> : <Navigate to="/today" replace />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/recipes" element={showNutrition ? <Recipes /> : <Navigate to="/" replace />} />
            <Route path="/shopping" element={showNutrition ? <Shopping /> : <Navigate to="/" replace />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/history" element={<History />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/cycle" element={hasCycle ? <Cycle /> : <Navigate to="/progress" replace />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/body" element={<Body />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/quick" element={<QuickWorkout />} />
            <Route path="/share" element={<ShareTarget />} />
            <Route path="/datenschutz" element={<Privacy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Assistant />
      <SearchHost />
      <BuddyMomentHost />
      <FloatingBuddy />
      <WhatsNew />
      <WeeklyReview />
      <Splash />
      <OnboardingHost />
      <ConsentGate />
      <TabBar />
    </div>
  )
}

/** Ziel des Teilen-Menüs (Android): geteilten Link/Text an den Rezept-Import geben. */
function ShareTarget() {
  const [params] = useSearchParams()
  const shared = [params.get('title'), params.get('text'), params.get('url')]
    .filter((v): v is string => !!v && !!v.trim())
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('\n')
  return <Navigate to={shared ? `/recipes?import=${encodeURIComponent(shared)}` : '/recipes'} replace />
}
