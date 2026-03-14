import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDelayedValue } from '../hooks/useDelayedValue'

export type FeedbackPanelProps = {
  message: string
  correctionBullets?: string[]
  positiveObservation?: string
  breathCue?: string
  safetyNote?: string | null
}

const bulletVariants = {
  hidden: { opacity: 0, x: -8 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: 'easeOut' as const },
  }),
}

export default memo(function FeedbackPanel(props: FeedbackPanelProps) {
  const { correctionBullets = [], positiveObservation = '', breathCue = '', safetyNote = null } = props

  const msg = useDelayedValue(props.message, 150)
  const bullets = useDelayedValue(correctionBullets, 150)
  const positive = useDelayedValue(positiveObservation, 150)
  const breath = useDelayedValue(breathCue, 150)
  const safety = useDelayedValue(safetyNote, 150)

  const hasDetails = bullets.length > 0 || !!positive || !!breath || !!safety

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur transition-colors dark:border-white/10 dark:bg-black/35">
      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Instructor feedback</div>

      {/* Summary line */}
      <AnimatePresence mode="wait">
        <motion.div
          key={msg}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="whitespace-pre-wrap text-sm font-medium leading-snug text-slate-800 dark:text-slate-100"
          aria-live="polite"
        >
          {msg}
        </motion.div>
      </AnimatePresence>

      {/* Detailed feedback sections */}
      <AnimatePresence>
        {hasDetails && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-3 space-y-2 overflow-hidden"
          >
            {/* ✅ What you're doing right */}
            {positive && (
              <motion.div
                className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:ring-emerald-700/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span className="mt-0.5 shrink-0 text-sm">✅</span>
                <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-200">{positive}</p>
              </motion.div>
            )}

            {/* 🔸 Correction bullets */}
            {bullets.length > 0 && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-700/40">
                <div className="mb-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">Corrections</div>
                <ul className="space-y-1.5">
                  {bullets.map((bullet, i) => (
                    <motion.li
                      key={bullet}
                      custom={i}
                      variants={bulletVariants}
                      initial="hidden"
                      animate="show"
                      className="flex gap-2 text-xs leading-relaxed text-amber-800 dark:text-amber-100"
                    >
                      <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400">▸</span>
                      {bullet}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* 🌬️ Breath cue */}
            {breath && (
              <motion.div
                className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:ring-blue-700/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <span className="mt-0.5 shrink-0 text-sm">🌬️</span>
                <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-200">{breath}</p>
              </motion.div>
            )}

            {/* ⚠️ Safety note */}
            {safety && (
              <motion.div
                className="flex gap-2 rounded-xl bg-red-50 px-3 py-2 ring-1 ring-red-200 dark:bg-red-950/50 dark:ring-red-700/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <span className="mt-0.5 shrink-0 text-sm">⚠️</span>
                <p className="text-xs leading-relaxed text-red-700 dark:text-red-200">{safety}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
