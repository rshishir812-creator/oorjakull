export interface SequenceStep {
  /** Must match a key in POSE_DESCRIPTIONS and a pose name in POSE_REFERENCES */
  pose: string
  /** Optional side-specific note shown to the user before the pose (e.g. "Switch legs") */
  sideNote?: string
}

export interface PoseSequence {
  id: string
  name: string
  sanskritName: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  /** Ordered list of poses in the sequence */
  steps: SequenceStep[]
  /** Approximate practice duration in minutes */
  durationMins: number
}

export const SEQUENCES: PoseSequence[] = [
  {
    id: 'surya-namaskar-beginner',
    name: 'Surya Namaskar',
    sanskritName: 'Sūrya Namaskāra',
    description:
      'A complete 10-step sun salutation flow built for beginners. Receive real-time AI feedback on each pose and transition through the full sequence at your own pace.',
    difficulty: 'beginner',
    durationMins: 15,
    steps: [
      { pose: 'Pranamasana' },
      { pose: 'Hasta Uttanasana' },
      { pose: 'Padahastasana' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Step your right leg back into the lunge.' },
      { pose: 'Plank' },
      { pose: 'Down Dog' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Bring your left leg forward now — switch sides.' },
      { pose: 'Padahastasana' },
      { pose: 'Hasta Uttanasana' },
      { pose: 'Pranamasana' },
    ],
  },
]
