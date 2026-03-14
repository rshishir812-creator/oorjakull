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

export async function fetchTrainPoses(params: { baseUrl: string }): Promise<TrainPose[]> {
  const res = await fetch(`${params.baseUrl}/api/train/poses`)
  if (!res.ok) return []

  const data = (await res.json()) as { poses?: TrainPose[] }
  return Array.isArray(data.poses) ? data.poses : []
}

export async function evaluateAlignment(params: {
  baseUrl: string
  clientId: string
  expectedPose: ExpectedPose
  userLevel: UserLevel
  landmarks: Landmark[]
}): Promise<AlignmentResponse> {
  const res = await fetch(`${params.baseUrl}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  gender: 'male' | 'female'
  speed: number
  pitch: number
}): Promise<Blob> {
  const res = await fetch(`${params.baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
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
