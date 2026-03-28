import type { ExpectedPose, FocusArea, Severity } from '../api/client'

export type PoseCategory = 'standing' | 'sun-salutation' | 'balance' | 'seated' | 'kneeling' | 'backbend' | 'supine' | 'arms'

export const POSE_CATEGORY_LABELS: Record<PoseCategory, { label: string; icon: string; order: number }> = {
  'sun-salutation': { label: 'Sun Salutation',       icon: 'sun',             order: 0 },
  'standing':       { label: 'Standing Poses',       icon: 'person-standing', order: 1 },
  'balance':        { label: 'Balance',               icon: 'tree',            order: 2 },
  'kneeling':       { label: 'Kneeling & All-Fours', icon: 'person-kneeling', order: 3 },
  'seated':         { label: 'Seated & Floor',        icon: 'flower',          order: 4 },
  'arms':           { label: 'Arms & Upper Body',    icon: 'hand-raised',     order: 5 },
  'backbend':       { label: 'Prone & Backbends',    icon: 'curve',           order: 6 },
  'supine':         { label: 'Supine & Cooldown',    icon: 'crescent-moon',   order: 7 },
}

export type PoseReference = {
  pose: ExpectedPose
  kind: 'image' | 'video'
  src: string
  /** Stable pose_id matching backend pose_library.json */
  poseId?: string
  /** Category for grouping on the landing page */
  category: PoseCategory
}

