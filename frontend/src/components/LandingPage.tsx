import { motion } from 'framer-motion'
import PoseCard from './PoseCard'

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
}) {
  const { poses, onSelectPose, onBackHome } = props

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

        {/* Pose grid */}
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
