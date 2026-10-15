import { useState } from 'react'
import { Link } from 'react-router-dom'

export function VisibilityBadge({ visibility }) {
  const isPrivate = visibility === 'private'
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        isPrivate ? 'bg-ink text-paper' : 'bg-line text-ink'
      }`}
    >
      {isPrivate ? 'Private' : 'Public'}
    </span>
  )
}

export default function AlbumCard({ album, showId = false }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(album.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group">
      <Link to={`/a/${album.id}`} className="block">
        <div className="aspect-square overflow-hidden bg-line">
          {album.cover ? (
            <img
              src={album.cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-mute">No photos yet</div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h3 className="truncate font-bold">{album.title}</h3>
          <VisibilityBadge visibility={album.visibility} />
        </div>
        <p className="text-sm text-mute">
          {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'}
        </p>
      </Link>
      {showId && (
        <button
          onClick={copy}
          className="mt-1 rounded border border-line bg-card px-2 py-1 font-mono text-xs hover:border-ink"
          title="Copy album ID"
        >
          {copied ? 'Copied' : `ID: ${album.id}`}
        </button>
      )}
    </div>
  )
}
