import { motion } from 'framer-motion'

export interface PoseResult {
  pose: string
  score: number | null
  sideNote?: string
}

interface SequenceCompleteOverlayProps {
  sequenceName: string
  results: PoseResult[]
  onPracticeAgain: () => void
  onHome: () => void
}

function scoreColorText(score: number | null): string {
  if (score === null) return 'text-slate-400'
  if (score >= 90) return 'text-emerald-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-rose-400'
}

function scoreBadge(score: number | null): string {
  if (score === null) return 'bg-slate-500/15 text-slate-400'
  if (score >= 90) return 'bg-emerald-500/15 text-emerald-400'
  if (score >= 70) return 'bg-amber-500/15 text-amber-400'
  return 'bg-rose-500/15 text-rose-400'
}

function scoreWord(score: number | null): string {
  if (score === null) return 'Skipped'
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  return 'Keep going'
}

export default function SequenceCompleteOverlay({
  sequenceName,
  results,
  onPracticeAgain,
  onHome,
}: SequenceCompleteOverlayProps) {
  const validScores = results
    .map((r) => r.score)
    .filter((s): s is number => s !== null)
  const avgScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null

  const overallLabel =
    avgScore === null
      ? 'Practice Complete'
      : avgScore >= 90
        ? 'Outstanding!'
        : avgScore >= 70
          ? 'Well Done!'
          : 'Keep Practising!'

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-neutral-950 dark:text-white">
      <div className="mx-auto max-w-lg px-4 pb-16 pt-12">
        {/* Hero */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-4xl shadow-2xl shadow-amber-500/30"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
          >
            ☀️
          </motion.div>

          <h1 className="bg-gradient-to-r from-amber-500 to-orange-400 bg-clip-text text-3xl font-bold text-transparent dark:from-amber-300 dark:to-orange-300">
            {sequenceName} Complete!
          </h1>

          {avgScore !== null ? (
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <div className={`text-6xl font-bold tabular-nums ${scoreColorText(avgScore)}`}>
                {avgScore}
                <span className="text-2xl text-slate-400"> / 100</span>
              </div>
              <p className={`mt-1 text-lg font-semibold ${scoreColorText(avgScore)}`}>
                {overallLabel}
              </p>
            </motion.div>
          ) : (
            <p className="mt-3 text-lg font-semibold text-slate-500 dark:text-slate-300">
              {overallLabel}
            </p>
          )}

          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
            {results.length} poses completed
          </p>
        </motion.div>

        {/* Per-pose breakdown */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Pose Breakdown
          </h2>
          <div className="space-y-2">
            {results.map((result, i) => (
              <motion.div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.04 }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      {result.pose}
                    </p>
                    {result.sideNote && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {result.sideNote}
                      </p>
                    )}
                  </div>
                </div>
                <div className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${scoreBadge(result.score)}`}>
                  {result.score !== null ? `${result.score} — ${scoreWord(result.score)}` : 'Skipped'}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <button
            type="button"
            onClick={onPracticeAgain}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-sm font-semibold text-white shadow-xl shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            ☀️ Practice Again
          </button>
          <button
            type="button"
            onClick={onHome}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 py-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Return to Poses
          </button>
        </motion.div>
      </div>
    </div>
  )
}
