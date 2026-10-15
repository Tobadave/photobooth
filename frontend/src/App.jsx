import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import AlbumPage from './pages/AlbumPage'
import ProfilePage from './pages/ProfilePage'

function Home() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <Navigate to="/login" replace />
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <p className="p-10 text-mute">Loading…</p>

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/a/:id" element={<AlbumPage />} />
          <Route path="*" element={<p className="text-mute">Page not found.</p>} />
        </Routes>
      </main>
    </>
  )
}
