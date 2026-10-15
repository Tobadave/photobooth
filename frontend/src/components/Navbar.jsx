import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Avatar from './Avatar'

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [code, setCode] = useState('')

  const openById = (e) => {
    e.preventDefault()
    const id = code.trim().toUpperCase()
    if (id) {
      nav(`/a/${id}`)
      setCode('')
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-full bg-flash" aria-hidden />
          PhotoShoot
        </Link>

        <form onSubmit={openById} className="ml-auto flex">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Have an album ID?"
            aria-label="Album ID"
            className="w-36 rounded-l-md border border-line bg-card px-3 py-1.5 text-sm sm:w-48"
          />
          <button className="rounded-r-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">
            Open album
          </button>
        </form>

        {user ? (
          <>
            <Link to={`/u/${user.username}`} aria-label="Your public profile">
              <Avatar user={user} size={32} />
            </Link>
            <button onClick={logout} className="text-sm text-mute hover:text-ink">
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" className="text-sm font-medium">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
