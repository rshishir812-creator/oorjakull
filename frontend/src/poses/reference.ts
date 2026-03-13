import type { ExpectedPose, FocusArea, Severity } from '../api/client'

export type PoseReference = {
  pose: ExpectedPose
  kind: 'image' | 'video'
  src: string
}

export const POSE_REFERENCES: PoseReference[] = [
  { pose: 'Tadasana', kind: 'image', src: '/poses/tadasana.svg' },
  { pose: 'Warrior II', kind: 'video', src: '/train/Warrior_Pose.mp4' },
  { pose: 'Tree Pose', kind: 'video', src: '/train/Tree_Pose.mp4' },
  { pose: 'Down Dog', kind: 'image', src: '/poses/train/downdog.jpg' },
  { pose: 'Goddess', kind: 'image', src: '/poses/train/goddess.jpg' },
  { pose: 'Plank', kind: 'image', src: '/poses/train/plank.jpg' },
  { pose: 'Ashwa Sanchalanasana', kind: 'image', src: '' },
  { pose: 'Hasta Uttanasana', kind: 'image', src: '' },
  { pose: 'Padahastasana', kind: 'image', src: '' },
  { pose: 'Pranamasana', kind: 'image', src: '' },
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
