import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { AlignmentResponse, ExpectedPose, Landmark, Severity, TrainMedia, UserLevel } from './api/client'
import { evaluateAlignment, fetchTrainPoses } from './api/client'
import InstructorPanel from './components/InstructorPanel'
import LandingPage from './components/LandingPage'
import LayoutToggle, { type LayoutMode } from './components/LayoutToggle'
import PoseIntroOverlay from './components/PoseIntroOverlay'
import UserCameraPanel from './components/UserCameraPanel'
import VoiceSettings from './components/VoiceSettings'
import { POSE_DESCRIPTIONS } from './data/poseDescriptions'
import { useVoiceGuide } from './hooks/useVoiceGuide'
import { DEFAULT_VOICE_SETTINGS } from './hooks/useVoiceGuide'
import type { VoiceSettings as VoiceSettingsType } from './hooks/useVoiceGuide'
import { useTheme } from './hooks/useTheme'
import { useThrottledState } from './hooks/useThrottledState'
import { useOrientation } from './hooks/useOrientation'
import { POSE_REFERENCES, worstSeverity } from './poses/reference'
import WelcomePage from './components/WelcomePage'
import ChatBot from './components/ChatBot'
import { useChatStore } from './hooks/useChatStore'

type FramingState = 'cameraLoading' | 'notFramed' | 'partiallyFramed' | 'handsNotRaised' | 'fullyFramed'
type ExperiencePhase = 'welcome' | 'landing' | 'intro' | 'framing' | 'evaluating' | 'results'

const REQUIRED_LANDMARKS: Record<
  string,
  number
> = {
  nose: 0,
  l_shoulder: 11,
  r_shoulder: 12,
  l_elbow: 13,
  r_elbow: 14,
  l_wrist: 15,
  r_wrist: 16,
  l_hip: 23,
  r_hip: 24,
  l_knee: 25,
  r_knee: 26,
  l_ankle: 27,
  r_ankle: 28
}

function withinBoundsY(lm: Landmark) {
  return lm.y >= 0 && lm.y <= 1
}

function isVisible(lm: Landmark) {
  return lm.visibility > 0.6 && withinBoundsY(lm)
}

function computeFraming(landmarks: Landmark[] | null): { state: FramingState; message: string } {
  const initialMsg =
    'Stand fully within the frame. Raise both arms overhead and ensure your body is visible from fingertips to toes.'

  if (!landmarks || landmarks.length !== 33) {
    return { state: 'cameraLoading', message: initialMsg }
  }

  const requiredIdxs = Object.values(REQUIRED_LANDMARKS)
  let visibleCount = 0
  for (const idx of requiredIdxs) {
    const lm = landmarks[idx]
    if (lm && isVisible(lm)) visibleCount += 1
  }

  if (visibleCount === 0) {
    return { state: 'notFramed', message: initialMsg }
  }

  if (visibleCount < requiredIdxs.length) {
    return {
      state: 'partiallyFramed',
      message: 'Please step back slightly so your full body remains visible.'
    }
  }

  const nose = landmarks[REQUIRED_LANDMARKS.nose]
  const leftWrist = landmarks[REQUIRED_LANDMARKS.l_wrist]
  const rightWrist = landmarks[REQUIRED_LANDMARKS.r_wrist]
  const handsRaised = leftWrist.y < nose.y && rightWrist.y < nose.y

  if (!handsRaised) {
    return {
      state: 'handsNotRaised',
      message: 'Raise both arms straight above your head to complete framing.'
    }
  }

  return { state: 'fullyFramed', message: 'You are now framed correctly — you may begin your practice.' }
}

function newClientId(): string {
  return crypto.randomUUID?.() ?? String(Date.now())
}

