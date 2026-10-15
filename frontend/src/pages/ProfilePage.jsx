import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import Avatar from '../components/Avatar'
import AlbumCard from '../components/AlbumCard'

export default function ProfilePage() {
  const { username } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    api.get(`/users/${username}`).then(setData).catch((e) => setError(e.message))
  }, [username])

  if (error) return <p className="py-10 text-center text-mute">{error}</p>
  if (!data) return <p className="text-mute">Loading…</p>

  const { user, albums, private_count } = data

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-5">
        <Avatar user={user} size={88} />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{user.name}</h1>
          <p className="text-mute">@{user.username}</p>
          {user.bio && <p className="mt-2 max-w-prose">{user.bio}</p>}
        </div>
      </section>

      {albums.length === 0 ? (
        <p className="text-mute">No public albums yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
        </div>
      )}

      {private_count > 0 && (
        <p className="border-t border-line pt-4 text-sm text-mute">
          {private_count} private {private_count === 1 ? 'album' : 'albums'}. Ask {user.name.split(' ')[0]} for an
          album ID to request access.
        </p>
      )}
    </div>
  )
}
