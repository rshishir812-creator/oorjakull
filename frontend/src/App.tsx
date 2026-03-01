import { useEffect, useRef, useState } from 'react'
import type { AlignmentResponse, ExpectedPose, Landmark, Severity, UserLevel } from './api/client'
import { evaluateAlignment } from './api/client'
import InstructorPanel from './components/InstructorPanel'
import LayoutToggle, { type LayoutMode } from './components/LayoutToggle'
import UserCameraPanel from './components/UserCameraPanel'
import { useThrottledState } from './hooks/useThrottledState'
import { POSE_REFERENCES, worstSeverity } from './poses/reference'

type FramingState = 'cameraLoading' | 'notFramed' | 'partiallyFramed' | 'handsNotRaised' | 'fullyFramed'

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
  const [expectedPose, setExpectedPose] = useState<ExpectedPose>('Warrior II')
  const [userLevel] = useState<UserLevel>('beginner')
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [voiceOn, setVoiceOn] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('laptop')
  const [evaluating, setEvaluating] = useState(false)

  const [framingEnabled, setFramingEnabled] = useState(false)
  const [framingUiVisible, setFramingUiVisible] = useState(false)

  const [statusText, setStatusText] = useState('Press Start to evaluate once.')

  const [alignment, setAlignment] = useThrottledState<AlignmentResponse>(
    {
    pose_match: 'partially_aligned',
    confidence: 'low',
    primary_focus_area: 'none',
    deviations: [],
    correction_message: 'Press Start to evaluate once.',
    score: null
    },
    2
  )

  const clientIdRef = useRef<string>(newClientId())
  const lastSpokenRef = useRef<string>('')
  const lastSpeakTsRef = useRef<number>(0)

  const baseUrl = 'http://localhost:8000'

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
      : 'flex min-h-0 flex-1 flex-col gap-3'

  const deviceFrame =
    layoutMode === 'mobile'
      ? 'mx-auto flex h-full w-full max-w-[440px] flex-col rounded-[32px] border border-white/10 bg-black/20 p-3 shadow-2xl shadow-black/40'
      : 'flex h-full flex-col'

  useEffect(() => {
    if (!voiceOn) return
    const msg = alignment.correction_message
    const now = Date.now()
    if (!msg || msg === lastSpokenRef.current) return
    if (now - lastSpeakTsRef.current < 2000) return

    const u = new SpeechSynthesisUtterance(msg)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)

    lastSpokenRef.current = msg
    lastSpeakTsRef.current = now
  }, [alignment.correction_message, voiceOn])

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
    setAlignment({
      pose_match: 'partially_aligned',
      confidence: 'low',
      primary_focus_area: 'none',
      deviations: [],
      correction_message: 'Hold the pose. We will evaluate once.',
      score: null
    })

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
        score: null
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
        score: null
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
    } catch (e) {
      setAlignment({
        ...alignment,
        confidence: 'low',
        correction_message: 'Backend unavailable.',
        score: null
      })
      setStatusText('Backend unavailable.')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-neutral-950 text-slate-50">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-3 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-medium tracking-tight">OorjaKull AI Yoga</div>
            <div className="mt-1 text-sm text-slate-300"></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LayoutToggle mode={layoutMode} onChange={setLayoutMode} />

            <select
              aria-label="Expected pose"
              value={expectedPose}
              onChange={(e) => {
                setExpectedPose(e.target.value as ExpectedPose)
                stopSession()
                setAlignment({
                  pose_match: 'partially_aligned',
                  confidence: 'low',
                  primary_focus_area: 'none',
                  deviations: [],
                  correction_message: 'Press Start to evaluate once.',
                  score: null
                })
                setStatusText('Press Start to evaluate once.')
              }}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            >
              {POSE_REFERENCES.map((p) => (
                <option key={p.pose} value={p.pose} className="text-slate-900">
                  {p.pose}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => (running || isFraming ? stopSession() : startSession())}
              className="h-10 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white transition-colors duration-300 ease-in-out hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            >
              {running ? 'Pause' : isFraming ? 'Cancel' : 'Start Evaluation'}
            </button>

            <button
              type="button"
              onClick={reframeOnce}
              disabled={isAnalyzing || isFraming}
              className="h-10 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white transition-colors duration-300 ease-in-out hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reframe
            </button>

            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={voiceOn}
                onChange={(e) => setVoiceOn(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              Voice
            </label>
          </div>
        </div>

        <div className={`${deviceFrame} flex-1 min-h-0`}>
          <div className={`${pageLayoutClass} min-h-0 flex-1`}>
            <InstructorPanel
              baseUrl={baseUrl}
              expectedPose={expectedPose}
              primaryFocusArea={alignment.primary_focus_area}
              severity={severity}
              alignedPulseActive={alignedPulseActive}
              alignedPulseKey={alignedPulseKey}
            />
            <UserCameraPanel
              running={running}
              countdown={countdown}
              statusText={statusText}
              confidence={alignment.confidence}
              score={alignment.score}
              isAnalyzing={isAnalyzing}
              feedbackMessage={alignment.correction_message}
              framingEnabled={framingUiVisible}
              framingState={framing.state}
              framingMessage={framing.message}
              onLandmarks={(lms, visMean) => {
                latestLandmarksRef.current = lms
                latestVisibilityRef.current = visMean

                if (framingEnabled) {
                  const next = computeFraming(lms)
                  setFraming(next)
                  if (next.state === 'fullyFramed') {
                    setFramingEnabled(false)

                    // Keep the success message visible briefly so it's readable from afar,
                    // then fully hide the framing UI (framing is complete until user hits Reframe).
                    if (framingUiTimerRef.current) window.clearTimeout(framingUiTimerRef.current)
                    framingUiTimerRef.current = window.setTimeout(() => {
                      setFramingUiVisible(false)
                      framingUiTimerRef.current = null
                    }, 2000)
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
