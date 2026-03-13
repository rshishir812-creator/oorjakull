import type { ExpectedPose, FocusArea, Severity } from '../api/client'

export type PoseReference = {
  pose: ExpectedPose
  kind: 'image' | 'video'
  src: string
}

export const POSE_REFERENCES: PoseReference[] = [
  { pose: 'Tadasana', kind: 'image', src: '/poses/train/Tadasana.png' },
  { pose: 'Warrior II', kind: 'image', src: '/poses/train/Warrior.png' },
  { pose: 'Down Dog', kind: 'image', src: '/poses/train/Downdog.png' },
  { pose: 'Goddess', kind: 'image', src: '/poses/train/Godess.png' },
  { pose: 'Plank', kind: 'image', src: '/poses/train/Plank.png' },
  { pose: 'Ashwa Sanchalanasana', kind: 'image', src: '/poses/train/Ashwa%20Sanchalanasana.png' },
  { pose: 'Hasta Uttanasana', kind: 'image', src: '/poses/train/Hasta%20Uttanasana.png' },
  { pose: 'Padahastasana', kind: 'image', src: '/poses/train/Padahastasana.png' },
  { pose: 'Pranamasana', kind: 'image', src: '/poses/train/Pranamasana.jpeg' },
]

export function severityColor(sev: Severity): string {
  switch (sev) {
    case 'minor':
      return '#f4c542' // yellow
    case 'moderate':
      return '#f08a24' // orange
    case 'major':
      return '#e03a3a' // red
  }
}

export function worstSeverity(deviations: { severity: Severity }[]): Severity {
  if (deviations.some((d) => d.severity === 'major')) return 'major'
  if (deviations.some((d) => d.severity === 'moderate')) return 'moderate'
  return 'minor'
}

export type HighlightState = {
  focusArea: FocusArea
  severity: Severity | null
}
