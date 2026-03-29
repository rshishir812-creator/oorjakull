export type ExpectedPose = string
export type UserLevel = 'beginner' | 'intermediate' | 'advanced'

export type FocusArea = 'front_knee' | 'back_leg' | 'arms' | 'torso' | 'hips' | 'balance' | 'none'
export type Severity = 'minor' | 'moderate' | 'major'

export type Deviation = {
  issue: string
  joint_or_area: string
  measured_value: number
  ideal_range: string
  severity: Severity
}

export type AlignmentResponse = {
  pose_match: 'aligned' | 'partially_aligned' | 'misaligned'
  confidence: 'high' | 'medium' | 'low'
  primary_focus_area: FocusArea
  deviations: Deviation[]
  correction_message: string
  score?: number | null
  /** 3-5 plain-English improvement instructions */
  correction_bullets: string[]
  /** One sentence on what the student is doing right */
  positive_observation: string
  /** Breath guidance for this moment in the pose */
  breath_cue: string
  /** Safety caution if a joint is severely misaligned, otherwise null */
  safety_note: string | null
  // ── Credit system fields ─────────────────────────────────────────────
  /** Remaining credits after this evaluation (null = unlimited) */
  credits_remaining?: number | null
  /** True if the user has 0 credits left */
  credits_exhausted?: boolean
  /** True if the request was unauthenticated (guest) */
  is_guest?: boolean
}

export type Landmark = { x: number; y: number; z: number; visibility: number }

export type TrainMediaKind = 'image' | 'video'

export type TrainMedia = {
  kind: TrainMediaKind
  src: string
  filename: string
}

export type TrainPose = {
  pose: string
  media: TrainMedia[]
}

export type BreathEffect = 'increase' | 'decrease' | 'steady'
export type BreathAnimation = 'expand' | 'hold' | 'contract' | 'pulse'

export type BreathworkPhase = {
  label: string
  duration_sec: number
  instruction: string
  animation: BreathAnimation
}

export type BreathworkProtocol = {
  id: string
  name: string
  category: string
  tagline: string
  duration_mins: number
  description: string
  origin: string
  benefits: string[]
  effects: {
    hr: BreathEffect
    hrv: BreathEffect
    temperature: BreathEffect | null
  }
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  phases: BreathworkPhase[]
  cycles: number
}

export async function fetchTrainPoses(params: { baseUrl: string }): Promise<TrainPose[]> {
  const res = await fetch(`${params.baseUrl}/api/train/poses`)
  if (!res.ok) return []

  const data = (await res.json()) as { poses?: TrainPose[] }
  return Array.isArray(data.poses) ? data.poses : []
}

export async function fetchBreathworkProtocols(params: { baseUrl: string }): Promise<BreathworkProtocol[]> {
  const res = await fetch(`${params.baseUrl}/api/breathwork/protocols`)
  if (!res.ok) {
    throw new Error(`Failed to load breathwork protocols: ${res.status}`)
  }

  return (await res.json()) as BreathworkProtocol[]
}

export async function evaluateAlignment(params: {
  baseUrl: string
  clientId: string
  expectedPose: ExpectedPose
  userLevel: UserLevel
  landmarks: Landmark[]
  googleSub?: string | null
}): Promise<AlignmentResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (params.googleSub) {
    headers['Authorization'] = `Bearer ${params.googleSub}`
  }
  const res = await fetch(`${params.baseUrl}/api/evaluate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_id: params.clientId,
      expected_pose: params.expectedPose,
      user_level: params.userLevel,
      landmarks: params.landmarks
    })
  })

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`)
  }

  return (await res.json()) as AlignmentResponse
}

/**
 * Call the backend Cloud TTS endpoint and return an audio Blob (MP3).
 * Throws on network or API errors.
 */
