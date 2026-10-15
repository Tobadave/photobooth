import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'
import AlbumCard from '../components/AlbumCard'

function ProfileEditor({ user, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: user.name, username: user.username, bio: user.bio || '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    try {
      const { user: u } = await api.patch('/me', form)
      onSaved(u)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 border border-line bg-card p-4">
      <input value={form.name} onChange={set('name')} placeholder="Name" className="w-full border border-line px-3 py-2" />
      <input value={form.username} onChange={set('username')} placeholder="username" className="w-full border border-line px-3 py-2" />
      <textarea value={form.bio} onChange={set('bio')} placeholder="Short bio" rows={3} maxLength={300} className="w-full border border-line px-3 py-2" />
      {error && <p className="text-sm text-flash">{error}</p>}
      <div className="flex gap-2">
        <button className="bg-ink px-4 py-2 text-sm font-medium text-paper">Save profile</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-mute">Cancel</button>
      </div>
    </form>
  )
}

function NewAlbum({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', visibility: 'public' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (e) => {
    e.preventDefault()
    try {
      const { album } = await api.post('/albums', form)
      onCreated(album)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={create} className="grid gap-3 border border-line bg-card p-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        <input value={form.title} onChange={set('title')} placeholder="Album title" required maxLength={80} className="w-full border border-line px-3 py-2" />
        <input value={form.description} onChange={set('description')} placeholder="Description (optional)" className="w-full border border-line px-3 py-2" />
        {error && <p className="text-sm text-flash">{error}</p>}
      </div>
      <div className="flex flex-col gap-3">
        <select value={form.visibility} onChange={set('visibility')} className="border border-line px-3 py-2">
          <option value="public">Public: anyone can view</option>
          <option value="private">Private: ID + approval</option>
        </select>
        <button className="bg-ink px-4 py-2 font-medium text-paper">Create album</button>
      </div>
    </form>
  )
}

function RequestRow({ r, onRespond }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line py-3">
      <Avatar user={r.requester} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <Link to={`/u/${r.requester.username}`} className="font-bold">@{r.requester.username}</Link>{' '}
          wants to view <Link to={`/a/${r.album.id}`} className="underline">{r.album.title}</Link>
        </p>
        <p className="text-xs text-mute">{new Date(r.created_at).toLocaleString()}</p>
      </div>
      {r.status === 'pending' ? (
        <div className="flex gap-2">
          <button onClick={() => onRespond(r.id, 'accept')} className="bg-ink px-3 py-1.5 text-sm font-medium text-paper">Accept</button>
          <button onClick={() => onRespond(r.id, 'decline')} className="border border-line px-3 py-1.5 text-sm">Decline</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <span className={r.status === 'accepted' ? 'font-medium' : 'text-mute'}>
            {r.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
          {r.status === 'accepted' ? (
            <button onClick={() => onRespond(r.id, 'decline')} className="text-flash">Revoke</button>
          ) : (
            <button onClick={() => onRespond(r.id, 'accept')} className="underline">Accept instead</button>
          )}
        </div>
      )}
    </li>
  )
}

export default function Dashboard() {
  const { user, setUser } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('albums')
  const [albums, setAlbums] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const [a, i, o] = await Promise.all([
      api.get('/my/albums'),
      api.get('/requests/incoming'),
      api.get('/requests/outgoing'),
    ])
    setAlbums(a.albums)
    setIncoming(i.requests)
    setOutgoing(o.requests)
  }
  useEffect(() => { load() }, [])

  const respond = async (id, action) => {
    await api.post(`/requests/${id}/respond`, { action })
    load()
  }
  const cancel = async (id) => {
    await api.del(`/requests/${id}`)
    load()
  }

  const pending = incoming.filter((r) => r.status === 'pending')
  const photoTotal = albums.reduce((n, a) => n + a.photo_count, 0)

  return (
    <div className="space-y-8">
      {/* profile header */}
      <section className="flex flex-wrap items-start gap-5">
        <Avatar user={user} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{user.name}</h1>
          <Link to={`/u/${user.username}`} className="text-mute">@{user.username}</Link>
          {user.bio && <p className="mt-2 max-w-prose">{user.bio}</p>}
          <p className="mt-2 text-sm text-mute">
            {albums.length} albums · {photoTotal} photos
          </p>
        </div>
        <button onClick={() => setEditing(!editing)} className="border border-line bg-card px-3 py-1.5 text-sm">
          Edit profile
        </button>
      </section>

      {editing && (
        <ProfileEditor
          user={user}
          onCancel={() => setEditing(false)}
          onSaved={(u) => { setUser(u); setEditing(false) }}
        />
      )}

      {/* tabs */}
      <nav className="flex gap-6 border-b border-line">
        {[
          ['albums', 'Albums'],
          ['requests', `Requests${pending.length ? ` (${pending.length})` : ''}`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 pb-2 font-medium ${tab === key ? 'border-flash' : 'border-transparent text-mute'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'albums' && (
        <section className="space-y-5">
          <button onClick={() => setCreating(!creating)} className="bg-ink px-4 py-2 text-sm font-medium text-paper">
            {creating ? 'Close' : 'New album'}
          </button>
          {creating && <NewAlbum onCreated={(a) => nav(`/a/${a.id}`)} />}

          {albums.length === 0 ? (
            <p className="text-mute">No albums yet. Create one and upload your first photos.</p>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              {albums.map((a) => <AlbumCard key={a.id} album={a} showId />)}
            </div>
          )}
        </section>
      )}

      {tab === 'requests' && (
        <section className="space-y-8">
          <div>
            <h2 className="mb-1 text-lg font-bold">Requests to view your albums</h2>
            {incoming.length === 0 ? (
              <p className="text-mute">Nobody has asked for access yet.</p>
            ) : (
              <ul>{incoming.map((r) => <RequestRow key={r.id} r={r} onRespond={respond} />)}</ul>
            )}
          </div>
          <div>
            <h2 className="mb-1 text-lg font-bold">Requests you sent</h2>
            {outgoing.length === 0 ? (
              <p className="text-mute">Enter a private album ID in the top bar to request access.</p>
            ) : (
              <ul>
                {outgoing.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-line py-3">
                    <Link to={`/a/${r.album.id}`} className="flex-1 truncate underline">{r.album.title}</Link>
                    <span className="text-sm text-mute capitalize">{r.status}</span>
                    {r.status === 'pending' && (
                      <button onClick={() => cancel(r.id)} className="text-sm text-flash">Cancel</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
