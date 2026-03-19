import { motion } from 'framer-motion'
import PoseCard from './PoseCard'
import type { PoseSequence } from '../data/sequences'

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

export default function LandingPage(props: {
  poses: string[]
  onSelectPose: (pose: string) => void
  onBackHome: () => void
  sequences?: PoseSequence[]
  onSelectSequence?: (seq: PoseSequence) => void
}) {
  const { poses, onSelectPose, onBackHome, sequences, onSelectSequence } = props

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-neutral-950 dark:text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <motion.div
          className="mb-6 flex justify-start"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <span aria-hidden="true">←</span>
            Back to home
          </button>
        </motion.div>

        {/* Header */}
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: -22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <h1 className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text pb-2 text-5xl font-bold leading-relaxed tracking-normal text-transparent">
            OorjaKull AI Yoga
          </h1>
          <p className="mt-3 text-lg text-slate-500 dark:text-slate-300">
            Choose a pose to begin your guided practice
          </p>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        </motion.div>

        {/* ── Guided Sequences ─────────────────────────────────────────── */}
        {sequences && sequences.length > 0 && onSelectSequence && (
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
          >
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Guided Sequences
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sequences.map((seq) => (
                <button
                  key={seq.id}
                  type="button"
                  onClick={() => onSelectSequence(seq)}
                  className="group relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-rose-500/8 p-5 text-left shadow-lg transition-all hover:border-amber-400/45 hover:shadow-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-rose-500/10 dark:border-amber-500/20 dark:hover:border-amber-400/35"
                >
                  {/* Background glow */}
                  <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl transition-all group-hover:bg-amber-400/20" />

                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl shadow-lg shadow-amber-500/30">
                      ☀️
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                            {seq.name}
                          </h3>
                          <p className="text-xs italic text-amber-700/70 dark:text-amber-400/80">
                            {seq.sanskritName}
                          </p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                          {seq.difficulty}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {seq.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>{seq.steps.length} poses</span>
                        <span>~{seq.durationMins} min</span>
                        <span className="ml-auto font-semibold text-amber-600 transition-colors group-hover:text-amber-500 dark:text-amber-400 dark:group-hover:text-amber-300">
                          Begin →
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Individual Poses ─────────────────────────────────────────── */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Individual Poses
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {poses.map((pose, i) => (
            <motion.div key={pose} variants={cardVariants}>
              <PoseCard
                poseName={pose}
                index={i}
                onClick={() => onSelectPose(pose)}
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Enable Voice in the top bar for guided audio instructions
        </motion.p>
      </div>
    </div>
  )
}
