import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleLogin, googleLogout, type CredentialResponse } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'

interface WelcomePageProps {
  userName?: string
  signedInWithGoogle?: boolean
  onEnter: (name: string) => void
  onGoogleSignIn: (name: string) => void
  onSignOut: () => void
}

interface GoogleJwtPayload {
  given_name?: string
  name?: string
  email?: string
  picture?: string
}

export default function WelcomePage({
  userName,
  signedInWithGoogle = false,
  onEnter,
  onGoogleSignIn,
  onSignOut,
}: WelcomePageProps) {
  const [name, setName] = useState('')
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (signedInWithGoogle) {
      setShowGuestForm(false)
      setAuthError(null)
    }
  }, [signedInWithGoogle])

  const handleGoogleSuccess = (response: CredentialResponse) => {
    setAuthError(null)
    if (!response.credential) {
      setAuthError('Google sign-in failed. Please try again.')
      return
    }
    try {
      const decoded = jwtDecode<GoogleJwtPayload>(response.credential)
      const displayName = decoded.given_name || decoded.name || 'Yogi'
      onGoogleSignIn(displayName)
    } catch {
      setAuthError('Could not read your Google profile. Please try again.')
    }
  }

  const handleGoogleError = () => {
    setAuthError('Google sign-in was cancelled or blocked. You can continue as a guest.')
  }

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onEnter(trimmed)
  }

  const handleSignOut = () => {
    googleLogout()
    setAuthError(null)
    setName('')
    setShowGuestForm(false)
    onSignOut()
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-neutral-950">
      <motion.div
        className="mx-4 w-full max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <img
            src="/Logo.jpeg"
            alt="OorjaKull"
            className="mx-auto mb-6 h-20 w-20 rounded-2xl object-cover shadow-xl shadow-emerald-500/25 ring-1 ring-black/5 dark:ring-white/10"
          />
          <h1 className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-4xl font-bold leading-relaxed text-transparent">
            OorjaKull AI Yoga
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your personal AI-powered yoga companion
          </p>
        </motion.div>

        {/* Auth options */}
        <motion.div
          className="mt-10 space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {signedInWithGoogle && userName ? (
            <motion.div
              className="rounded-3xl border border-emerald-200/70 bg-white/90 p-5 text-left shadow-lg shadow-emerald-500/10 backdrop-blur dark:border-emerald-400/20 dark:bg-white/5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600/80 dark:text-emerald-300/80">
                Signed in with Google
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                Welcome back, {userName}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Continue your guided practice or sign out to switch accounts.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onEnter(userName)}
                  className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Continue as {userName}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-black/10">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Sign in to get started
                </p>
                <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      shape="pill"
                      size="large"
                      text="continue_with"
                      theme="outline"
                      logo_alignment="left"
                      width="320"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Secure Google sign-in, styled to match your practice space.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          <AnimatePresence>
            {authError && (
              <motion.p
                className="text-xs text-amber-600 dark:text-amber-400"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {authError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          {/* Guest toggle / form */}
          <AnimatePresence mode="wait">
            {!showGuestForm ? (
              <motion.button
                key="guest-btn"
                type="button"
                onClick={() => setShowGuestForm(true)}
                className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                Continue as Guest
              </motion.button>
            ) : (
              <motion.form
                key="guest-form"
                onSubmit={handleGuestSubmit}
                className="space-y-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  What should we call you?
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  autoFocus
                  maxLength={30}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-center text-lg text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500"
                >
                  Enter →
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="mt-8 space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Guided practice · Real-time AI feedback · Voice instructions
          </p>
          <a
            href="https://www.oorjakull.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600/70 transition-colors hover:text-emerald-500 dark:text-emerald-400/60 dark:hover:text-emerald-300"
          >
            oorjakull.com
            <span className="opacity-60">🌐</span>
          </a>
        </motion.div>
      </motion.div>
    </div>
  )
}
