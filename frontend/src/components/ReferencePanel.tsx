import type { ExpectedPose, FocusArea, Severity } from '../api/client'
import { POSE_REFERENCES, severityColor } from '../poses/reference'
import { POSE_DESCRIPTIONS } from '../data/poseDescriptions'

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
  const poseDesc = POSE_DESCRIPTIONS[props.expectedPose]
  const ids = focusToIds(props.primaryFocusArea)
  const color = props.severity ? severityColor(props.severity) : '#000'

  const baseUrl = props.baseUrl
    ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, '').replace(/\/$/, '')
    ?? 'http://localhost:8000'
  const mediaSrc = ref?.src
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
          {!mediaSrc ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1.5rem', textAlign: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '3rem', opacity: 0.3 }}>🧘</span>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: '18rem' }}>
                {poseDesc?.introScript
                  ?.replace(/^Welcome to .+?\. /, '')
                  .replace(/ Step into the frame.+$/, '') ?? ''}
              </p>
              <span style={{ display: 'inline-block', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', padding: '0.375rem 1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                📷 Reference image coming soon
              </span>
            </div>
          ) : ref?.kind === 'video' ? (
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
