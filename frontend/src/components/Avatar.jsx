export default function Avatar({ user, size = 36 }) {
  const style = { width: size, height: size }
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        referrerPolicy="no-referrer"
        style={style}
        className="rounded-full object-cover"
      />
    )
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.4 }}
      className="grid place-items-center rounded-full bg-ink font-bold text-paper"
    >
      {(user?.name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}