// ── Available reference images (images we actually ship) ───────────────────
export const POSE_REFERENCES: PoseReference[] = [
  // ── Sun Salutation ───────────────────────────────────────────────────────
  { pose: 'Pranamasana',            kind: 'image', src: '/poses/train/Pranamasana.jpeg',                poseId: 'pranamasana',            category: 'sun-salutation' },
  { pose: 'Hasta Uttanasana',       kind: 'image', src: '/poses/train/Hasta%20Uttanasana.png',          poseId: 'hasta_uttanasana',       category: 'sun-salutation' },
  { pose: 'Padahastasana',          kind: 'image', src: '/poses/train/Padahastasana.png',               poseId: 'padahastasana',          category: 'sun-salutation' },
  { pose: 'Ashwa Sanchalanasana',   kind: 'image', src: '/poses/train/Ashwa%20Sanchalanasana.png',      poseId: 'ashwa_sanchalanasana',   category: 'sun-salutation' },
  { pose: 'Plank',                  kind: 'image', src: '/poses/train/Plank.png',                       poseId: 'plank_pose',             category: 'sun-salutation' },
  { pose: 'Down Dog',               kind: 'image', src: '/poses/train/Downdog.png',                     poseId: 'down_dog',               category: 'sun-salutation' },

  // ── Standing ─────────────────────────────────────────────────────────────
  { pose: 'Tadasana',               kind: 'image', src: '/poses/train/Tadasana.png',                    poseId: 'mountain_pose',          category: 'standing' },
  { pose: 'Utkatasana',             kind: 'image', src: '/poses/train/Utkatasana.jpeg',                 poseId: 'utkatasana',             category: 'standing' },
  { pose: 'Warrior II',             kind: 'image', src: '/poses/train/Warrior.png',                     poseId: 'warrior_ii',             category: 'standing' },
  { pose: 'Virabhadrasana I',       kind: 'image', src: '/poses/train/Virabhadrasana%20I.jpeg',         poseId: 'virabhadrasana_i',       category: 'standing' },
  { pose: 'Trikonasana',            kind: 'image', src: '/poses/train/Trikonasana.jpeg',                poseId: 'trikonasana',            category: 'standing' },
  { pose: 'Utthita Parsvakonasana', kind: 'image', src: '/poses/train/Utthita%20Parsvakonasana.jpeg',   poseId: 'utthita_parsvakonasana_beginner', category: 'standing' },
  { pose: 'Prasarita Padottanasana',kind: 'image', src: '/poses/train/Prasarita%20Padottanasana.jpeg',  poseId: 'prasarita_padottanasana', category: 'standing' },
  { pose: 'Ardha Uttanasana',       kind: 'image', src: '/poses/train/Ardha%20Uttanasana.jpeg',         poseId: 'ardha_uttanasana',       category: 'standing' },
  { pose: 'Uttanasana',             kind: 'image', src: '/poses/train/Uttanasana.jpeg',                 poseId: 'uttanasana',             category: 'standing' },
  { pose: 'Parsvottanasana',        kind: 'image', src: '/poses/train/Parsvottanasana.jpeg',            poseId: 'parsvottanasana_short_stance', category: 'standing' },
  { pose: 'Goddess',                kind: 'image', src: '/poses/train/Godess.png',                      category: 'standing' },
  { pose: 'malasana',               kind: 'image', src: '/poses/train/Malasana.jpeg',                   poseId: 'malasana',               category: 'standing' },

  // ── Balance ──────────────────────────────────────────────────────────────
  { pose: 'Vrksasana',              kind: 'image', src: '/poses/train/Vrksasana.jpeg',                  poseId: 'vrksasana_low_foot',     category: 'balance' },
  { pose: 'Tandem Balance',         kind: 'image', src: '/poses/train/Tandem%20Balance.jpeg',           poseId: 'heel_to_toe_balance',    category: 'balance' },
  { pose: 'Natarajasana Prep',      kind: 'image', src: '/poses/train/Natarajasana%20Prep.jpeg',        poseId: 'natarajasana_prep (right)', category: 'balance' },
  { pose: 'Virabhadrasana III Prep', kind: 'image', src: '/poses/train/Virabhadrasana%20III%20Prep.jpeg', poseId: 'virabhadrasana_iii_prep(right)', category: 'balance' },

  // ── Kneeling & All-Fours ─────────────────────────────────────────────────
  { pose: 'Marjaryasana',           kind: 'image', src: '/poses/train/Marjaryasana.jpeg',               poseId: 'marjaryasana_cat',       category: 'kneeling' },
  { pose: 'Bitilasana',             kind: 'image', src: '/poses/train/Bitilasana.jpeg',                 poseId: 'bitilasana_cow',         category: 'kneeling' },
  { pose: 'Anjaneyasana',           kind: 'image', src: '/poses/train/Anjaneyasana.png',                poseId: 'anjaneyasana_left',      category: 'kneeling' },
  { pose: 'Ardha Hanumanasana',     kind: 'image', src: '/poses/train/Ardha%20Hanumanasana.jpeg',       poseId: 'ardha_hanumanasana_left', category: 'kneeling' },
  { pose: 'Parsva Balasana',        kind: 'image', src: '/poses/train/Parsva%20Balasana.jpeg',          poseId: 'parsva_balasana_left',   category: 'kneeling' },
  { pose: 'Vajrasana',              kind: 'image', src: '/poses/train/Vajrasana.jpeg',                  poseId: 'vajrasana',              category: 'kneeling' },
  { pose: 'Parvatasana Prep',       kind: 'image', src: '',                                             poseId: 'parvatasana_tabletop',   category: 'kneeling' },
  { pose: 'Parighasana',            kind: 'image', src: '/poses/train/Parighasana.png',                 poseId: 'parighasana',            category: 'kneeling' },

  // ── Seated & Floor ───────────────────────────────────────────────────────
  { pose: 'Sukhasana',              kind: 'image', src: '/poses/train/Sukhasana.jpeg',                  poseId: 'sukhasana',              category: 'seated' },
  { pose: 'Baddha Konasana',        kind: 'image', src: '/poses/train/Baddha%20Konasana.jpeg',          poseId: 'baddha_konasana',        category: 'seated' },
  { pose: 'Janu Sirsasana',         kind: 'image', src: '/poses/train/Janu%20Sirsasana.jpeg',           poseId: 'janu_sirsasana_left',    category: 'seated' },
  { pose: 'Paschimottanasana',      kind: 'image', src: '',   poseId: 'paschimottanasana',              category: 'seated' },
  { pose: 'Upavistha Konasana',     kind: 'image', src: '',   poseId: 'upavistha_konasana_upright',     category: 'seated' },
  { pose: 'Dandasana',              kind: 'image', src: '',   poseId: 'dandasana',                      category: 'seated' },

  // ── Arms & Upper Body ────────────────────────────────────────────────────
  { pose: 'Garudasana Arms',        kind: 'image', src: '',   poseId: 'garudasana_arms',                category: 'arms' },
  { pose: 'Gomukhasana Arms',       kind: 'image', src: '',   poseId: 'gomukhasana_arms',               category: 'arms' },

  // ── Prone & Backbends ────────────────────────────────────────────────────
  { pose: 'Bhujangasana',           kind: 'image', src: '',   poseId: 'bhujangasana',                   category: 'backbend' },
  { pose: 'Salamba Bhujangasana',   kind: 'image', src: '',   poseId: 'sphinx_pose',                    category: 'backbend' },
  { pose: 'Salabhasana',            kind: 'image', src: '',   poseId: 'salabhasana',                    category: 'backbend' },
  { pose: 'Makarasana',             kind: 'image', src: '',   poseId: 'makarasana',                     category: 'backbend' },
  { pose: 'Ustrasana',              kind: 'image', src: '/poses/train/Ustrasana.png',                   poseId: 'ustrasana',              category: 'backbend' },

  // ── Supine & Cooldown ────────────────────────────────────────────────────
  { pose: 'Setu Bandhasana',        kind: 'image', src: '',   poseId: 'setu_bandhasana',                category: 'supine' },
  { pose: 'Apanasana',              kind: 'image', src: '',   poseId: 'apanasana',                      category: 'supine' },
  { pose: 'Supta Matsyendrasana',   kind: 'image', src: '',   poseId: 'supta_matsyendrasana_left',      category: 'supine' },
  { pose: 'Ananda Balasana',        kind: 'image', src: '',   poseId: 'ananda_balasana',                category: 'supine' },
  { pose: 'Supta Baddha Konasana',  kind: 'image', src: '',   poseId: 'supta_baddha_konasana',          category: 'supine' },
  { pose: 'Savasana',               kind: 'image', src: '',   poseId: 'savasana',                       category: 'supine' },
]

/** Lookup helper — returns the first reference for a given pose name. */
export function getReferenceForPose(poseName: string): PoseReference | undefined {
  return POSE_REFERENCES.find(r => r.pose === poseName)
}

/** Lookup by backend pose_id. */
export function getReferenceByPoseId(poseId: string): PoseReference | undefined {
  return POSE_REFERENCES.find(r => r.poseId === poseId)
}

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
