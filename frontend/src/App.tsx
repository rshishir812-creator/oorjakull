import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { AlignmentResponse, BreathworkProtocol, ExpectedPose, Landmark, Severity, TrainMedia, UserLevel } from './api/client'
import { evaluateAlignment, fetchTrainPoses } from './api/client'
import InstructorPanel from './components/InstructorPanel'
import LandingPage from './components/LandingPage'
import AppSectionTabs from './components/AppSectionTabs'
import PoseIntroOverlay from './components/PoseIntroOverlay'
import UserCameraPanel from './components/UserCameraPanel'
import VoiceSettings from './components/VoiceSettings'
import { POSE_DESCRIPTIONS } from './data/poseDescriptions'
import { useVoiceGuide } from './hooks/useVoiceGuide'
import { useVoiceCommand } from './hooks/useVoiceCommand'
import { DEFAULT_VOICE_SETTINGS } from './hooks/useVoiceGuide'
import type { VoiceSettings as VoiceSettingsType } from './hooks/useVoiceGuide'
import { useTheme } from './hooks/useTheme'
import { useThrottledState } from './hooks/useThrottledState'
import { useOrientation } from './hooks/useOrientation'
import { POSE_REFERENCES, worstSeverity } from './poses/reference'
import WelcomePage from './components/WelcomePage'
import ChatBot from './components/ChatBot'
import { useChatStore } from './hooks/useChatStore'
import SequenceCompleteOverlay from './components/SequenceCompleteOverlay'
import { SEQUENCES } from './data/sequences'
import type { PoseSequence, SequenceStep } from './data/sequences'
import BreathworkPage from './pages/BreathworkPage'
import BreathworkSession from './pages/BreathworkSession'

// Safety architecture imports
import { useSafety } from './contexts/SafetyContext'
import type { UserHealthInput } from './types/health'
import DisclaimerScreen from './components/DisclaimerScreen'
import HealthQuestionnaire from './components/HealthQuestionnaire'
import SessionBriefing from './components/SessionBriefing'
import PainCheckButton from './components/PainCheckButton'
import RiskWarningBanner from './components/RiskWarningBanner'

// Credit system imports
import { useCredits } from './hooks/useCredits'
import CreditIndicator from './components/CreditIndicator'
import SignInPrompt from './components/SignInPrompt'
import UpgradePrompt from './components/UpgradePrompt'

type FramingState = 'cameraLoading' | 'notFramed' | 'partiallyFramed' | 'fullyFramed'
type ExperiencePhase = 'welcome' | 'landing' | 'disclaimer' | 'health-check' | 'session-briefing' | 'intro' | 'framing' | 'evaluating' | 'results' | 'sequence-complete' | 'breathwork-session'

// ── Body-region → landmark index mapping for granular framing guidance ──────
const BODY_REGION_LANDMARKS: Array<{ region: string; label: string; indices: number[] }> = [
  { region: 'head',             label: 'your head',              indices: [0]       },
  { region: 'left_shoulder',    label: 'your left shoulder',     indices: [11]      },
  { region: 'right_shoulder',   label: 'your right shoulder',    indices: [12]      },
  { region: 'left_arm',         label: 'your left arm',          indices: [13, 15]  },
  { region: 'right_arm',        label: 'your right arm',         indices: [14, 16]  },
  { region: 'left_fingertips',  label: 'your left fingertips',   indices: [17, 19]  },
  { region: 'right_fingertips', label: 'your right fingertips',  indices: [18, 20]  },
  { region: 'left_hip',         label: 'your left hip',          indices: [23]      },
  { region: 'right_hip',        label: 'your right hip',         indices: [24]      },
  { region: 'left_knee',        label: 'your left knee',         indices: [25]      },
  { region: 'right_knee',       label: 'your right knee',        indices: [26]      },
  { region: 'left_foot',        label: 'your left foot',         indices: [27, 29, 31] },
  { region: 'right_foot',       label: 'your right foot',        indices: [28, 30, 32] },
]

// Legacy index map (used for framing-ready check)
const REQUIRED_LANDMARKS: Record<string, number> = {
  nose: 0, l_shoulder: 11, r_shoulder: 12, l_elbow: 13, r_elbow: 14,
  l_wrist: 15, r_wrist: 16, l_hip: 23, r_hip: 24, l_knee: 25, r_knee: 26,
  l_ankle: 27, r_ankle: 28,
}

function withinBoundsY(lm: Landmark) {
  return lm.y >= 0 && lm.y <= 1
}

function isVisible(lm: Landmark) {
  return lm.visibility > 0.6 && withinBoundsY(lm)
}

