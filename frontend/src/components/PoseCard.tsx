import { motion } from 'framer-motion'
import { POSE_DESCRIPTIONS } from '../data/poseDescriptions'

/** Subtle gradient accent colours per card index (cycles) */
const ACCENT_GRADIENTS = [
  'from-emerald-500/60 to-teal-400/60',
  'from-teal-500/60 to-cyan-400/60',
  'from-cyan-500/60 to-sky-400/60',
  'from-sky-500/60 to-indigo-400/60',
  'from-violet-500/60 to-purple-400/60',
  'from-fuchsia-500/60 to-pink-400/60',
  'from-rose-500/60 to-orange-400/60',
  'from-amber-500/60 to-yellow-400/60',
  'from-lime-500/60 to-emerald-400/60',
]

export default function PoseCard(props: {
  poseName: string
  index?: number
  onClick: () => void
}) {
  const { poseName, index = 0, onClick } = props
  const desc = POSE_DESCRIPTIONS[poseName]
  const accent = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 backdrop-blur transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-slate-800/80 dark:shadow-xl dark:shadow-black/30"
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      {/* ── Top accent gradient bar ─────────────────────────────────────── */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />

      {/* ── Card body ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-start p-4">
        {/* English name (white) + Sanskrit name (green) */}
        <div className="w-full">
          <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-white">
            {desc?.englishName ?? poseName}
          </h3>
          {desc && (
            <p className="mt-0.5 text-xs font-medium italic text-emerald-400/90">
              {desc.sanskritName}
            </p>
          )}
        </div>

        {/* Benefits — clamped by default, full text on hover */}
        {desc && (
          <p className="mt-2 text-left text-xs leading-relaxed text-slate-500 transition-all duration-300 line-clamp-3 group-hover:line-clamp-none group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
            {desc.benefits}
          </p>
        )}

        {/* "Start" hint — appears on hover */}
        <div className="mt-3 flex w-full items-center justify-end">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 transition-colors group-hover:text-emerald-500 dark:text-emerald-500/70 dark:group-hover:text-emerald-400">
            Start →
          </span>
        </div>
      </div>
    </motion.button>
  )
}