export async function synthesizeSpeech(params: {
  baseUrl: string
  text: string
  languageCode?: string
  gender: 'male' | 'female'
  speed: number
  pitch: number
}): Promise<Blob> {
  const res = await fetch(`${params.baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      language_code: params.languageCode ?? 'en-IN',
      gender: params.gender,
      speed: params.speed,
      pitch: params.pitch,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error')
    throw new Error(`TTS error ${res.status}: ${detail}`)
  }

  return res.blob()
}
export type ProductSuggestion = {
  type: 'breathwork' | 'pose'
  id: string
  label: string
  reason: string
}

/**
 * Call the backend assistant endpoint and get a conversational response from Madhu.
 * Returns the reply text and an optional product suggestion card.
 */
export async function callAssistant(params: {
  baseUrl: string
  message: string
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<{ reply: string; suggestion?: ProductSuggestion | null }> {
  const res = await fetch(`${params.baseUrl}/api/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      messages: params.messages || [],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error')
    throw new Error(`Assistant error ${res.status}: ${detail}`)
  }

  return (await res.json()) as { reply: string; suggestion?: ProductSuggestion | null }
}

// ── Deterministic pose scoring (no LLM, <20ms) ─────────────────────────────

export type PoseScoreViolation = {
  joint: string
  severity: string
  feedback: string
}

export type PoseScoreResponse = {
  score: number
  violations: PoseScoreViolation[]
  is_stable: boolean
  feedback_priority: string | null
}

/**
 * Fast deterministic pose score — called every frame.
 * No LLM round-trip, <20 ms.
 */
export async function scorePose(params: {
  baseUrl: string
  poseId: string
  landmarks: Landmark[]
}): Promise<PoseScoreResponse> {
  const res = await fetch(`${params.baseUrl}/api/pose/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pose_id: params.poseId,
      landmarks: params.landmarks,
    }),
  })

  if (!res.ok) {
    throw new Error(`Pose score error: ${res.status}`)
  }

  return (await res.json()) as PoseScoreResponse
}

// ── Pose library ────────────────────────────────────────────────────────────

export type PoseLibraryEntry = {
  pose_id: string
  name_en: string
  name_sa: string
  difficulty: string
  category: string
  summary: string
  hold_seconds: number
  inhale_cue: string
  exhale_cue: string
  alignment_cues: string[]
  common_mistakes: { mistake: string; correction: string }[]
  modifications: string[]
  contraindications: string[]
  avoid_conditions: string[]
  benefits: string[]
  voice_script_short: string
  transition_in_ids: string[]
  transition_out_ids: string[]
  flow_name: string | null
  power_yoga: boolean
}

export async function fetchPoseLibrary(params: {
  baseUrl: string
}): Promise<PoseLibraryEntry[]> {
  const res = await fetch(`${params.baseUrl}/api/pose/library`)
  if (!res.ok) return []
  const data = (await res.json()) as { poses?: PoseLibraryEntry[] }
  return Array.isArray(data.poses) ? data.poses : []
}

export async function fetchPoseDetail(params: {
  baseUrl: string
  poseId: string
}): Promise<PoseLibraryEntry | null> {
  const res = await fetch(`${params.baseUrl}/api/pose/library/${params.poseId}`)
  if (!res.ok) return null
  return (await res.json()) as PoseLibraryEntry
}

// ── Contraindication check ──────────────────────────────────────────────────

export type ContraindicationResult = {
  warnings: string[]
  safe: boolean
}

export async function checkContraindications(params: {
  baseUrl: string
  poseId: string
  userConditions: string[]
}): Promise<ContraindicationResult> {
  const res = await fetch(`${params.baseUrl}/api/pose/contraindications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pose_id: params.poseId,
      user_conditions: params.userConditions,
    }),
  })

  if (!res.ok) {
    throw new Error(`Contraindication check error: ${res.status}`)
  }

  return (await res.json()) as ContraindicationResult
}

// ── User credit balance ─────────────────────────────────────────────────────

export type UserCredits = {
  credits_remaining: number | null
  credits_used: number
  profile_type: 'super_user' | 'paid_user' | 'free_user'
}

export async function fetchUserCredits(params: {
  baseUrl: string
  googleSub: string
}): Promise<UserCredits> {
  const res = await fetch(`${params.baseUrl}/api/user/credits`, {
    headers: { Authorization: `Bearer ${params.googleSub}` },
  })
  if (!res.ok) {
    throw new Error(`Credits fetch error: ${res.status}`)
  }
  return (await res.json()) as UserCredits
}