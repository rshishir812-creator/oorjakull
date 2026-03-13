import { motion } from 'framer-motion'
import { POSE_DESCRIPTIONS } from '../data/poseDescriptions'

/** Yoga-themed emoji for visual flair — keyed by pose name */
const POSE_ICONS: Record<string, string> = {
  'Tadasana': '🏔️',
  'Down Dog': '🐕',
  'Goddess': '👑',
  'Plank': '💪',
  'Tree Pose': '🌳',
  'Warrior II': '⚔️',
  'Ashwa Sanchalanasana': '🐴',
  'Hasta Uttanasana': '🙌',
  'Padahastasana': '🙏',
  'Pranamasana': '🧘',
}

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
  const icon = POSE_ICONS[poseName] ?? '🧘'
  const accent = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-800/80 shadow-xl shadow-black/30 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      style={{ aspectRatio: '4 / 3' }}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      {/* ── Top accent gradient bar ─────────────────────────────────────── */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />

      {/* ── Card body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-start justify-between overflow-hidden p-4">
        {/* Icon + name row */}
        <div className="w-full">
          <span className="text-2xl leading-none">{icon}</span>
          <h3 className="mt-2 truncate text-base font-bold leading-snug text-white">
            {poseName}
          </h3>
          {desc && (
            <p className="mt-0.5 truncate text-xs font-medium italic text-emerald-400/90">
              {desc.sanskritName}
            </p>
          )}
        </div>

        {/* Benefits – clamp to 3 lines to prevent overflow */}
        {desc && (
          <p className="mt-2 line-clamp-3 text-left text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
            {desc.benefits}
          </p>
        )}

        {/* "Start" hint — appears on hover */}
        <div className="mt-auto flex w-full items-center justify-end pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70 transition-colors group-hover:text-emerald-400">
            Start →
          </span>
        </div>
      </div>
    </motion.button>
  )
}
