import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../auth'

export default function Login() {
  const { user, loginWithGoogle } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) nav('/', { replace: true })
  }, [user, nav])

  const onSuccess = async (res) => {
    setError('')
    try {
      const out = await loginWithGoogle(res.credential)
      nav(out.needs_signup ? '/signup' : '/')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-5xl font-extrabold leading-none tracking-tight">
        Share the shoot,
        <br />
        keep the roll private.
      </h1>
      <p className="mt-4 text-mute">
        Make albums, post them publicly, or lock them behind an ID and approve who gets in.
      </p>

      <div className="mt-8 flex justify-center">
        <GoogleLogin
          text="continue_with"
          shape="pill"
          size="large"
          onSuccess={onSuccess}
          onError={() => setError('Google sign-in failed. Try again.')}
        />
      </div>
      {error && <p className="mt-4 text-sm text-flash">{error}</p>}
    </section>
  )
}
