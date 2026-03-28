/**
 * SafetyContext — React context for the safety architecture.
 *
 * Holds: auth state, risk profile, session plan, consent, risk score.
 * Provides methods for sign-in, questionnaire submit, session plan creation.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type {
  UserHealthInput,
  UserRiskProfile,
  SessionPlan,
  EscalationEvent,
} from '../types/health'
import { RiskSignalExtractor } from '../safety/riskSignalExtractor'
import { RiskScoringEngine } from '../safety/riskScoringEngine'
import type { Landmark } from '../api/client'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, '').replace(/\/$/, '') ?? 'http://localhost:8000'

// ── Auth helpers ────────────────────────────────────────────────────────────

async function authGoogle(credential: string): Promise<{
  user_id: string
  google_sub: string
  email: string
  display_name: string
  picture_url: string
}> {
  const res = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
  return res.json()
}

async function submitProfile(
  healthInput: UserHealthInput,
  googleSub: string,
): Promise<UserRiskProfile> {
  const res = await fetch(`${BASE_URL}/api/safety/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${googleSub}`,
    },
    body: JSON.stringify(healthInput),
  })
  if (!res.ok) throw new Error(`Profile submission failed: ${res.status}`)
  return res.json()
}

async function fetchProfile(googleSub: string): Promise<{
  exists: boolean
  profile?: UserRiskProfile
  risk_tier?: string
  consent_given?: boolean
}> {
  const res = await fetch(`${BASE_URL}/api/safety/profile`, {
    headers: { Authorization: `Bearer ${googleSub}` },
  })
  if (!res.ok) return { exists: false }
  return res.json()
}

async function createSessionPlan(
  flowId: string,
  poseIds: string[],
  googleSub: string,
): Promise<SessionPlan> {
  const res = await fetch(`${BASE_URL}/api/session/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${googleSub}`,
    },
    body: JSON.stringify({ flow_id: flowId, pose_ids: poseIds }),
  })
  if (!res.ok) throw new Error(`Session plan failed: ${res.status}`)
  return res.json()
}

async function updateSessionState(
  sessionId: string,
  state: string,
  data: Record<string, unknown>,
  googleSub: string,
): Promise<void> {
  await fetch(`${BASE_URL}/api/session/${sessionId}/state`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${googleSub}`,
    },
    body: JSON.stringify({ state, ...data }),
  })
}

async function recordPainCheck(
  sessionId: string,
  poseId: string,
  painLevel: string,
  googleSub: string,
): Promise<void> {
  await fetch(`${BASE_URL}/api/session/pain-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${googleSub}`,
    },
    body: JSON.stringify({ session_id: sessionId, pose_id: poseId, pain_level: painLevel }),
  })
}

// ── Context types ──────────────────────────────────────────────────────────

interface SafetyState {
  // Auth
  isAuthenticated: boolean
  userId: string
  googleSub: string
  email: string
  displayName: string
  pictureUrl: string

  // Profile
  hasProfile: boolean
  riskProfile: UserRiskProfile | null
  consentGiven: boolean

  // Session
  sessionPlan: SessionPlan | null
  sessionId: string
  riskScore: number
  escalationLevel: string
  escalationEvent: EscalationEvent | null
  riskEvents: EscalationEvent[]

  // Actions
  signIn: (credential: string) => Promise<{ isAuthenticated: boolean; hasProfile: boolean }>
  signOut: () => void
  submitHealthInput: (input: UserHealthInput) => Promise<UserRiskProfile>
  loadProfile: () => Promise<void>
  requestSessionPlan: (flowId: string, poseIds: string[]) => Promise<SessionPlan>
  processFrame: (landmarks: Landmark[], poseId: string) => void
  reportPain: (poseId: string, level: 'mild' | 'moderate' | 'severe') => void
  completeSession: (data: Record<string, unknown>) => Promise<void>
  resetSession: () => void
  dismissEscalation: () => void
}

const SafetyContext = createContext<SafetyState | null>(null)

export function useSafety(): SafetyState {
  const ctx = useContext(SafetyContext)
  if (!ctx) throw new Error('useSafety must be used within SafetyProvider')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  // Auth — restore from localStorage for returning users
  const stored = (() => {
    try {
      const raw = localStorage.getItem('oorjakull_auth')
      return raw ? JSON.parse(raw) as { googleSub: string; userId: string; email: string; displayName: string; pictureUrl: string } : null
    } catch { return null }
  })()
  const [isAuthenticated, setIsAuthenticated] = useState(!!stored)
  const [userId, setUserId] = useState(stored?.userId ?? '')
  const [googleSub, setGoogleSub] = useState(stored?.googleSub ?? '')
  const [email, setEmail] = useState(stored?.email ?? '')
  const [displayName, setDisplayName] = useState(stored?.displayName ?? '')
  const [pictureUrl, setPictureUrl] = useState(stored?.pictureUrl ?? '')

  // Profile
  const [hasProfile, setHasProfile] = useState(false)
  const [riskProfile, setRiskProfile] = useState<UserRiskProfile | null>(null)
  const [consentGiven, setConsentGiven] = useState(false)

  // Session
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [riskScore, setRiskScore] = useState(0)
  const [escalationLevel, setEscalationLevel] = useState<string>('none')
  const [escalationEvent, setEscalationEvent] = useState<EscalationEvent | null>(null)
  const [riskEvents, setRiskEvents] = useState<EscalationEvent[]>([])

  // Internal
  const extractorRef = useRef(new RiskSignalExtractor())
  const scorerRef = useRef(new RiskScoringEngine())
  const lastEscalationRef = useRef<string>('none')
  // Throttle: only process risk signals every 3rd frame
  const frameCountRef = useRef(0)

  // ── Auth actions ─────────────────────────────────────────────────────────

  const signIn = useCallback(async (credential: string): Promise<{ isAuthenticated: boolean; hasProfile: boolean }> => {
    try {
      const user = await authGoogle(credential)
      setIsAuthenticated(true)
      setUserId(user.user_id)
      setGoogleSub(user.google_sub)
      setEmail(user.email)
      setDisplayName(user.display_name)
      setPictureUrl(user.picture_url)

      // Persist for returning users
      try {
        localStorage.setItem('oorjakull_auth', JSON.stringify({
          googleSub: user.google_sub, userId: user.user_id,
          email: user.email, displayName: user.display_name, pictureUrl: user.picture_url,
        }))
      } catch { /* quota exceeded — non-critical */ }

      // Try to load existing profile
      let profileFound = false
      const profileData = await fetchProfile(user.google_sub)
      if (profileData.exists && profileData.profile) {
        setHasProfile(true)
        setRiskProfile(profileData.profile)
        setConsentGiven(profileData.consent_given ?? false)
        profileFound = true
      }
      return { isAuthenticated: true, hasProfile: profileFound }
    } catch (err) {
      console.error('Safety auth failed:', err)
      return { isAuthenticated: false, hasProfile: false }
    }
  }, [])

  const signOut = useCallback(() => {
    setIsAuthenticated(false)
    setUserId('')
    setGoogleSub('')
    setEmail('')
    setDisplayName('')
    setPictureUrl('')
    setHasProfile(false)
    setRiskProfile(null)
    setConsentGiven(false)
    setSessionPlan(null)
    setSessionId('')
    setRiskScore(0)
    setEscalationLevel('none')
    setEscalationEvent(null)
    setRiskEvents([])
    extractorRef.current.reset()
    scorerRef.current.reset()
    try { localStorage.removeItem('oorjakull_auth') } catch { /* ok */ }
  }, [])

  // On mount: if we restored auth from localStorage, try to load profile
  useEffect(() => {
    if (!stored?.googleSub) return
    fetchProfile(stored.googleSub).then(data => {
      if (data.exists && data.profile) {
        setHasProfile(true)
        setRiskProfile(data.profile)
        setConsentGiven(data.consent_given ?? false)
      }
    }).catch(() => { /* non-critical — user can still use the app */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Profile actions ──────────────────────────────────────────────────────

  const submitHealthInput = useCallback(async (input: UserHealthInput) => {
    const profile = await submitProfile(input, googleSub)
    setRiskProfile(profile)
    setHasProfile(true)
    setConsentGiven(input.consent_given)
    return profile
  }, [googleSub])

  const loadProfile = useCallback(async () => {
    if (!googleSub) return
    const data = await fetchProfile(googleSub)
    if (data.exists && data.profile) {
      setHasProfile(true)
      setRiskProfile(data.profile)
      setConsentGiven(data.consent_given ?? false)
    }
  }, [googleSub])

  // ── Session actions ──────────────────────────────────────────────────────

  const requestSessionPlan = useCallback(async (flowId: string, poseIds: string[]) => {
    const plan = await createSessionPlan(flowId, poseIds, googleSub)
    setSessionPlan(plan)
    setSessionId(plan.session_id)
    extractorRef.current.reset()
    scorerRef.current.reset()
    setRiskScore(0)
    setEscalationLevel('none')
    setEscalationEvent(null)
    setRiskEvents([])
    lastEscalationRef.current = 'none'
    frameCountRef.current = 0
    return plan
  }, [googleSub])

  const processFrame = useCallback((landmarks: Landmark[], poseId: string) => {
    // Throttle: only every 3rd frame to save CPU
    frameCountRef.current++
    if (frameCountRef.current % 3 !== 0) return

    const signals = extractorRef.current.extract(landmarks)
    const result = scorerRef.current.ingestSignals(signals, sessionId, poseId)
    setRiskScore(result.score)
    setEscalationLevel(result.escalation)

    // Generate escalation event if level changed upward
    if (result.escalation !== 'none' && result.escalation !== lastEscalationRef.current) {
      const latestSignal = signals.length > 0 ? signals[signals.length - 1] : undefined
      const event = scorerRef.current.buildEscalationEvent(sessionId, latestSignal)
      if (event) {
        setEscalationEvent(event)
        setRiskEvents(prev => [...prev, event])
        lastEscalationRef.current = result.escalation
      }
    }

    // Reset escalation tracking when score drops below warn
    if (result.escalation === 'none') {
      lastEscalationRef.current = 'none'
    }
  }, [sessionId])

  const reportPain = useCallback((poseId: string, level: 'mild' | 'moderate' | 'severe') => {
    scorerRef.current.reportPain(level)
    // Fire and forget DB write
    if (googleSub && sessionId) {
      recordPainCheck(sessionId, poseId, level, googleSub).catch(() => {})
    }
  }, [googleSub, sessionId])

  const completeSession = useCallback(async (data: Record<string, unknown>) => {
    if (googleSub && sessionId) {
      await updateSessionState(sessionId, 'completed', {
        final_risk_score: riskScore,
        risk_events: riskEvents.map(e => ({
          event_type: e.event_type,
          reason: e.reason,
          risk_score_at: riskScore,
        })),
        ...data,
      }, googleSub)
    }
  }, [googleSub, sessionId, riskScore, riskEvents])

  const resetSession = useCallback(() => {
    setSessionPlan(null)
    setSessionId('')
    setRiskScore(0)
    setEscalationLevel('none')
    setEscalationEvent(null)
    setRiskEvents([])
    extractorRef.current.reset()
    scorerRef.current.reset()
    lastEscalationRef.current = 'none'
    frameCountRef.current = 0
  }, [])

  const dismissEscalation = useCallback(() => {
    setEscalationEvent(null)
  }, [])

  // ── Context value ────────────────────────────────────────────────────────

  const value: SafetyState = {
    isAuthenticated,
    userId,
    googleSub,
    email,
    displayName,
    pictureUrl,
    hasProfile,
    riskProfile,
    consentGiven,
    sessionPlan,
    sessionId,
    riskScore,
    escalationLevel,
    escalationEvent,
    riskEvents,
    signIn,
    signOut,
    submitHealthInput,
    loadProfile,
    requestSessionPlan,
    processFrame,
    reportPain,
    completeSession,
    resetSession,
    dismissEscalation,
  }

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  )
}
