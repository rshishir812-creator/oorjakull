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
  // ── Sequence props ───────────────────────────────────────────────────────
  isInSequence?: boolean
  /** 0-based index of the current pose in the sequence */
  sequenceIndex?: number
  sequenceTotalPoses?: number
  /** Name of the next pose (undefined on last step) */
  nextPoseName?: string
  /** Side-specific note shown in intro phase */
  sideNote?: string
  /** Called when user confirms moving to the next sequence pose */
  onNextInSequence?: () => void
  /** Called when user wants to exit the sequence entirely */
  onExitSequence?: () => void
  /** Sub-phase within framing: detecting body → getting into pose → countdown to evaluate */
  framingSubPhase?: 'detecting' | 'posing' | 'countdown'
  /** Starts 10-second intro auto-begin countdown when true */
  autoStart?: boolean
  /** Indicates active voice-command listening state */
  voiceListening?: boolean
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
  isInSequence = false,
  sequenceIndex,
  sequenceTotalPoses,
  nextPoseName,
  sideNote,
  onNextInSequence,
  onExitSequence,
  framingSubPhase = 'detecting',
  autoStart = false,
  voiceListening = false,
}: PoseIntroOverlayProps) {
  const [showButton, setShowButton] = useState(false)
  const [introSecondsLeft, setIntroSecondsLeft] = useState(10)
  const [introProgress, setIntroProgress] = useState(0)
  const introCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const introAutoTriggeredRef = useRef(false)

  // ── Countdown for framing phase (only runs in 'countdown' sub-phase) ─────
  const [framingCountdown, setFramingCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasTriggeredRef = useRef(false)

  const stableOnNext = useCallback(() => onNext(), [onNext])

  // Reset when leaving framing phase
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

  // Start countdown only when sub-phase enters 'countdown'; stop if it leaves
  useEffect(() => {
    if (phase !== 'framing' || hasTriggeredRef.current) return

    if (framingSubPhase === 'countdown' && framingCountdown === 0 && !countdownRef.current) {
      setFramingCountdown(7)
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

    // If sub-phase drops back (e.g. body lost), cancel countdown
    if (framingSubPhase !== 'countdown' && framingCountdown > 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      setFramingCountdown(0)
    }
  }, [phase, framingSubPhase, framingCountdown, stableOnNext])

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
    setIntroSecondsLeft(10)
    setIntroProgress(0)
    introAutoTriggeredRef.current = false
    if (introCountdownRef.current) {
      clearInterval(introCountdownRef.current)
      introCountdownRef.current = null
    }
    const t = setTimeout(() => setShowButton(true), 2500)
    return () => {
      clearTimeout(t)
      if (introCountdownRef.current) {
        clearInterval(introCountdownRef.current)
        introCountdownRef.current = null
      }
    }
  }, [phase, pose])

  // Intro auto-start countdown (10 s) begins only after TTS signals autoStart=true
  useEffect(() => {
    if (phase !== 'intro' || !showButton || !autoStart || introAutoTriggeredRef.current) return

    setIntroSecondsLeft(10)
    setIntroProgress(0)

    let elapsed = 0
    const durationMs = 10000
    const tickMs = 100

    introCountdownRef.current = setInterval(() => {
      elapsed += tickMs
      const nextProgress = Math.min(100, (elapsed / durationMs) * 100)
      const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))
      setIntroProgress(nextProgress)
      setIntroSecondsLeft(secondsLeft)

      if (elapsed >= durationMs) {
        if (introCountdownRef.current) {
          clearInterval(introCountdownRef.current)
          introCountdownRef.current = null
        }
        introAutoTriggeredRef.current = true
        setTimeout(() => stableOnNext(), 0)
      }
    }, tickMs)

    return () => {
      if (introCountdownRef.current) {
        clearInterval(introCountdownRef.current)
        introCountdownRef.current = null
      }
    }
  }, [phase, showButton, autoStart, stableOnNext])

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
            {/* Sequence progress pill */}
            {isInSequence && sequenceTotalPoses && (
              <motion.div
                className="mb-4 flex justify-center"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                  ☀️ Pose {(sequenceIndex ?? 0) + 1} of {sequenceTotalPoses}
                </span>
              </motion.div>
            )}

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

            {/* Side note (sequence-specific instruction, e.g. "Switch legs") */}
            {sideNote && (
              <motion.div
                className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                💡 {sideNote}
              </motion.div>
            )}

            {/* Voice / auto-start indicator */}
            <motion.div
              className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {autoStart && showButton ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Auto-starting soon — or tap the button to begin now
                </>
              ) : voiceEnabled ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Voice guide is playing…
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                  Preparing…
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
                    className="relative w-full overflow-hidden rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/50 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {/* Animated progress fill */}
                    {autoStart && introProgress > 0 && (
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-emerald-500"
                        initial={{ width: '0%' }}
                        animate={{ width: `${introProgress}%` }}
                        transition={{ duration: 0.15, ease: 'linear' }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {autoStart && !introAutoTriggeredRef.current && introSecondsLeft > 0 ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Starting in {introSecondsLeft}s…
                        </>
                      ) : (
                        "Let's Begin →"
                      )}
                    </span>
                  </button>
                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      {isInSequence ? '← Exit Sequence' : '← Back to Poses'}
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
    const bodyDetected = visibleLandmarkCount >= 29

    // Heading & subtitle per sub-phase
    const heading =
      framingSubPhase === 'countdown' ? 'Hold the pose!' :
      framingSubPhase === 'posing' ? `Get into ${pose}` :
      'Step into the frame'
    const subtitle =
      framingSubPhase === 'countdown' && countdownActive
        ? <>Evaluating in <span className="font-bold text-emerald-400">{framingCountdown}</span> seconds…</>
        : framingSubPhase === 'posing'
          ? <>Match the <span className="font-medium text-emerald-400">{pose}</span> reference shown here, then hold still.</>
          : <>Stand so your full body is visible in the camera.</>

    const statusMsg =
      framingSubPhase === 'countdown'
        ? <span className="text-emerald-300">✓ Great form — hold your pose steady!</span>
        : framingSubPhase === 'posing'
          ? <span className="text-amber-300">✓ Body visible — now get into the pose…</span>
          : bodyDetected
            ? <span className="text-emerald-300">✓ Body detected — adjusting…</span>
            : <span className="anim-dots">Waiting for your body to appear<span>.</span><span>.</span><span>.</span></span>

    return (
      <motion.div
        key="framing-overlay"
        className="absolute inset-0 z-40 flex flex-col items-center justify-end rounded-2xl pb-14 sm:pb-3"
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
                {heading}
              </h3>
              <p className="mt-0.5 text-xs text-slate-300">
                {subtitle}
              </p>

              {/* Landmark visibility bar — always shown */}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                  <span>{framingSubPhase === 'detecting' ? 'Body detected' : 'Visibility'}</span>
                  <span className={bodyDetected ? 'text-emerald-400' : 'text-slate-400'}>
                    {visibleLandmarkCount} / 33
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full ${bodyDetected ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    animate={{ width: `${Math.min(100, (visibleLandmarkCount / 33) * 100)}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sub-phase step indicator */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {(['detecting', 'posing', 'countdown'] as const).map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === framingSubPhase
                    ? 'bg-emerald-500 text-white'
                    : (['detecting', 'posing', 'countdown'].indexOf(framingSubPhase) > i)
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : 'bg-white/10 text-slate-500'
                }`}>
                  {(['detecting', 'posing', 'countdown'].indexOf(framingSubPhase) > i) ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`h-px w-4 ${(['detecting', 'posing', 'countdown'].indexOf(framingSubPhase) > i) ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {/* Status message */}
          <div className="mt-2 text-center text-xs text-slate-400">
            {statusMsg}
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
        {/* Sequence progress pill */}
        {isInSequence && sequenceTotalPoses && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
              ☀️ Pose {(sequenceIndex ?? 0) + 1} of {sequenceTotalPoses}
            </span>
          </div>
        )}

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
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${voiceListening ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
            {voiceListening ? 'Listening for your choice… say next, again, or exit' : 'Voice commands ready'}
          </motion.div>
        )}

        <motion.div
          className="flex flex-col gap-3"
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
          {isInSequence ? (
            <>
              <button
                type="button"
                onClick={onNextInSequence}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-900/40 transition-all hover:from-amber-400 hover:to-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {nextPoseName ? `Next: ${nextPoseName} →` : '✓ Finish Sequence'}
              </button>
              <button
                type="button"
                onClick={onExitSequence}
                className="mt-1 text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline focus:outline-none"
              >
                Exit Sequence
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onTryAnother}
              className="flex-1 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            >
              🧘  Try Another Pose
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
