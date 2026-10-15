import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'
import Carousel from '../components/Carousel'
import { VisibilityBadge } from '../components/AlbumCard'

export default function AlbumPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const fileRef = useRef(null)
  const [album, setAlbum] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setAlbum(await api.get(`/albums/${id}`))
      setError('')
    } catch (e) {
      setAlbum(null)
      setError(e.message)
    }
  }, [id])

  useEffect(() => { load() }, [load, user?.id])

  const upload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const form = new FormData()
    files.forEach((f) => form.append('photos', f))
    setBusy(true)
    setMsg('')
    try {
      const r = await api.upload(`/albums/${id}/photos`, form)
      setMsg(`${r.saved} uploaded${r.skipped ? `, ${r.skipped} skipped (images only, 10 MB max)` : ''}.`)
      await load()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePhoto = async (p) => {
    if (!confirm('Delete this photo?')) return
    await api.del(`/photos/${p.id}`)
    load()
  }

  const toggleVisibility = async () => {
    const next = album.visibility === 'public' ? 'private' : 'public'
    await api.patch(`/albums/${id}`, { visibility: next })
    load()
  }

  const removeAlbum = async () => {
    if (!confirm('Delete this album and all its photos?')) return
    await api.del(`/albums/${id}`)
    nav('/')
  }

  const requestAccess = async () => {
    try {
      await api.post(`/albums/${id}/request`)
      load()
    } catch (e) {
      setMsg(e.message)
    }
  }

  if (error) return <p className="py-10 text-center text-mute">{error}</p>
  if (!album) return <p className="text-mute">Loading…</p>

  const isOwner = album.access === 'owner'
  const canView = isOwner || album.access === 'granted'

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{album.title}</h1>
          <VisibilityBadge visibility={album.visibility} />
        </div>
        {album.description && <p className="mt-1 text-mute">{album.description}</p>}
        <Link to={`/u/${album.owner.username}`} className="mt-3 inline-flex items-center gap-2 text-sm">
          <Avatar user={album.owner} size={24} /> @{album.owner.username}
        </Link>
      </header>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-2 border border-line bg-card p-3 text-sm">
          <span className="mr-auto font-mono">ID: {album.id}</span>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="bg-ink px-3 py-1.5 font-medium text-paper disabled:opacity-50">
            {busy ? 'Uploading…' : 'Upload photos'}
          </button>
          <button onClick={toggleVisibility} className="border border-line px-3 py-1.5">
            Make {album.visibility === 'public' ? 'private' : 'public'}
          </button>
          <button onClick={removeAlbum} className="px-3 py-1.5 text-flash">Delete album</button>
        </div>
      )}

      {msg && <p className="text-sm text-mute">{msg}</p>}

      {canView ? (
        <Carousel photos={album.photos || []} onDelete={isOwner ? removePhoto : undefined} />
      ) : (
        <div className="space-y-4 border border-line bg-card p-8 text-center">
          <p className="text-xl font-bold">This album is private</p>
          <p className="text-mute">{album.photo_count} photos inside. The owner has to approve you first.</p>

          {!user && (
            <Link to="/login" className="inline-block bg-ink px-4 py-2 font-medium text-paper">
              Sign in to request access
            </Link>
          )}
          {user && album.access === 'none' && (
            <button onClick={requestAccess} className="bg-ink px-4 py-2 font-medium text-paper">
              Request access
            </button>
          )}
          {album.access === 'pending' && <p className="font-medium">Request sent. Waiting for @{album.owner.username}.</p>}
          {album.access === 'declined' && <p className="font-medium text-flash">The owner declined your request.</p>}
        </div>
      )}
    </div>
  )
}
