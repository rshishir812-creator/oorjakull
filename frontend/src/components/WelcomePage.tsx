import { useState } from 'react'
import { motion } from 'framer-motion'

interface WelcomePageProps {
  onEnter: (name: string) => void
}

export default function WelcomePage({ onEnter }: WelcomePageProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onEnter(trimmed)
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

        {/* Name input */}
        <motion.form
          onSubmit={handleSubmit}
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
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
            className="mt-5 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500"
          >
            Enter →
          </button>
        </motion.form>

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
