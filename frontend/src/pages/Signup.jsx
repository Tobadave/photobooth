import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'

export default function Signup() {
  const { signup, user, completeSignup } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState(signup?.name || '')
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | ok | taken | invalid
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // debounce username availability check
  useEffect(() => {
    const u = username.trim().toLowerCase()
    if (!u) return setStatus('idle')
    setStatus('checking')
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/auth/username-available?username=${encodeURIComponent(u)}`)
        setStatus(!r.valid ? 'invalid' : r.available ? 'ok' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 350)
    return () => clearTimeout(t)
  }, [username])

  if (user) return <Navigate to="/" replace />
  if (!signup) return <Navigate to="/login" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await completeSignup({ name, username })
      nav('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const hint = {
    idle: '3–20 characters: letters, numbers, underscore.',
    checking: 'Checking…',
    ok: 'Available.',
    taken: 'Already taken.',
    invalid: 'Use 3–20 characters: a-z, 0-9, underscore.',
  }[status]

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-5 py-10">
      <div className="flex items-center gap-3">
        <Avatar user={{ name, avatar: signup.picture }} size={48} />
        <div>
          <h1 className="text-2xl font-extrabold">Finish your profile</h1>
          <p className="text-sm text-mute">{signup.email}</p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          className="mt-1 w-full border border-line bg-card px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Username</span>
        <div className="mt-1 flex border border-line bg-card">
          <span className="px-3 py-2 text-mute">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={20}
            required
            className="w-full bg-transparent py-2 pr-3 outline-none"
          />
        </div>
        <span className={`text-sm ${status === 'taken' || status === 'invalid' ? 'text-flash' : 'text-mute'}`}>
          {hint}
        </span>
      </label>

      {error && <p className="text-sm text-flash">{error}</p>}

      <button
        disabled={busy || status !== 'ok' || !name.trim()}
        className="w-full bg-ink py-2.5 font-medium text-paper disabled:opacity-40"
      >
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
