import type { ExpectedPose, FocusArea, Severity } from '../api/client'
import { POSE_REFERENCES, severityColor } from '../poses/reference'

function focusToIds(focus: FocusArea): string[] {
  switch (focus) {
    case 'front_knee':
      return ['front_knee']
    case 'back_leg':
      return ['back_leg']
    case 'arms':
      return ['arms']
    case 'torso':
      return ['torso']
    case 'hips':
      return ['hips']
    case 'balance':
      return ['full_body']
    case 'none':
      return []
  }
}

export default function ReferencePanel(props: {
  baseUrl?: string
  expectedPose: ExpectedPose
  primaryFocusArea: FocusArea
  severity: Severity | null
}) {
  const ref = POSE_REFERENCES.find((p) => p.pose === props.expectedPose)
  const ids = focusToIds(props.primaryFocusArea)
  const color = props.severity ? severityColor(props.severity) : '#000'

  const baseUrl = props.baseUrl
    ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, '').replace(/\/$/, '')
    ?? 'http://localhost:8000'
  const mediaSrc = ref
    ? ref.kind === 'video'
      ? `${baseUrl}${ref.src}`
      : `${import.meta.env.BASE_URL}${ref.src.replace(/^\//, '')}`
    : ''

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <div style={{ fontWeight: 650 }}>{props.expectedPose}</div>
          <div className="small">Reference pose (front view)</div>
        </div>
        <div className="badge">Highlight: {props.primaryFocusArea}</div>
      </div>
      <div className="panelBody">
        <div className="referenceStage">
          {ref?.kind === 'video' ? (
            <video src={mediaSrc} autoPlay loop muted playsInline preload="metadata" />
          ) : (
            <img src={mediaSrc} alt={`${props.expectedPose} reference`} />
          )}
          <svg className="overlaySvg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              id="full_body"
              className={`highlight ${ids.includes('full_body') ? 'on' : ''}`}
              stroke={color}
              d="M20,8 L80,8 L80,98 L20,98 Z"
            />
            <path
              id="arms"
              className={`highlight ${ids.includes('arms') ? 'on' : ''}`}
              stroke={color}
              d="M10,35 L90,35"
            />
            <path
              id="torso"
              className={`highlight ${ids.includes('torso') ? 'on' : ''}`}
              stroke={color}
              d="M50,22 L50,62"
            />
            <path
              id="hips"
              className={`highlight ${ids.includes('hips') ? 'on' : ''}`}
              stroke={color}
              d="M35,62 L65,62"
            />
            <path
              id="front_knee"
              className={`highlight ${ids.includes('front_knee') ? 'on' : ''}`}
              stroke={color}
              d="M43,78 L43,86"
            />
            <path
              id="back_leg"
              className={`highlight ${ids.includes('back_leg') ? 'on' : ''}`}
              stroke={color}
              d="M57,62 L60,96"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