export default function App() {
  const [experiencePhase, setExperiencePhase] = useState<ExperiencePhase>('welcome')
  const [userName, setUserName] = useState('')
  const [expectedPose, setExpectedPose] = useState<ExpectedPose>('Warrior II')
  const [userLevel] = useState<UserLevel>('beginner')
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>(DEFAULT_VOICE_SETTINGS)
  const { theme, toggle: toggleTheme } = useTheme()
  const chatStore = useChatStore(userName)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('laptop')
  const [layoutAutoDetected, setLayoutAutoDetected] = useState(true)
  const [activePanel, setActivePanel] = useState<'instructor' | 'self'>('self')
  const [evaluating, setEvaluating] = useState(false)

  // ── Orientation auto-detect ─────────────────────────────────────────────
  const { isMobile, isPortraitMobile } = useOrientation()

  // Auto-detect layout mode on first load (and when device changes), unless user overrode
  useEffect(() => {
    if (layoutAutoDetected) {
      setLayoutMode(isMobile ? 'mobile' : 'laptop')
    }
  }, [isMobile, layoutAutoDetected])

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutAutoDetected(false) // user explicitly chose
    setLayoutMode(mode)
  }

  // In mobile mode, show only one panel at a time with a toggle
  const showFlipButton = layoutMode === 'mobile'

  const [framingEnabled, setFramingEnabled] = useState(false)
  const [framingUiVisible, setFramingUiVisible] = useState(false)

  const [statusText, setStatusText] = useState('Press Start to evaluate once.')

  // Visible landmark count for the framing overlay
  const [visibleLandmarkCount, setVisibleLandmarkCount] = useState(0)

  const [alignment, setAlignment] = useThrottledState<AlignmentResponse>(
    {
      pose_match: 'partially_aligned',
      confidence: 'low',
      primary_focus_area: 'none',
      deviations: [],
      correction_message: 'Press Start to evaluate once.',
      score: null,
      correction_bullets: [],
      positive_observation: '',
      breath_cue: '',
      safety_note: null,
    },
    2
  )

  const clientIdRef = useRef<string>(newClientId())

  const { speak, speakFeedback, cancel: cancelVoice } = useVoiceGuide(voiceOn, voiceSettings)

  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8000'

  const [poseOptions, setPoseOptions] = useState<string[]>(() => POSE_REFERENCES.map((p) => p.pose))
  const [trainMediaByPose, setTrainMediaByPose] = useState<Record<string, TrainMedia[]>>({})

  useEffect(() => {
    let cancelled = false
    fetchTrainPoses({ baseUrl })
      .then((poses) => {
        if (cancelled) return
        if (!poses.length) return

        const options = poses.map((p) => p.pose)
        setPoseOptions(options)

        const map: Record<string, TrainMedia[]> = {}
        for (const p of poses) map[p.pose] = p.media
        setTrainMediaByPose(map)

        setExpectedPose((prev) => (options.includes(prev) ? prev : (options[0] as ExpectedPose)))
      })
      .catch(() => {
        // keep fallback list
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  const countdownTimerRef = useRef<number | null>(null)
  const latestLandmarksRef = useRef<Landmark[] | null>(null)
  const latestVisibilityRef = useRef<number>(0)
  const framingUiTimerRef = useRef<number | null>(null)

  const [framing, setFraming] = useThrottledState<{ state: FramingState; message: string }>(
    {
      state: 'cameraLoading',
      message:
        'Stand fully within the frame. Raise both arms overhead and ensure your body is visible from fingertips to toes.'
    },
    2
  )

  const alignedPulseTimerRef = useRef<number | null>(null)
  const [alignedPulseActive, setAlignedPulseActive] = useState(false)
  const [alignedPulseKey, setAlignedPulseKey] = useState(0)

  const severity: Severity | null = alignment.deviations.length
    ? worstSeverity(alignment.deviations)
    : null

  const isAnalyzing = running || evaluating
  const isFraming = framingEnabled

  const pageLayoutClass =
    layoutMode === 'laptop'
      ? 'grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2'
      : 'flex min-h-0 flex-1 flex-col'              // mobile: single full-screen panel

  const deviceFrame =
    layoutMode === 'mobile'
      ? 'relative mx-auto flex h-full w-full flex-col' // mobile: full width + relative for toggle positioning
      : 'flex h-full flex-col'

  // ── Auto-switch to camera view when evaluation starts ────────────────────
  useEffect(() => {
    if (experiencePhase === 'evaluating' && layoutMode === 'mobile') {
      setActivePanel('self')
    }
  }, [experiencePhase, layoutMode])

  // ── Voice intro when entering 'intro' phase ──────────────────────────────
  useEffect(() => {
    if (experiencePhase !== 'intro') return
    const desc = POSE_DESCRIPTIONS[expectedPose]
    if (desc) {
      speak(desc.introScript)
    }
  }, [experiencePhase, expectedPose, speak])

  // ── Voice framing prompt when entering 'framing' phase ───────────────────
  useEffect(() => {
    if (experiencePhase !== 'framing') return
    speak(`Now, please step into the camera frame. Match the ${expectedPose} reference pose shown below. Once your body is detected, a 10 second countdown will begin automatically.`)
  }, [experiencePhase, expectedPose, speak])

  // ── Handlers for experience phase transitions ─────────────────────────────
  function handleWelcomeEnter(name: string) {
    setUserName(name)
    setExperiencePhase('landing')
  }

  function handleSelectPose(pose: string) {
    cancelVoice()
    stopSession()
    setExpectedPose(pose as ExpectedPose)
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('intro')
  }

  function handleIntroNext() {
    cancelVoice()
    setExperiencePhase('framing')
  }

  function handleFramingReady() {
    cancelVoice()
    setExperiencePhase('evaluating')
    startSession()
  }

  function handleBackToLanding() {
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('landing')
  }

  function handleTryAgain() {
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('framing')
  }

  function handleTryAnother() {
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('landing')
  }

  function handleEndSession() {
    cancelVoice()
    stopSession()
    chatStore.addSessionSummary()
    chatStore.setChatOpen(true)
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('landing')
  }

  function resetAlignmentState() {
    setAlignment({
      pose_match: 'partially_aligned',
      confidence: 'low',
      primary_focus_area: 'none',
      deviations: [],
      correction_message: 'Hold the pose. We will evaluate once.',
      score: null,
      correction_bullets: [],
      positive_observation: '',
      breath_cue: '',
      safety_note: null,
    })
    setStatusText('Press Start to evaluate once.')
  }

  function runCountdownThenEvaluate() {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    setCountdown(3)
    setRunning(true)
    setStatusText('Hold the pose. Evaluating in 3…')

    const t = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(t)
          countdownTimerRef.current = null
          setStatusText('Evaluating… (one-time)')
          window.setTimeout(() => {
            void doEvaluate().finally(() => {
              setRunning(false)
              setStatusText('Feedback ready.')
            })
          }, 250)
          return 0
        }
        setStatusText(`Hold the pose. Evaluating in ${c - 1}…`)
        return c - 1
      })
    }, 1000)

    countdownTimerRef.current = t
  }

  function startSession() {
    clientIdRef.current = newClientId()
    resetAlignmentState()

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    // Start evaluation immediately. Framing is an on-demand feature via the Reframe button.
    setFramingEnabled(false)
    setFramingUiVisible(false)
    if (framingUiTimerRef.current) {
      window.clearTimeout(framingUiTimerRef.current)
      framingUiTimerRef.current = null
    }
    runCountdownThenEvaluate()
  }

  function stopSession() {
    setFramingEnabled(false)
    setFramingUiVisible(false)
    if (framingUiTimerRef.current) {
      window.clearTimeout(framingUiTimerRef.current)
      framingUiTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    setCountdown(0)
    setRunning(false)
    setStatusText('Paused.')
  }

  function reframeOnce() {
    setFramingEnabled(true)
    setFramingUiVisible(true)
    if (framingUiTimerRef.current) {
      window.clearTimeout(framingUiTimerRef.current)
      framingUiTimerRef.current = null
    }
    setFraming(computeFraming(latestLandmarksRef.current))
    setStatusText('Framing…')
  }

  async function doEvaluate() {
    const landmarks = latestLandmarksRef.current
    if (!landmarks) {
      setAlignment({
        pose_match: 'misaligned',
        confidence: 'low',
        primary_focus_area: 'none',
        deviations: [],
        correction_message: 'No pose detected yet. Press Start and hold the pose in view.',
        score: null,
        correction_bullets: [],
        positive_observation: '',
        breath_cue: '',
        safety_note: null,
      })
      setStatusText('No landmarks detected.')
      return
    }

    const visibilityMean = latestVisibilityRef.current
    if (visibilityMean < 0.5) {
      setAlignment({
        pose_match: 'misaligned',
        confidence: 'low',
        primary_focus_area: 'none',
        deviations: [],
        correction_message: 'Ensure full body is visible.',
        score: null,
        correction_bullets: [],
        positive_observation: '',
        breath_cue: '',
        safety_note: null,
      })
      setStatusText('Paused: low visibility.')
      return
    }

    try {
      setEvaluating(true)
      setStatusText('Analyzing posture…')
      const resp = await evaluateAlignment({
        baseUrl,
        clientId: clientIdRef.current,
        expectedPose,
        userLevel,
        landmarks
      })
      setAlignment(resp)
      setStatusText('Feedback ready.')

      // Push pose result to chatbot
      chatStore.addPoseResult({
        pose: expectedPose,
        score: resp.score ?? null,
        correctionMessage: resp.correction_message,
        correctionBullets: resp.correction_bullets ?? [],
        positiveObservation: resp.positive_observation ?? '',
        breathCue: resp.breath_cue ?? '',
        safetyNote: resp.safety_note ?? null,
      })

      const alignedNow = resp.pose_match === 'aligned' && resp.primary_focus_area === 'none'
      if (alignedNow) {
        if (alignedPulseTimerRef.current) window.clearTimeout(alignedPulseTimerRef.current)
        setAlignedPulseActive(true)
        setAlignedPulseKey((k) => k + 1)
        alignedPulseTimerRef.current = window.setTimeout(() => {
          setAlignedPulseActive(false)
          alignedPulseTimerRef.current = null
        }, 750)
      }

      // Speak the entire feedback, then transition to results phase
      const feedbackParts = [
        resp.positive_observation,
        ...(resp.correction_bullets ?? []),
        resp.breath_cue,
        resp.safety_note,
      ].filter(Boolean)
      const feedbackText = feedbackParts.length > 0
        ? feedbackParts.join('. ')
        : resp.correction_message

      if (feedbackText) {
        speakFeedback(feedbackText, () => {
          // After feedback is fully read, ask user what they want to do
          setExperiencePhase('results')
          speak('Would you like to try this pose again, or try a different pose?')
        })
      } else {
        // No feedback text — go straight to results
        setExperiencePhase('results')
        speak('Would you like to try this pose again, or try a different pose?')
      }
    } catch (e) {
      setAlignment({
        ...alignment,
        confidence: 'low',
        correction_message: 'Backend unavailable.',
        score: null,
        correction_bullets: [],
        positive_observation: '',
        breath_cue: '',
        safety_note: null,
      })
      setStatusText('Backend unavailable.')
    } finally {
      setEvaluating(false)
    }
  }

  // ── Resolve first media src for the selected pose (for overlays) ─────────
  const poseMediaSrc: string | null = (() => {
    // Prefer the static frontend image from POSE_REFERENCES (always available)
    const ref = POSE_REFERENCES.find((p) => p.pose === expectedPose)
    if (ref?.src) return ref.src
    // Fallback to API-provided media
    const media = trainMediaByPose[expectedPose]?.[0]
    if (media) {
      return media.src.startsWith('http') ? media.src : `${baseUrl}${media.src}`
    }
    return null
  })()

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-neutral-950 dark:text-slate-50">
      {/* ── Welcome page ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'welcome' && (
          <div className="absolute inset-0 z-50">
            <WelcomePage onEnter={handleWelcomeEnter} />
          </div>
        )}
      </AnimatePresence>

      {/* ── Landing page ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'landing' && (
          <div className="absolute inset-0 z-50 overflow-y-auto">
            {/* Voice settings + theme toggle */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-2.5 text-sm text-slate-600 backdrop-blur transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <VoiceSettings
                voiceOn={voiceOn}
                onToggleVoice={setVoiceOn}
                settings={voiceSettings}
                onChangeSettings={setVoiceSettings}
                onPreview={() => speak('Namaste. Welcome to your practice.')}
              />
            </div>
            <LandingPage
              poses={poseOptions}
              onSelectPose={handleSelectPose}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Intro overlay (fixed, full-screen) ─────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'intro' && (
          <PoseIntroOverlay
            pose={expectedPose}
            mediaSrc={poseMediaSrc}
            description={POSE_DESCRIPTIONS[expectedPose]}
            phase="intro"
            visibleLandmarkCount={visibleLandmarkCount}
            voiceEnabled={voiceOn}
            onNext={handleIntroNext}
            onBack={handleTryAnother}
          />
        )}
      </AnimatePresence>

      {/* ── Practice area (framing + evaluating phases) ────────────────────── */}
      {experiencePhase !== 'welcome' && experiencePhase !== 'landing' && experiencePhase !== 'intro' && (
        <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3">
          {/* Header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToLanding}
                className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                ← Poses
              </button>
              <div>
                <div className="text-lg font-semibold tracking-tight">{expectedPose}</div>
                {POSE_DESCRIPTIONS[expectedPose] && (
                  <div className="text-xs italic text-emerald-400">
                    {POSE_DESCRIPTIONS[expectedPose].sanskritName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LayoutToggle mode={layoutMode} onChange={handleLayoutChange} autoDetected={layoutAutoDetected} />

              {experiencePhase === 'evaluating' && (
                <>
                  <button
                    type="button"
                    onClick={() => (running || isFraming ? stopSession() : startSession())}
                    className="h-10 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 transition-colors duration-300 ease-in-out hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    {running ? 'Pause' : isFraming ? 'Cancel' : 'Start Evaluation'}
                  </button>

                  <button
                    type="button"
                    onClick={reframeOnce}
                    disabled={isAnalyzing || isFraming}
                    className="h-10 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 transition-colors duration-300 ease-in-out hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    Reframe
                  </button>
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={voiceOn}
                  onChange={(e) => setVoiceOn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-slate-100 dark:border-white/20 dark:bg-white/10"
                />
                🔊 Voice
              </label>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {/* End Session */}
              <button
                type="button"
                onClick={handleEndSession}
                className="h-10 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                End Session
              </button>
            </div>
          </div>

          {/* Panels */}
          <div className="relative flex-1 min-h-0">
            <div className={`${deviceFrame} h-full`}>
              <div className={`${pageLayoutClass} min-h-0 flex-1`}>
                {/* In portrait-mobile: show only active panel. Otherwise show both. */}
                {(!showFlipButton || activePanel === 'instructor') && (
                  <InstructorPanel
                    baseUrl={baseUrl}
                    expectedPose={expectedPose}
                    primaryFocusArea={alignment.primary_focus_area}
                    severity={severity}
                    alignedPulseActive={alignedPulseActive}
                    alignedPulseKey={alignedPulseKey}
                    trainMedia={trainMediaByPose[expectedPose]}
                  />
                )}
                {(!showFlipButton || activePanel === 'self') && (
                  <UserCameraPanel
                    running={running}
                    countdown={countdown}
                    statusText={statusText}
                    confidence={alignment.confidence}
                    score={alignment.score}
                    isAnalyzing={isAnalyzing}
                    feedbackMessage={alignment.correction_message}
                    correctionBullets={alignment.correction_bullets}
                    positiveObservation={alignment.positive_observation}
                    breathCue={alignment.breath_cue}
                    safetyNote={alignment.safety_note}
                    framingEnabled={framingUiVisible}
                    framingState={framing.state}
                    framingMessage={framing.message}
                    isPortrait={isPortraitMobile}
                    onLandmarks={(lms, visMean) => {
                      latestLandmarksRef.current = lms
                      latestVisibilityRef.current = visMean

                      // Track visible count for framing overlay
                      if (lms) {
                        const count = lms.filter((lm) => lm.visibility > 0.5).length
                        setVisibleLandmarkCount(count)
                      }

                      if (framingEnabled) {
                        const next = computeFraming(lms)
                        setFraming(next)
                        if (next.state === 'fullyFramed') {
                          setFramingEnabled(false)
                          if (framingUiTimerRef.current) window.clearTimeout(framingUiTimerRef.current)
                          framingUiTimerRef.current = window.setTimeout(() => {
                            setFramingUiVisible(false)
                            framingUiTimerRef.current = null
                          }, 2000)
                        }
                      }
                    }}
                  />
                )}
              </div>

              {/* View toggle — visible in mobile mode */}
              {showFlipButton && (
                <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 overflow-hidden rounded-full border border-slate-200/80 bg-white/95 shadow-2xl shadow-black/30 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/95 dark:shadow-black/50" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                  <button
                    type="button"
                    onClick={() => setActivePanel('instructor')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                      activePanel === 'instructor'
                        ? 'bg-emerald-500 text-white shadow-inner'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    📐 Reference
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePanel('self')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                      activePanel === 'self'
                        ? 'bg-emerald-500 text-white shadow-inner'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    📷 My View
                  </button>
                </div>
              )}
            </div>

            {/* Framing overlay */}
            <AnimatePresence>
              {experiencePhase === 'framing' && (
                <PoseIntroOverlay
                  pose={expectedPose}
                  mediaSrc={poseMediaSrc}
                  description={POSE_DESCRIPTIONS[expectedPose]}
                  phase="framing"
                  visibleLandmarkCount={visibleLandmarkCount}
                  voiceEnabled={voiceOn}
                  onNext={handleFramingReady}
                />
              )}
            </AnimatePresence>

            {/* Results overlay */}
            <AnimatePresence>
              {experiencePhase === 'results' && (
                <PoseIntroOverlay
                  pose={expectedPose}
                  mediaSrc={poseMediaSrc}
                  description={POSE_DESCRIPTIONS[expectedPose]}
                  phase="results"
                  visibleLandmarkCount={visibleLandmarkCount}
                  voiceEnabled={voiceOn}
                  onNext={handleTryAgain}
                  onTryAnother={handleTryAnother}
                  score={alignment.score}
                  feedbackSummary={alignment.correction_message}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Chatbot ──────────────────────────────────────────────────────── */}
      {experiencePhase !== 'welcome' && (
        <ChatBot
          messages={chatStore.messages}
          unreadCount={chatStore.unreadCount}
          open={chatStore.chatOpen}
          onToggle={chatStore.toggleChat}
          onSendMessage={chatStore.addUserMessage}
          onBotReply={(text) => chatStore.addBotMessage(text, false)}
          userName={userName}
        />
      )}
    </div>
  )
}

