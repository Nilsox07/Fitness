import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { TabBar } from './components/TabBar'
import Login from './pages/Login'
import Workout from './pages/Workout'
import Exercises from './pages/Exercises'
import History from './pages/History'
import Analytics from './pages/Analytics'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">Lädt…</div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<Workout />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
