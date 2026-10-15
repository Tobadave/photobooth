import { useEffect, useState } from 'react'

export default function Carousel({ photos, onDelete }) {
  const [i, setI] = useState(0)
  const count = photos.length

  useEffect(() => {
    if (i >= count) setI(Math.max(0, count - 1))
  }, [count, i])

  const prev = () => setI((x) => (x - 1 + count) % count)
  const next = () => setI((x) => (x + 1) % count)

  useEffect(() => {
    if (!count) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  if (!count) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-line text-mute">
        No photos in this album yet.
      </div>
    )
  }

  const p = photos[Math.min(i, count - 1)]

  return (
    <div>
      <div className="relative aspect-square overflow-hidden bg-ink sm:aspect-[4/3]">
        <img src={p.url} alt="" className="h-full w-full object-contain" />

        {count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-xl"
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-xl"
            >
              ›
            </button>
          </>
        )}

        <span className="absolute left-2 top-2 rounded bg-ink/70 px-2 py-0.5 text-xs text-paper">
          {Math.min(i, count - 1) + 1} / {count}
        </span>

        {onDelete && (
          <button
            onClick={() => onDelete(p)}
            className="absolute right-2 top-2 rounded bg-flash px-2 py-1 text-xs font-medium text-white"
          >
            Delete photo
          </button>
        )}
      </div>

      {/* contact-strip thumbnails */}
      <div className="mt-2 flex snap-x gap-1.5 overflow-x-auto pb-1">
        {photos.map((ph, idx) => (
          <button
            key={ph.id}
            onClick={() => setI(idx)}
            aria-label={`Show photo ${idx + 1}`}
            className={`h-16 w-16 flex-none snap-start overflow-hidden border-2 ${
              idx === i ? 'border-flash' : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <img src={ph.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
