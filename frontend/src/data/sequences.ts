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
      'A beginner-friendly Surya Namaskar flow with right and left side transitions. Real-time AI feedback supports alignment in each step.',
    difficulty: 'beginner',
    durationMins: 15,
    steps: [
      { pose: 'Pranamasana' },
      { pose: 'Hasta Uttanasana' },
      { pose: 'Padahastasana' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Right leg back.' },
      { pose: 'Plank' },
      { pose: 'Bhujangasana' },
      { pose: 'Down Dog' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Right leg forward.' },
      { pose: 'Padahastasana' },
      { pose: 'Pranamasana', sideNote: 'Second half: switch sides.' },
      { pose: 'Hasta Uttanasana' },
      { pose: 'Padahastasana' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Left leg back.' },
      { pose: 'Plank' },
      { pose: 'Bhujangasana' },
      { pose: 'Down Dog' },
      { pose: 'Ashwa Sanchalanasana', sideNote: 'Left leg forward.' },
      { pose: 'Padahastasana' },
      { pose: 'Pranamasana' },
    ],
  },

  // ── Standing Flow ────────────────────────────────────────────────────────
  {
    id: 'standing-strength',
    name: 'Standing Strength Flow',
    sanskritName: 'Sthira Vinyāsa',
    description:
      'Build leg strength and balance through a grounding standing sequence. Great for building a strong foundation.',
    difficulty: 'beginner',
    durationMins: 12,
    steps: [
      { pose: 'Tadasana' },
      { pose: 'Utkatasana' },
      { pose: 'Virabhadrasana I', sideNote: 'Right foot forward.' },
      { pose: 'Virabhadrasana II', sideNote: 'Right side.' },
      { pose: 'Utthita Parsvakonasana', sideNote: 'Right side.' },
      { pose: 'Trikonasana', sideNote: 'Right side.' },
      { pose: 'Prasarita Padottanasana' },
      { pose: 'Virabhadrasana II', sideNote: 'Right side again.' },
      { pose: 'Utkatasana' },
      { pose: 'Tadasana', sideNote: 'Now switch to left side.' },
      { pose: 'Utkatasana' },
      { pose: 'Virabhadrasana I', sideNote: 'Left foot forward.' },
      { pose: 'Virabhadrasana II', sideNote: 'Left side.' },
      { pose: 'Utthita Parsvakonasana', sideNote: 'Left side.' },
      { pose: 'Trikonasana', sideNote: 'Left side.' },
      { pose: 'Prasarita Padottanasana' },
      { pose: 'Virabhadrasana II', sideNote: 'Left side again.' },
      { pose: 'Utkatasana' },
      { pose: 'Tadasana' },
    ],
  },

  // ── Gentle Morning Flow ──────────────────────────────────────────────────
  {
    id: 'gentle-morning',
    name: 'Gentle Morning Flow',
    sanskritName: 'Prātaḥ Vinyāsa',
    description:
      'A soft wake-up sequence to ease stiffness and set a calm, focused tone for the day.',
    difficulty: 'beginner',
    durationMins: 10,
    steps: [
      { pose: 'Sukhasana' },
      { pose: 'Marjaryasana', sideNote: 'Move into Cat Pose on all fours.' },
      { pose: 'Bitilasana', sideNote: 'Inhale into Cow Pose.' },
      { pose: 'Parsva Balasana', sideNote: 'Thread to one side.' },
      { pose: 'Parsva Balasana', sideNote: 'Switch to the other side.' },
      { pose: 'Down Dog' },
      { pose: 'Uttanasana', sideNote: 'Walk your feet to your hands.' },
      { pose: 'Ardha Uttanasana' },
      { pose: 'Tadasana' },
      { pose: 'Hasta Uttanasana' },
      { pose: 'Pranamasana' },
    ],
  },

  // ── Hip Opening Flow ─────────────────────────────────────────────────────
  {
    id: 'hip-opening',
    name: 'Hip Opening Flow',
    sanskritName: 'Nitamba Vinyāsa',
    description:
      'Release tightness in hips and inner thighs with a blend of lunges, squats, and seated openers.',
    difficulty: 'beginner',
    durationMins: 15,
    steps: [
      { pose: 'Sukhasana' },
      { pose: 'Baddha Konasana' },
      { pose: 'malasana', sideNote: 'Rise into Garland Pose.' },
      { pose: 'Anjaneyasana', sideNote: 'Right leg back.' },
      { pose: 'Prasarita Padottanasana' },
      { pose: 'Goddess' },
      { pose: 'Anjaneyasana', sideNote: 'Left leg back.' },
      { pose: 'Baddha Konasana' },
      { pose: 'Sukhasana' },
    ],
  },

  // ── Core & Balance ───────────────────────────────────────────────────────
  {
    id: 'core-balance',
    name: 'Core & Balance',
    sanskritName: 'Sthiti Śakti',
    description:
      'Strengthen the core and sharpen balance with standing balances and plank variations.',
    difficulty: 'intermediate',
    durationMins: 12,
    steps: [
      { pose: 'Tadasana' },
      { pose: 'Utkatasana' },
      { pose: 'Vrksasana', sideNote: 'Lift left leg.' },
      { pose: 'Virabhadrasana III Prep', sideNote: 'Left leg back.' },
      { pose: 'Virabhadrasana I', sideNote: 'Left leg back.' },
      { pose: 'Virabhadrasana II', sideNote: 'Left side.' },
      { pose: 'Trikonasana', sideNote: 'Left side.' },
      { pose: 'Natarajasana Prep', sideNote: 'Left leg back.' },
      { pose: 'Tadasana' },
      { pose: 'Utkatasana' },
      { pose: 'Vrksasana', sideNote: 'Lift right leg.' },
      { pose: 'Virabhadrasana III Prep', sideNote: 'Right leg back.' },
      { pose: 'Virabhadrasana I', sideNote: 'Right leg back.' },
      { pose: 'Virabhadrasana II', sideNote: 'Right side.' },
      { pose: 'Trikonasana', sideNote: 'Right side.' },
      { pose: 'Natarajasana Prep', sideNote: 'Right leg back.' },
      { pose: 'Tadasana' },
      { pose: 'Parsva Balasana', sideNote: 'Recovery before close.' },
    ],
  },

  // ── Relaxation & Recovery ────────────────────────────────────────────────
  {
    id: 'relaxation-recovery',
    name: 'Relaxation & Recovery',
    sanskritName: 'Viśrānti Krama',
    description:
      'A restorative cooldown that calms the nervous system. Perfect after an intense practice or a long day.',
    difficulty: 'beginner',
    durationMins: 12,
    steps: [
      { pose: 'Vajrasana' },
      { pose: 'Marjaryasana' },
      { pose: 'Bitilasana' },
      { pose: 'Setu Bandhasana', sideNote: 'Roll onto your back for Bridge.' },
      { pose: 'Apanasana' },
      { pose: 'Supta Matsyendrasana', sideNote: 'Twist knees to the left.' },
      { pose: 'Supta Matsyendrasana', sideNote: 'Twist knees to the right.' },
      { pose: 'Ananda Balasana' },
      { pose: 'Savasana' },
    ],
  },

  // ── Seated Flexibility ───────────────────────────────────────────────────
  {
    id: 'seated-flexibility',
    name: 'Seated Flexibility Flow',
    sanskritName: 'Āsana Laghutā',
    description:
      'Improve hamstring and hip flexibility from a seated position — great for desk workers.',
    difficulty: 'beginner',
    durationMins: 10,
    steps: [
      { pose: 'Dandasana' },
      { pose: 'Paschimottanasana' },
      { pose: 'Janu Sirsasana', sideNote: 'Fold over the left leg.' },
      { pose: 'Janu Sirsasana', sideNote: 'Switch to the right leg.' },
      { pose: 'Upavistha Konasana' },
      { pose: 'Baddha Konasana' },
      { pose: 'Sukhasana' },
    ],
  },

  // ── Back Strength ────────────────────────────────────────────────────────
  {
    id: 'back-strength',
    name: 'Back Body Strength',
    sanskritName: 'Pṛṣṭha Bala',
    description:
      'Strengthen the posterior chain and improve posture with prone backbend-focused practice.',
    difficulty: 'beginner',
    durationMins: 10,
    steps: [
      { pose: 'Vajrasana' },
      { pose: 'Marjaryasana' },
      { pose: 'Bitilasana' },
      { pose: 'Salamba Bhujangasana', sideNote: 'Lower onto your belly for Sphinx.' },
      { pose: 'Bhujangasana' },
      { pose: 'Salabhasana' },
      { pose: 'Makarasana', sideNote: 'Rest in Crocodile Pose.' },
      { pose: 'Apanasana', sideNote: 'Roll onto your back.' },
      { pose: 'Savasana' },
    ],
  },
]