/** Check which body regions are missing from the frame. */
function getMissingRegions(landmarks: Landmark[]): string[] {
  const missing: string[] = []
  for (const { label, indices } of BODY_REGION_LANDMARKS) {
    // Region is "missing" if none of its landmark indices are visible
    const anyVisible = indices.some((i) => {
      const lm = landmarks[i]
      return lm && isVisible(lm)
    })
    if (!anyVisible) missing.push(label)
  }
  return missing
}

interface FramingResult {
  state: FramingState
  message: string
  missingParts: string[]
}

function computeFraming(landmarks: Landmark[] | null): FramingResult {
  const initialMsg =
    'Stand fully within the frame. Raise both arms overhead and ensure your body is visible from fingertips to toes.'

  if (!landmarks || landmarks.length !== 33) {
    return { state: 'cameraLoading', message: initialMsg, missingParts: [] }
  }

  const requiredIdxs = Object.values(REQUIRED_LANDMARKS)
  let visibleCount = 0
  for (const idx of requiredIdxs) {
    const lm = landmarks[idx]
    if (lm && isVisible(lm)) visibleCount += 1
  }

  if (visibleCount === 0) {
    return { state: 'notFramed', message: initialMsg, missingParts: [] }
  }

  const missingParts = getMissingRegions(landmarks)

  if (visibleCount < requiredIdxs.length) {
    const specific = missingParts.length > 0
      ? `I can't see ${missingParts.slice(0, 3).join(', ')}. Please adjust so your full body is visible.`
      : 'Please step back slightly so your full body remains visible.'
    return { state: 'partiallyFramed', message: specific, missingParts }
  }

  return { state: 'fullyFramed', message: 'You are now framed correctly — you may begin your practice.', missingParts: [] }
}

// ── Framing voice coach: adaptive-cooldown, stability-gated prompts ─────────

type FramingCoachPrompt = {
  text: string
  severity: 'critical' | 'partial' | 'gentle'
}

function buildFramingCoachPrompt(result: FramingResult): FramingCoachPrompt | null {
  switch (result.state) {
    case 'notFramed':
      return {
        text: 'I am not able to see your full body. Please step in front of the camera.',
        severity: 'critical',
      }
    case 'partiallyFramed':
      return {
        text: 'I am not able to see your full body. Please step back a little.',
        severity: 'partial',
      }
    case 'fullyFramed':
      return null
    default:
      return null
  }
}

/** Adaptive cooldown based on prompt severity — kept generous to avoid chatter */
function framingCooldown(severity: 'critical' | 'partial' | 'gentle'): number {
  switch (severity) {
    case 'critical': return 10000  // say once, wait 10s before repeating
    case 'partial':  return 10000  // same — user needs time to adjust
    case 'gentle':   return 10000
  }
}

function newClientId(): string {
  return crypto.randomUUID?.() ?? String(Date.now())
}

const STATIC_VOICE_PROMPTS_TO_PREFETCH: string[] = [
  'Namaste. Welcome to your practice.',
  'Please step into the camera frame so your full body is visible.',
  'I am not able to see your full body. Please step in front of the camera.',
  'I am not able to see your full body. Please step back a little.',
  'Hold the pose steady. I am going to evaluate your alignment.',
  'Done! You can relax and come back to a comfortable standing position.',
  'Wonderful! You have completed the full sequence. Say next to finish, or say again to retry this pose.',
  'Would you like to try this pose again, or try a different pose? Say again to retry, or say next for another pose.',
]

