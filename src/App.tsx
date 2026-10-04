import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
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
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import QuickWorkout from './pages/QuickWorkout'
import { Splash } from './components/Splash'

// Welche Route zu welcher Welt gehört (geteilte Seiten lassen die Welt, wie sie ist).
const FOOD_ROUTES = ['/nutrition', '/recipes', '/shopping']
const FITNESS_ROUTES = ['/', '/plans', '/exercises']

export default function App() {
  const { session, loading, recovery } = useAuth()
  const { isNew, world, setWorld, showNutrition } = usePrefs()
  const { pathname, search } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Gescrollt wird in <main>, nicht im Fenster → beim Seitenwechsel (auch
  // Profil-Unterseiten per ?s=…) wieder oben anfangen.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [pathname, search])

  // Top-Umschalter mit der aktuellen Seite synchron halten.
  useEffect(() => {
    if (!isNew) return
    if (FOOD_ROUTES.includes(pathname) && world !== 'food') setWorld('food')
    else if (FITNESS_ROUTES.includes(pathname) && world !== 'fitness') setWorld('fitness')
  }, [pathname, isNew, world, setWorld])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-cocoa-light">Lädt…</div>
  }

  if (recovery) {
    return <ResetPassword />
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <AiActivityBar />
      <SaveStatus />
      {isNew && <TopBar />}
      <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4">
        <Routes>
          <Route path="/" element={<Workout />} />
          <Route path="/nutrition" element={showNutrition ? <Nutrition /> : <Navigate to="/" replace />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/social" element={<Social />} />
          <Route path="/badges" element={<Badges />} />
          <Route path="/recipes" element={showNutrition ? <Recipes /> : <Navigate to="/" replace />} />
          <Route path="/shopping" element={showNutrition ? <Shopping /> : <Navigate to="/" replace />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/quick" element={isNew ? <QuickWorkout /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {isNew && <Assistant />}
      {isNew && <BuddyMomentHost />}
      {isNew && <WhatsNew />}
      {isNew && <WeeklyReview />}
      {isNew && <Splash />}
      <TabBar />
    </div>
  )
}
