import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PoseDescription } from '../data/poseDescriptions'

interface PoseIntroOverlayProps {
  pose: string
  mediaSrc: string | null
  description: PoseDescription | undefined
  phase: 'intro' | 'framing' | 'results'
  visibleLandmarkCount: number
  voiceEnabled: boolean
  onNext: () => void
  /** Navigates back to landing from the intro overlay */
  onBack?: () => void
  /** Only used in results phase — navigates back to landing */
  onTryAnother?: () => void
  /** Only used in results phase */
  score?: number | null
  /** Only used in results phase */
  feedbackSummary?: string
}

function MediaThumb({ src, alt }: { src: string; alt: string }) {
  const isVideo = /\.(mp4|webm|mov)$/i.test(src)
  return isVideo ? (
    <video
      src={src}
      muted
      loop
      playsInline
      autoPlay
      className="h-full w-full object-cover"
    />
  ) : (
    <img src={src} alt={alt} className="h-full w-full object-cover" />
  )
}

export default function PoseIntroOverlay({
  pose,
  mediaSrc,
  description,
  phase,
  visibleLandmarkCount,
  voiceEnabled,
  onNext,
  onBack,
  onTryAnother,
  score,
  feedbackSummary,
}: PoseIntroOverlayProps) {
  const [showButton, setShowButton] = useState(false)
  const isReady = visibleLandmarkCount >= 29

  // ── Auto-countdown for framing phase ─────────────────────────────────────
  const [framingCountdown, setFramingCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasTriggeredRef = useRef(false)

  const stableOnNext = useCallback(() => onNext(), [onNext])

  // Reset when entering / leaving framing phase
  useEffect(() => {
    if (phase !== 'framing') {
      setFramingCountdown(0)
      hasTriggeredRef.current = false
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [phase])

  // Start 10-second countdown once body is detected; cancel if body disappears
  useEffect(() => {
    if (phase !== 'framing' || hasTriggeredRef.current) return

    if (isReady && framingCountdown === 0) {
      // Body detected → begin countdown
      setFramingCountdown(10)
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setFramingCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current)
              countdownRef.current = null
            }
            hasTriggeredRef.current = true
            setTimeout(() => stableOnNext(), 0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    if (!isReady && framingCountdown > 0) {
      // Body lost → reset countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      setFramingCountdown(0)
    }
  }, [phase, isReady, framingCountdown, stableOnNext])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [])

  // Show the "Let's Begin" button after a short moment so the overlay isn't skipped accidentally
  useEffect(() => {
    if (phase !== 'intro') return
    setShowButton(false)
    const t = setTimeout(() => setShowButton(true), 2500)
    return () => clearTimeout(t)
  }, [phase, pose])

  const fullSrc = mediaSrc || null

  /* ─── Intro Phase ─── */
  if (phase === 'intro') {
    return (
      <motion.div
        key="intro-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative w-full max-w-xl">
          {/* Blurred background image */}
          {fullSrc && (
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <MediaThumb src={fullSrc} alt={pose} />
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            </div>
          )}

          {/* Card content */}
          <div className="relative rounded-3xl border border-white/10 bg-black/50 p-8 text-center backdrop-blur">
            {/* Reference image — large & prominent */}
            {fullSrc && (
              <motion.div
                className="mx-auto mb-6 h-56 w-56 overflow-hidden rounded-2xl border-2 border-emerald-500/30 shadow-2xl shadow-emerald-900/30"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <MediaThumb src={fullSrc} alt={pose} />
              </motion.div>
            )}

            <motion.h2
              className="text-3xl font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {description?.englishName ?? pose}
            </motion.h2>

            {description && (
              <motion.p
                className="mt-1 text-base italic text-emerald-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {description.sanskritName}
              </motion.p>
            )}

            {description && (
              <motion.p
                className="mt-4 text-sm leading-relaxed text-slate-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {description.introScript}
              </motion.p>
            )}

            {/* Voice indicator */}
            <motion.div
              className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {voiceEnabled ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Voice guide is playing…
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Enable Voice for audio guidance
                </>
              )}
            </motion.div>

            {/* Let's Begin + Back buttons */}
            <AnimatePresence>
              {showButton && (
                <motion.div
                  className="mt-6 flex flex-col gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={onNext}
                    className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/50 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Let's Begin →
                  </button>
                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      ← Back to Poses
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    )
  }

  /* ─── Framing Phase ─── */
  if (phase === 'framing') {
    const countdownActive = framingCountdown > 0

    return (
      <motion.div
        key="framing-overlay"
        className="absolute inset-0 z-40 flex flex-col items-center justify-end rounded-2xl"
        style={{ backgroundColor: 'rgba(0,0,0,0.30)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Large centered countdown number */}
        <AnimatePresence mode="wait">
          {countdownActive && (
            <motion.div
              key={`cd-${framingCountdown}`}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="text-8xl font-bold text-white drop-shadow-2xl"
                style={{ textShadow: '0 0 40px rgba(16,185,129,0.6)' }}
              >
                {framingCountdown}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom card — reference image + body detection status */}
        <motion.div
          className="mx-3 mb-3 w-full max-w-md rounded-2xl border border-white/15 bg-black/75 p-4 backdrop-blur-md"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div className="flex items-start gap-4">
            {/* Reference image thumbnail */}
            {fullSrc && (
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-900/20">
                <MediaThumb src={fullSrc} alt={pose} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">
                {countdownActive ? 'Hold the pose!' : 'Step into the frame'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-300">
                {countdownActive ? (
                  <>Evaluating in <span className="font-bold text-emerald-400">{framingCountdown}</span> seconds…</>
                ) : (
                  <>Match the <span className="font-medium text-emerald-400">{pose}</span> reference and stay visible.</>
                )}
              </p>

              {/* Landmark visibility bar */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                  <span>Body detected</span>
                  <span className={isReady ? 'text-emerald-400' : 'text-slate-400'}>
                    {visibleLandmarkCount} / 33
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    animate={{ width: `${Math.min(100, (visibleLandmarkCount / 33) * 100)}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status message */}
          <div className="mt-3 text-center text-xs text-slate-400">
            {countdownActive ? (
              <span className="text-emerald-300">✓ Body detected — hold your pose steady!</span>
            ) : isReady ? (
              <span className="text-emerald-300">✓ Body detected — starting countdown…</span>
            ) : (
              <span className="anim-dots">
                Waiting for your body to appear<span>.</span><span>.</span><span>.</span>
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  /* ─── Results Phase ─── */
  const scoreColor = (score ?? 0) >= 90
    ? 'text-emerald-400'
    : (score ?? 0) >= 70
      ? 'text-amber-400'
      : 'text-rose-400'

  const scoreLabel = (score ?? 0) >= 90
    ? 'Excellent!'
    : (score ?? 0) >= 70
      ? 'Good effort!'
      : 'Keep practising!'

  return (
    <motion.div
      key="results-overlay"
      className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/15 bg-black/70 p-8 text-center backdrop-blur">
        {/* Score */}
        <motion.div
          className="mb-2 text-5xl font-bold tabular-nums"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <span className={scoreColor}>{score ?? '—'}</span>
          <span className="text-xl text-slate-400"> / 100</span>
        </motion.div>

        <motion.p
          className={`mb-1 text-lg font-semibold ${scoreColor}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {scoreLabel}
        </motion.p>

        <motion.p
          className="mb-6 text-sm leading-relaxed text-slate-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          {feedbackSummary || 'Great work on your practice.'}
        </motion.p>

        {/* Voice indicator */}
        {voiceEnabled && (
          <motion.div
            className="mb-5 flex items-center justify-center gap-2 text-xs text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Listening for your choice…
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-3 sm:flex-row"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/50 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            🔄  Try Again
          </button>
          <button
            type="button"
            onClick={onTryAnother}
            className="flex-1 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            🧘  Try Another Pose
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