export default function App() {
  const safety = useSafety()
  const [experiencePhase, setExperiencePhase] = useState<ExperiencePhase>('welcome')
  const [healthLoading, setHealthLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'yoga' | 'breathwork'>('yoga')
  const [userName, setUserName] = useState('')
  const [signedInWithGoogle, setSignedInWithGoogle] = useState(false)
  const [expectedPose, setExpectedPose] = useState<ExpectedPose>('Warrior II')
  const [userLevel] = useState<UserLevel>('beginner')
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>(DEFAULT_VOICE_SETTINGS)
  const { theme, toggle: toggleTheme } = useTheme()
  const chatStore = useChatStore(userName)
  const [activePanel, setActivePanel] = useState<'instructor' | 'self'>('self')
  const [cameraFullScreen, setCameraFullScreen] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  // ── Credit system state ──────────────────────────────────────────────────
  const { credits, isUnlimited, refreshCredits } = useCredits(safety.googleSub || null)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  // ── Sequence state ─────────────────────────────────────────────────────
  const [isInSequence, setIsInSequence] = useState(false)
  const [sequenceId, setSequenceId] = useState<string>('')
  const [sequenceName, setSequenceName] = useState<string>('')
  const [sequencePoses, setSequencePoses] = useState<SequenceStep[]>([])
  const [sequenceIndex, setSequenceIndex] = useState(0)
  const [sequenceResults, setSequenceResults] = useState<Array<{ pose: string; score: number | null; sideNote?: string }>>([])
  const [selectedBreathworkProtocol, setSelectedBreathworkProtocol] = useState<BreathworkProtocol | null>(null)
  const [breathworkToast, setBreathworkToast] = useState<string | null>(null)

  const { isPortraitMobile } = useOrientation()

  // Mobile/laptop switcher removed on web; keep split-view layout.
  const showFlipButton = false

  const [framingEnabled, setFramingEnabled] = useState(false)
  const [framingUiVisible, setFramingUiVisible] = useState(false)

  const [statusText, setStatusText] = useState('Press Start to evaluate once.')

  // Visible landmark count for the framing overlay
  const [visibleLandmarkCount, setVisibleLandmarkCount] = useState(0)

  // ── Framing sub-phase: detecting → posing → countdown ─────────────────────
  const [framingSubPhase, setFramingSubPhase] = useState<'detecting' | 'posing' | 'countdown'>('detecting')
  // Ref mirrors state synchronously so rapid onLandmarks frames can't re-enter transitions
  const framingSubPhaseRef = useRef<'detecting' | 'posing' | 'countdown'>('detecting')
  const posingStableCountRef = useRef(0)     // consecutive frames where body is fully framed during 'posing'
  const framingAcquireStableCountRef = useRef(0) // consecutive fullyFramed samples before detect->pose
  const framingLoseStableCountRef = useRef(0)    // consecutive non-fullyFramed samples before pose->detect
  const POSING_STABLE_THRESHOLD = 4          // ~2 seconds at 2 Hz before starting countdown
  const FRAMING_ACQUIRE_THRESHOLD = 2
  const FRAMING_LOSE_THRESHOLD = 2

  /** Set sub-phase in both React state (for UI) and ref (for synchronous guards) */
  function setSubPhase(phase: 'detecting' | 'posing' | 'countdown') {
    framingSubPhaseRef.current = phase
    setFramingSubPhase(phase)
  }

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

  const { speak, speakFeedback, prefetch, cancel: cancelVoice } = useVoiceGuide(voiceOn, voiceSettings)
  const {
    startListening: startVoiceCommandListening,
    stopListening: stopVoiceCommandListening,
    listening: isVoiceCommandListening,
    supported: voiceCommandSupported,
  } = useVoiceCommand()

  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, '').replace(/\/$/, '') ?? 'http://localhost:8000'

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

  // Warm persistent TTS cache for high-frequency static prompts.
  useEffect(() => {
    if (!voiceOn) return
    prefetch(STATIC_VOICE_PROMPTS_TO_PREFETCH)
  }, [voiceOn, prefetch])

  const countdownTimerRef = useRef<number | null>(null)
  const latestLandmarksRef = useRef<Landmark[] | null>(null)
  const latestVisibilityRef = useRef<number>(0)
  const framingUiTimerRef = useRef<number | null>(null)

  const [framing, setFraming] = useThrottledState<FramingResult>(
    {
      state: 'cameraLoading',
      message:
        'Stand fully within the frame. Raise both arms overhead and ensure your body is visible from fingertips to toes.',
      missingParts: [],
    },
    2
  )

  // ── Framing voice-coach refs ──────────────────────────────────────────────
  const lastFramingPromptRef = useRef<string>('')
  const lastFramingTsRef = useRef<number>(0)
  const framingStableCountRef = useRef<number>(0)
  const lastFramingStateRef = useRef<FramingState>('cameraLoading')
  const FRAMING_STABILITY_THRESHOLD = 2 // require N consecutive same-state samples before speaking

  /** Evaluate whether to speak a framing coaching prompt (stability + cooldown gated). */
  function maybeCoachFraming(result: FramingResult) {
    if (experiencePhase !== 'framing') return

    // Stability gate: only speak after N consecutive samples in the same state
    if (result.state === lastFramingStateRef.current) {
      framingStableCountRef.current += 1
    } else {
      framingStableCountRef.current = 1
      lastFramingStateRef.current = result.state
    }
    const threshold = result.state === 'notFramed' ? 1 : FRAMING_STABILITY_THRESHOLD
    if (framingStableCountRef.current < threshold) return

    const prompt = buildFramingCoachPrompt(result)
    if (!prompt) return

    // Dedupe gate: don't repeat exact same text
    if (prompt.text === lastFramingPromptRef.current) return

    // Cooldown gate: adaptive by severity
    const now = Date.now()
    const cooldown = framingCooldown(prompt.severity)
    if (now - lastFramingTsRef.current < cooldown) return

    lastFramingPromptRef.current = prompt.text
    lastFramingTsRef.current = now
    speakFeedback(prompt.text)
  }

  function advanceFramingSubPhase(fr: FramingResult) {
    const sub = framingSubPhaseRef.current

    if (sub === 'detecting') {
      if (fr.state === 'fullyFramed') {
        framingAcquireStableCountRef.current += 1
        if (framingAcquireStableCountRef.current >= FRAMING_ACQUIRE_THRESHOLD) {
          setSubPhase('posing')
          posingStableCountRef.current = 0
          framingLoseStableCountRef.current = 0
          framingAcquireStableCountRef.current = 0
          cancelVoice()
          speak(`I can see you. Now get into the ${expectedPose} pose and hold steady.`)
        }
      } else {
        framingAcquireStableCountRef.current = 0
        maybeCoachFraming(fr)
      }
      return
    }

    if (sub === 'posing') {
      if (fr.state !== 'fullyFramed') {
        framingLoseStableCountRef.current += 1
        if (framingLoseStableCountRef.current >= FRAMING_LOSE_THRESHOLD) {
          setSubPhase('detecting')
          posingStableCountRef.current = 0
          framingAcquireStableCountRef.current = 0
          framingLoseStableCountRef.current = 0
        }
      } else {
        framingLoseStableCountRef.current = 0
        posingStableCountRef.current += 1
        if (posingStableCountRef.current >= POSING_STABLE_THRESHOLD) {
          setSubPhase('countdown')
          cancelVoice()
          speak('Hold the pose steady. I am going to evaluate your alignment.')
        }
      }
      return
    }

    // countdown
    if (fr.state !== 'fullyFramed') {
      setSubPhase('posing')
      posingStableCountRef.current = 0
      framingLoseStableCountRef.current = 0
      cancelVoice()
      speakFeedback('I lost you. Please get back into the pose.')
    }
  }

  const alignedPulseTimerRef = useRef<number | null>(null)
  const [alignedPulseActive, setAlignedPulseActive] = useState(false)
  const [alignedPulseKey, setAlignedPulseKey] = useState(0)

  const severity: Severity | null = alignment.deviations.length
    ? worstSeverity(alignment.deviations)
    : null

  const isAnalyzing = running || evaluating
  const isFraming = framingEnabled

  const pageLayoutClass = 'grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2'

  const deviceFrame = 'flex h-full flex-col'

  // ── Auto-switch to camera view when evaluation starts ────────────────────
  useEffect(() => {
    if (experiencePhase === 'evaluating') {
      setActivePanel('self')
    }
  }, [experiencePhase])

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
    // Reset framing-coach state for a fresh start
    lastFramingPromptRef.current = ''
    lastFramingTsRef.current = 0
    framingStableCountRef.current = 0
    lastFramingStateRef.current = 'cameraLoading'
    posingStableCountRef.current = 0
    framingAcquireStableCountRef.current = 0
    framingLoseStableCountRef.current = 0
    setSubPhase('detecting')
    speak(`Please step into the camera frame so your full body is visible.`)
  }, [experiencePhase, expectedPose, speak])

  // ── Handlers for experience phase transitions ─────────────────────────────
  function handleWelcomeEnter(name: string) {
    setUserName(name)
    setActiveSection('yoga')
    // If authenticated but no profile yet, show disclaimer → health check
    if (safety.isAuthenticated && !safety.hasProfile) {
      setExperiencePhase('disclaimer')
    } else {
      setExperiencePhase('landing')
    }
  }

  // ── Safety flow handlers ──────────────────────────────────────────────────
  function handleDisclaimerAccept() {
    setExperiencePhase('health-check')
  }

  function handleDisclaimerDecline() {
    // User declined medical disclaimer — proceed as unauthenticated guest
    safety.signOut()
    setSignedInWithGoogle(false)
    setExperiencePhase('landing')
  }

  async function handleHealthSubmit(input: UserHealthInput) {
    if (!safety.isAuthenticated) {
      setExperiencePhase('landing')
      return
    }
    setHealthLoading(true)
    try {
      await safety.submitHealthInput(input)
    } catch (err) {
      console.error('Health profile submission failed:', err)
    } finally {
      setHealthLoading(false)
      setExperiencePhase('landing')
    }
  }

  function handleHealthBack() {
    setExperiencePhase('disclaimer')
  }

  function handleSessionBriefingStart() {
    setExperiencePhase('intro')
  }

  function handleSessionBriefingBack() {
    setExperiencePhase('landing')
    safety.resetSession()
  }

  async function handleGoogleSignIn(name: string, credential?: string) {
    setSignedInWithGoogle(true)
    setUserName(name)            // Set immediately so WelcomePage shows "Welcome back"
    setAuthLoading(true)         // Show spinner instead of Google button
    let authResult = { isAuthenticated: false, hasProfile: false }
    if (credential) {
      try {
        authResult = await safety.signIn(credential)
      } catch {
        console.warn('Backend auth failed — safety features may be limited')
      }
    }
    setAuthLoading(false)
    setActiveSection('yoga')
    if (authResult.isAuthenticated && !authResult.hasProfile) {
      setExperiencePhase('disclaimer')
    } else {
      setExperiencePhase('landing')
    }
  }

  function handleSignOut() {
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setSignedInWithGoogle(false)
    setUserName('')
    safety.signOut()
    setExperiencePhase('welcome')
  }

  function handleBackToHome() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setActiveSection('yoga')
    setExperiencePhase('welcome')
  }

  function handleSectionChange(section: 'yoga' | 'breathwork') {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    setBreathworkToast(null)
    setActiveSection(section)
    if (experiencePhase !== 'landing') {
      resetAlignmentState()
      setVisibleLandmarkCount(0)
      setExperiencePhase('landing')
    }
  }

  function handleStartBreathwork(protocol: BreathworkProtocol) {
    cancelVoice()
    stopSession()
    setSelectedBreathworkProtocol(protocol)
    setExperiencePhase('breathwork-session')
  }

  function handleExitBreathworkSession(toastMessage?: string) {
    setSelectedBreathworkProtocol(null)
    setBreathworkToast(toastMessage ?? null)
    setActiveSection('breathwork')
    setExperiencePhase('landing')
  }

  function handleSelectPose(pose: string) {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    setExpectedPose(pose as ExpectedPose)
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setIsInSequence(false)
    setExperiencePhase('intro')
  }

  function handleIntroNext() {
    cancelVoice()
    setExperiencePhase('framing')
  }
  function handleSelectSequence(seq: PoseSequence) {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setIsInSequence(true)
    setSequenceId(seq.id)
    setSequenceName(seq.name)
    setSequencePoses(seq.steps)
    setSequenceIndex(0)
    setSequenceResults([])
    setExpectedPose(seq.steps[0].pose as ExpectedPose)
    setExperiencePhase('intro')
  }

  function handleNextInSequence() {
    stopVoiceCommandListening()
    const currentResult = {
      pose: expectedPose,
      score: alignment.score ?? null,
      sideNote: sequencePoses[sequenceIndex]?.sideNote,
    }
    const nextIndex = sequenceIndex + 1
    const nextResults = [...sequenceResults, currentResult]
    setSequenceResults(nextResults)
    if (nextIndex >= sequencePoses.length) {
      cancelVoice()
      stopSession()
      resetAlignmentState()
      setVisibleLandmarkCount(0)
      setExperiencePhase('sequence-complete')
    } else {
      cancelVoice()
      stopSession()
      resetAlignmentState()
      setVisibleLandmarkCount(0)
      setSequenceIndex(nextIndex)
      setExpectedPose(sequencePoses[nextIndex].pose as ExpectedPose)
      setExperiencePhase('intro')
    }
  }

  function handleExitSequence() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setIsInSequence(false)
    setSequenceResults([])
    setSequenceIndex(0)
    setExperiencePhase('landing')
  }

  function handleRestartSequence() {
    const seq = SEQUENCES.find((s) => s.id === sequenceId)
    if (!seq) { handleExitSequence(); return }
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setSequenceIndex(0)
    setSequenceResults([])
    setSequencePoses(seq.steps)
    setExpectedPose(seq.steps[0].pose as ExpectedPose)
    setExperiencePhase('intro')
  }


  function handleFramingReady() {
    cancelVoice()
    setExperiencePhase('evaluating')
    startSession()
  }

  function handleBackToLanding() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('landing')
  }

  function handleTryAgain() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setExperiencePhase('framing')
  }

  function handleTryAnother() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setIsInSequence(false)
    setSequenceResults([])
    setSequenceIndex(0)
    setExperiencePhase('landing')
  }

  function handleEndSession() {
    stopVoiceCommandListening()
    cancelVoice()
    stopSession()
    chatStore.addSessionSummary()
    chatStore.setChatOpen(true)
    resetAlignmentState()
    setVisibleLandmarkCount(0)
    setIsInSequence(false)
    setSequenceResults([])
    setSequenceIndex(0)
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

  function startResultsVoiceCommands() {
    if (!voiceOn || !voiceCommandSupported) return

    startVoiceCommandListening((action) => {
      if (action === 'again') {
        handleTryAgain()
        return
      }
      if (action === 'next') {
        if (isInSequence) {
          handleNextInSequence()
        } else {
          handleTryAnother()
        }
        return
      }
      if (action === 'exit') {
        if (isInSequence) {
          handleExitSequence()
        } else {
          handleBackToLanding()
        }
      }
    })
  }

  useEffect(() => {
    if (experiencePhase !== 'results') {
      stopVoiceCommandListening()
    }
  }, [experiencePhase, stopVoiceCommandListening])

  function runCountdownThenEvaluate() {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    setCountdown(3)
    setRunning(true)
    setStatusText('Hold the pose. Evaluating in 3…')

    // Short cue — the main hold prompt already fired at the 10-second countdown start
    speakFeedback('Evaluating now. Stay still.')

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
        landmarks,
        googleSub: safety.googleSub || null,
      })

      // ── Handle guest gate response ──────────────────────────────────────
      if (resp.is_guest) {
        setShowSignInPrompt(true)
        setStatusText('Sign in for AI feedback.')
        setEvaluating(false)
        return
      }

      // ── Handle credits exhausted response ───────────────────────────────
      if (resp.credits_exhausted) {
        setShowUpgradePrompt(true)
        setStatusText('Credits exhausted.')
        setEvaluating(false)
        await refreshCredits()
        return
      }

      // ── Refresh credit balance after successful evaluation ──────────────
      refreshCredits()

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

      const afterPrompt = isInSequence
        ? sequenceIndex + 1 < sequencePoses.length
          ? `Well done! Next up is ${sequencePoses[sequenceIndex + 1].pose}. Say next to continue, or say again to retry this pose.`
          : 'Wonderful! You have completed the full sequence. Say next to finish, or say again to retry this pose.'
        : 'Would you like to try this pose again, or try a different pose? Say again to retry, or say next for another pose.'

      // Trainer prompt: tell user they can relax, then speak feedback + afterPrompt
      const relaxPrompt = 'Done! You can relax and come back to a comfortable standing position.'

      if (feedbackText) {
        speak(relaxPrompt, () => {
          speakFeedback(feedbackText, () => {
            setExperiencePhase('results')
            speak(afterPrompt, () => {
              startResultsVoiceCommands()
            })
          })
        })
      } else {
        speak(relaxPrompt, () => {
          setExperiencePhase('results')
          speak(afterPrompt, () => {
            startResultsVoiceCommands()
          })
        })
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
    if (ref?.src) return `${import.meta.env.BASE_URL}${ref.src.replace(/^\//, '')}`
    // Fallback to API-provided media
    const media = trainMediaByPose[expectedPose]?.[0]
    if (media) {
      return media.src.startsWith('http') ? media.src : `${baseUrl}${media.src}`
    }
    return null
  })()

  return (
    <div className="overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-neutral-950 dark:text-slate-50" style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}>
      {/* ── Welcome page ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'welcome' && (
          <div className="absolute inset-0 z-50">
            <WelcomePage
              userName={userName}
              signedInWithGoogle={signedInWithGoogle}
              isLoading={authLoading}
              onEnter={handleWelcomeEnter}
              onGoogleSignIn={handleGoogleSignIn}
              onSignOut={handleSignOut}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Disclaimer screen (first time after sign-in) ──────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'disclaimer' && (
          <div className="absolute inset-0 z-50">
            <DisclaimerScreen
              userName={userName}
              onAccept={handleDisclaimerAccept}
              onDecline={handleDisclaimerDecline}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Health questionnaire ───────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'health-check' && (
          <div className="absolute inset-0 z-50">
            <HealthQuestionnaire
              onSubmit={handleHealthSubmit}
              onBack={handleHealthBack}
              isLoading={healthLoading}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Session briefing (safety-filtered plan) ────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'session-briefing' && safety.sessionPlan && (
          <div className="absolute inset-0 z-50">
            <SessionBriefing
              plan={safety.sessionPlan}
              onStart={handleSessionBriefingStart}
              onBack={handleSessionBriefingBack}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Risk warning banner (overlays during evaluation) ──────────────── */}
      <AnimatePresence>
        {safety.escalationEvent && experiencePhase === 'evaluating' && (
          <RiskWarningBanner
            event={safety.escalationEvent}
            onDismiss={safety.dismissEscalation}
            onPause={() => {
              safety.dismissEscalation()
              stopSession()
            }}
            onStop={() => {
              safety.dismissEscalation()
              handleEndSession()
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sign-in prompt overlay (guests hitting evaluate) ───────────────── */}
      <AnimatePresence>
        {showSignInPrompt && (
          <SignInPrompt
            onSignIn={() => {
              setShowSignInPrompt(false)
              handleBackToHome()
            }}
            onDismiss={() => setShowSignInPrompt(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Upgrade prompt overlay (free-tier credits exhausted) ───────────── */}
      <AnimatePresence>
        {showUpgradePrompt && (
          <UpgradePrompt onDismiss={() => setShowUpgradePrompt(false)} />
        )}
      </AnimatePresence>

      {/* ── Landing page ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'landing' && (
          <div className="absolute inset-0 z-50 overflow-y-auto">
            {/* ── Unified toolbar: tabs + controls ───────────────── */}
            <div className="sticky top-0 z-30 flex w-full items-center justify-between gap-2 bg-slate-50/80 px-3 py-2 backdrop-blur-lg dark:bg-slate-950/80 sm:px-4 sm:py-3">
              <AppSectionTabs value={activeSection} onChange={handleSectionChange} />
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Credit summary — visible for authenticated free-tier users */}
                {safety.isAuthenticated && (
                  <CreditIndicator
                    creditsRemaining={credits?.credits_remaining ?? null}
                    isUnlimited={isUnlimited}
                    creditsUsed={credits?.credits_used}
                    variant="summary"
                  />
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-600 backdrop-blur transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 sm:h-9 sm:w-9"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                {activeSection === 'yoga' && (
                  <VoiceSettings
                    voiceOn={voiceOn}
                    onToggleVoice={setVoiceOn}
                    settings={voiceSettings}
                    onChangeSettings={setVoiceSettings}
                    onPreview={() => speak('Namaste. Welcome to your practice.')}
                  />
                )}
              </div>
            </div>

            {activeSection === 'yoga' ? (
              <LandingPage
                poses={poseOptions}
                onSelectPose={handleSelectPose}
                onBackHome={handleBackToHome}
                sequences={SEQUENCES}
                onSelectSequence={handleSelectSequence}
                showCreditCost={safety.isAuthenticated}
              />
            ) : (
              <BreathworkPage
                baseUrl={baseUrl}
                onBackHome={handleBackToHome}
                onStartSession={handleStartBreathwork}
                toastMessage={breathworkToast}
                onToastDone={() => setBreathworkToast(null)}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {experiencePhase === 'breathwork-session' && selectedBreathworkProtocol && (
          <div className="absolute inset-0 z-[55]">
            <BreathworkSession
              protocol={selectedBreathworkProtocol}
              onExit={handleExitBreathworkSession}
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
            onBack={isInSequence ? handleExitSequence : handleTryAnother}
            isInSequence={isInSequence}
            sequenceIndex={sequenceIndex}
            sequenceTotalPoses={sequencePoses.length}
            sideNote={sequencePoses[sequenceIndex]?.sideNote}
          />
        )}
      </AnimatePresence>

      {/* ── Sequence complete page ─────────────────────────────────────────── */}
      <AnimatePresence>
        {experiencePhase === 'sequence-complete' && (
          <div className="absolute inset-0 z-50 overflow-y-auto">
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-2.5 text-sm text-slate-600 backdrop-blur transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
            <SequenceCompleteOverlay
              sequenceName={sequenceName}
              results={sequenceResults}
              onPracticeAgain={handleRestartSequence}
              onHome={handleExitSequence}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Practice area (framing + evaluating phases) ────────────────────── */}
      {experiencePhase !== 'welcome' && experiencePhase !== 'landing' && experiencePhase !== 'intro' && experiencePhase !== 'sequence-complete' && experiencePhase !== 'breathwork-session' && experiencePhase !== 'disclaimer' && experiencePhase !== 'health-check' && experiencePhase !== 'session-briefing' && (
        <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden px-2 py-1.5 sm:px-3 sm:py-3">
          {/* Header — compact on mobile */}
          <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-3 sm:flex-wrap sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleBackToLanding}
                className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 px-2 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                ←
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight sm:text-lg">{expectedPose}</div>
                {isInSequence && (
                  <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                    ☀️ Sequence · {sequenceIndex + 1}/{sequencePoses.length}
                  </div>
                )}
              </div>
              {/* Credit indicator — visible for free-tier users */}
              <CreditIndicator
                creditsRemaining={credits?.credits_remaining ?? null}
                isUnlimited={isUnlimited}
              />
            </div>
            <div className="flex items-center gap-1.5 sm:flex-wrap sm:gap-3">
              {experiencePhase === 'evaluating' && (
                <>
                  <button
                    type="button"
                    onClick={() => (running || isFraming ? stopSession() : startSession())}
                    className="h-8 rounded-2xl border border-slate-200 bg-white/80 px-3 text-xs text-slate-700 transition-colors duration-300 ease-in-out hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:h-10 sm:px-4 sm:text-sm dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    {running ? 'Pause' : isFraming ? 'Cancel' : 'Start'}
                  </button>

                  <button
                    type="button"
                    onClick={reframeOnce}
                    disabled={isAnalyzing || isFraming}
                    className="hidden h-10 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm text-slate-700 transition-colors duration-300 ease-in-out hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:block dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    Reframe
                  </button>
                </>
              )}

              {/* Voice & theme — hidden on mobile, visible sm+ */}
              <label className="hidden items-center gap-2 text-sm text-slate-600 sm:flex dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={voiceOn}
                  onChange={(e) => setVoiceOn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-slate-100 dark:border-white/20 dark:bg-white/10"
                />
                🔊 Voice
              </label>

              <button
                type="button"
                onClick={toggleTheme}
                className="hidden h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:flex dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {/* End Session */}
              <button
                type="button"
                onClick={handleEndSession}
                className="h-8 rounded-2xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:h-10 sm:px-4 sm:text-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                End
              </button>

              {/* Pain check button — safety architecture */}
              {experiencePhase === 'evaluating' && safety.sessionId && (
                <PainCheckButton
                  onReport={(level) => safety.reportPain(expectedPose, level)}
                />
              )}
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
                        // Feed safety risk extractor (throttled inside SafetyContext)
                        if (experiencePhase === 'evaluating' && safety.sessionId) {
                          safety.processFrame(lms, expectedPose)
                        }
                      }

                      // Voice coach during framing phase (independent of reframe UI)
                      if (experiencePhase === 'framing' && lms) {
                        const fr = computeFraming(lms)
                        advanceFramingSubPhase(fr)
                      }

                      if (framingEnabled) {
                        const next = computeFraming(lms)
                        setFraming(next)
                        maybeCoachFraming(next)
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
                <div className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                  <div className="flex overflow-hidden rounded-full border border-slate-200/80 bg-white/95 shadow-2xl shadow-black/30 backdrop-blur-md dark:border-white/15 dark:bg-slate-900/95 dark:shadow-black/50">
                    <button
                      type="button"
                      onClick={() => setActivePanel('instructor')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all active:scale-95 ${
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
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all active:scale-95 ${
                        activePanel === 'self'
                          ? 'bg-emerald-500 text-white shadow-inner'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      📷 My View
                    </button>
                  </div>
                  {/* Full-screen expand button */}
                  {activePanel === 'self' && (
                    <button
                      type="button"
                      onClick={() => setCameraFullScreen(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-base shadow-2xl shadow-black/30 backdrop-blur-md transition-all active:scale-90 dark:border-white/15 dark:bg-slate-900/95 dark:shadow-black/50"
                      title="Full screen camera"
                    >
                      ⛶
                    </button>
                  )}
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
                  framingSubPhase={framingSubPhase}
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
                  onTryAnother={isInSequence ? handleExitSequence : handleTryAnother}
                  score={alignment.score}
                  feedbackSummary={alignment.correction_message}
                  isInSequence={isInSequence}
                  sequenceIndex={sequenceIndex}
                  sequenceTotalPoses={sequencePoses.length}
                  nextPoseName={sequencePoses[sequenceIndex + 1]?.pose}
                  onNextInSequence={isInSequence ? handleNextInSequence : undefined}
                  onExitSequence={isInSequence ? handleExitSequence : undefined}
                  voiceListening={isVoiceCommandListening}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Full-screen camera overlay ────────────────────────────────── */}
      {cameraFullScreen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <UserCameraPanel
            fullScreen
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
              if (lms) {
                const count = lms.filter((lm) => lm.visibility > 0.5).length
                setVisibleLandmarkCount(count)
              }

              // Voice coach during framing phase (independent of reframe UI)
              if (experiencePhase === 'framing' && lms) {
                const fr = computeFraming(lms)
                advanceFramingSubPhase(fr)
              }

              if (framingEnabled) {
                const next = computeFraming(lms)
                setFraming(next)
                maybeCoachFraming(next)
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
          {/* Exit full-screen button */}
          <button
            type="button"
            onClick={() => setCameraFullScreen(false)}
            className="absolute right-3 top-3 z-[70] flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white shadow-lg backdrop-blur-sm transition-all active:scale-90"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
            title="Exit full screen"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Chatbot ──────────────────────────────────────────────────────── */}
      {experiencePhase !== 'welcome' && activeSection === 'yoga' && experiencePhase !== 'breathwork-session' && (
        <ChatBot
          messages={chatStore.messages}
          unreadCount={chatStore.unreadCount}
          open={chatStore.chatOpen}
          onToggle={chatStore.toggleChat}
          onSendMessage={chatStore.addUserMessage}
          onBotReply={(text) => chatStore.addBotMessage(text, false)}
          onBotSuggestion={(suggestion) => chatStore.addSuggestionMessage(suggestion)}
          onNavigate={(type, id) => {
            if (type === 'breathwork') {
              handleSectionChange('breathwork')
            } else if (type === 'pose') {
              handleSelectPose(id)
            }
            chatStore.setChatOpen(false)
          }}
          userName={userName}
          baseUrl={baseUrl}
        />
      )}
    </div>
  )
}

