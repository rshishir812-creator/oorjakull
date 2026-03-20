import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BreathworkPhase, BreathworkProtocol } from '../api/client'
import { useBreathworkAudio } from '../hooks/useBreathworkAudio'

interface BreathworkSessionProps {
  protocol: BreathworkProtocol
  onExit: (toastMessage?: string) => void
}

function formatTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function heartZone(bpm: number) {
  if (bpm < 60) return 'Resting'
  if (bpm <= 80) return 'Relaxed'
  if (bpm <= 100) return 'Stimulated'
  return 'Elevated'
}

export default function BreathworkSession({ protocol, onExit }: BreathworkSessionProps) {
  const activePhases = useMemo(() => protocol.phases.filter((phase) => phase.duration_sec > 0), [protocol])
  const totalDurationMs = useMemo(
    () => activePhases.reduce((sum, phase) => sum + phase.duration_sec * 1000, 0) * protocol.cycles,
    [activePhases, protocol.cycles]
  )

  const [currentPhase, setCurrentPhase] = useState<BreathworkPhase>(activePhases[0])
  const [currentCycle, setCurrentCycle] = useState(1)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [phaseProgress, setPhaseProgress] = useState(0)
  const [displayBpm, setDisplayBpm] = useState(() => 72 + Math.floor(Math.random() * 12))
  const [temperature, setTemperature] = useState(() => 98.4 + Math.random() * 0.4)
  const [zoneBarA, setZoneBarA] = useState(52)
  const [zoneBarB, setZoneBarB] = useState(38)
  const [sessionComplete, setSessionComplete] = useState(false)

  const { playSound } = useBreathworkAudio(true, 0.7)

  const sessionStartRef = useRef<number>(Date.now())
  const phaseStartRef = useRef<number>(Date.now())
  const phaseDurationRef = useRef<number>((activePhases[0]?.duration_sec ?? 1) * 1000)
  const phaseTimeoutRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const hrIntervalRef = useRef<number | null>(null)
  const tempIntervalRef = useRef<number | null>(null)
  const audioPlayedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!activePhases.length) return

    let cancelled = false
    sessionStartRef.current = Date.now()
    setElapsedMs(0)
    setPhaseProgress(0)
    setSessionComplete(false)

    const runPhase = (cycleIndex: number, phaseIndex: number) => {
      if (cancelled) return
      if (cycleIndex >= protocol.cycles) {
        setSessionComplete(true)
        setElapsedMs(Date.now() - sessionStartRef.current)
        setPhaseProgress(1)
        return
      }

      const phase = activePhases[phaseIndex]
      setCurrentCycle(cycleIndex + 1)
      setCurrentPhase(phase)
      audioPlayedRef.current = false
      phaseStartRef.current = Date.now()
      phaseDurationRef.current = phase.duration_sec * 1000
      setPhaseProgress(0)

      if (phaseTimeoutRef.current) {
        window.clearTimeout(phaseTimeoutRef.current)
      }

      phaseTimeoutRef.current = window.setTimeout(() => {
        const nextPhaseIndex = phaseIndex + 1
        if (nextPhaseIndex >= activePhases.length) {
          runPhase(cycleIndex + 1, 0)
        } else {
          runPhase(cycleIndex, nextPhaseIndex)
        }
      }, phase.duration_sec * 1000)
    }

    const tick = () => {
      if (cancelled) return
      const now = Date.now()
      setElapsedMs(now - sessionStartRef.current)
      const duration = phaseDurationRef.current || 1
      const progress = Math.min(1, (now - phaseStartRef.current) / duration)
      setPhaseProgress(progress)
      rafRef.current = window.requestAnimationFrame(tick)
    }

    runPhase(0, 0)
    rafRef.current = window.requestAnimationFrame(tick)

    hrIntervalRef.current = window.setInterval(() => {
      setDisplayBpm((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3
        const next = Math.min(95, Math.max(72, prev + delta))
        return next
      })
      setZoneBarA(40 + Math.round(Math.random() * 42))
      setZoneBarB(26 + Math.round(Math.random() * 38))
    }, 5000)

    tempIntervalRef.current = window.setInterval(() => {
      setTemperature(98.4 + Math.random() * 0.5)
    }, 10000)

    return () => {
      cancelled = true
      if (phaseTimeoutRef.current) window.clearTimeout(phaseTimeoutRef.current)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      if (hrIntervalRef.current) window.clearInterval(hrIntervalRef.current)
      if (tempIntervalRef.current) window.clearInterval(tempIntervalRef.current)
    }
  }, [activePhases, protocol])

  // Play audio cue when phase changes
  useEffect(() => {
    if (!audioPlayedRef.current && currentPhase && currentPhase.duration_sec > 0) {
      audioPlayedRef.current = true
      const phaseLabel = currentPhase.label.toLowerCase()
      if (phaseLabel.includes('inhale') || phaseLabel.includes('breathe in')) {
        playSound('inhale')
      } else if (phaseLabel.includes('hold')) {
        playSound('hold')
      } else if (phaseLabel.includes('exhale') || phaseLabel.includes('breathe out')) {
        playSound('exhale')
      }
    }
  }, [currentPhase, playSound])

  const phaseDurationMs = (currentPhase?.duration_sec ?? 1) * 1000
  const phaseRemainingMs = Math.max(0, phaseDurationMs - phaseProgress * phaseDurationMs)
  const overallProgress = totalDurationMs > 0 ? Math.min(1, elapsedMs / totalDurationMs) : 0

  const animationFrameTime = Date.now()
  const holdPulse = currentPhase?.animation === 'hold' ? 1.3 + Math.sin(animationFrameTime / 300) * 0.02 : 1
  const logoScale = (() => {
    if (!currentPhase) return 1
    if (currentPhase.animation === 'expand') return 0.7 + phaseProgress * 0.6
    if (currentPhase.animation === 'contract') return 1.3 - phaseProgress * 0.6
    if (currentPhase.animation === 'pulse') return 1 + Math.sin(animationFrameTime / 180) * 0.1
    return holdPulse
  })()
  const glowOpacity = (() => {
    if (!currentPhase) return 0.25
    if (currentPhase.animation === 'expand') return 0.35 + phaseProgress * 0.35
    if (currentPhase.animation === 'contract') return 0.7 - phaseProgress * 0.4
    if (currentPhase.animation === 'pulse') return 0.4 + Math.abs(Math.sin(animationFrameTime / 200)) * 0.35
    return 0.55
  })()
  const glowColor = currentPhase?.animation === 'contract' ? '#2d1b69' : '#4ecdc4'
  const progressCircumference = 2 * Math.PI * 142
  const progressOffset = progressCircumference * (1 - phaseProgress)

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black text-white" style={{ height: '100dvh' }}>
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(78,205,196,0.16), transparent 26%), radial-gradient(circle at 50% 62%, rgba(45,27,105,0.2), transparent 34%)',
        }}
      />

      {/* Main content wrapper with safe area */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-between overflow-y-auto px-4 py-6 sm:py-8 md:py-10" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        
        {/* Top section: Timer and cycle counter */}
        <div className="flex w-full flex-col items-center gap-3 xs:gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums text-white xs:text-3xl sm:text-4xl md:text-5xl">
              {formatTime(elapsedMs)}
            </div>
            <div className="mt-1 text-xs tracking-widest text-slate-500 uppercase xs:text-sm">
              Cycle {Math.min(currentCycle, protocol.cycles)} of {protocol.cycles}
            </div>
          </div>

          {/* Temperature display - compact mobile, spacious desktop */}
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-center backdrop-blur-xl xs:px-4 xs:py-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 xs:text-[11px]">Temp</div>
            <div className="mt-0.5 font-semibold text-slate-100 text-xs xs:text-sm">
              {temperature.toFixed(1)}°F
            </div>
          </div>
        </div>

        {/* Center section: Logo with animations */}
        <div className="flex flex-1 flex-col items-center justify-center min-h-0 w-full max-w-3xl">
          <div className="relative flex items-center justify-center">
            {/* Progress ring */}
            <svg className="absolute h-40 w-40 -rotate-90 xs:h-48 xs:w-48 sm:h-64 sm:w-64 md:h-80 md:w-80" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r="142" stroke="rgba(255,255,255,0.07)" strokeWidth="6" fill="none" />
              <circle
                cx="160"
                cy="160"
                r="142"
                stroke={glowColor}
                strokeWidth="7"
                fill="none"
                strokeDasharray={progressCircumference}
                strokeDashoffset={progressOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 120ms linear, stroke 280ms ease' }}
              />
            </svg>

            {/* Pulse ring */}
            <div
              className="breathwork-pulse-ring absolute h-36 w-36 rounded-full border border-teal-300/25 xs:h-44 xs:w-44 sm:h-56 sm:w-56 md:h-72 md:w-72"
              style={{ animationPlayState: currentPhase?.animation === 'hold' ? 'paused' as const : 'running' as const }}
            />

            {/* Glow ring */}
            <div
              className="absolute h-32 w-32 rounded-full xs:h-40 xs:w-40 sm:h-52 sm:w-52 md:h-64 md:w-64"
              style={{
                background: `radial-gradient(circle, ${glowColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 68%)`,
                filter: `blur(${26 + glowOpacity * 28}px)`,
                opacity: glowOpacity,
                transition: 'filter 280ms ease, opacity 280ms ease, background 280ms ease',
              }}
            />

            {/* Logo */}
            <div
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_0_60px_rgba(0,0,0,0.45)] xs:h-32 xs:w-32 sm:h-40 sm:w-40 md:h-52 md:w-52"
              style={{
                transform: `scale(${logoScale})`,
                transition: currentPhase?.animation === 'hold' ? 'none' : 'transform 120ms linear',
                boxShadow: `0 0 90px ${glowColor}55`,
              }}
            >
              <img src="/Logo.jpeg" alt="OorjaKull logo" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>

        {/* Bottom section: Instructions and controls */}
        <div className="flex w-full flex-col items-center gap-4 xs:gap-5 sm:gap-6">
          {/* Phase instructions with better mobile readability */}
          <div className="w-full max-w-2xl px-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentCycle}-${currentPhase.label}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-xl xs:p-4 sm:p-5"
              >
                <h1 className="font-cinzel text-lg font-semibold tracking-wider text-white xs:text-xl sm:text-2xl md:text-3xl">
                  {currentPhase.label}
                </h1>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300 xs:text-sm sm:text-base sm:leading-7 sm:mt-2">
                  {currentPhase.instruction}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wider text-slate-500 xs:text-xs sm:mt-3">
                  {formatTime(phaseRemainingMs)} remaining
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* HR Zone widget - mobile optimized */}
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl xs:p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 xs:text-[11px]">HR Zone</div>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-white xs:text-3xl">{displayBpm}</span>
                  <span className="text-xs text-slate-400 pb-0.5">BPM</span>
                </div>
                <div className="mt-1 text-xs text-teal-200 sm:text-sm">{heartZone(displayBpm)}</div>
              </div>
              <div className="flex items-end gap-1.5">
                <motion.div
                  className="w-2 rounded-full bg-[#4ecdc4] xs:w-2.5"
                  animate={{ height: `${zoneBarA}px` }}
                  transition={{ duration: 2.6, ease: 'easeInOut' }}
                />
                <motion.div
                  className="w-2 rounded-full bg-[#7ae5de] xs:w-2.5"
                  animate={{ height: `${zoneBarB}px` }}
                  transition={{ duration: 2.8, ease: 'easeInOut' }}
                />
              </div>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10 xs:h-1.5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-500"
                animate={{ width: `${Math.max(12, overallProgress * 100)}%` }}
                transition={{ duration: 0.2, ease: 'linear' }}
              />
            </div>
          </div>

          {/* End Session button */}
          <button
            type="button"
            onClick={() => onExit('Session Complete')}
            className="rounded-full border border-red-400/30 bg-red-500/12 px-5 py-2.5 text-xs font-semibold text-red-200 backdrop-blur-xl transition hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 xs:px-6 xs:py-3 xs:text-sm"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Session complete modal */}
      <AnimatePresence>
        {sessionComplete && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#101417]/92 p-6 text-center shadow-2xl backdrop-blur-xl xs:p-7 sm:p-8"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-400/30 to-indigo-500/25 text-2xl xs:h-16 xs:w-16 xs:text-3xl">
                ✨
              </div>
              <h2 className="mt-4 font-cinzel text-2xl font-semibold text-white xs:mt-5 xs:text-3xl">
                Session Complete
              </h2>
              <p className="mt-2 text-xs text-slate-400 xs:text-sm">{protocol.name}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 xs:mt-6">
                <p className="text-xs uppercase tracking-widest text-slate-500">Total Time</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white xs:text-3xl">{formatTime(elapsedMs)}</p>
              </div>
              <p className="mt-5 text-xs leading-6 text-slate-300 xs:text-sm xs:leading-7 sm:mt-6">
                Your nervous system thanks you. Stay with the softness you created and carry it into the rest of your day.
              </p>
              <button
                type="button"
                onClick={() => onExit('Session Complete')}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-black transition hover:from-teal-400 hover:to-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 xs:py-3 xs:text-sm sm:mt-6"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
