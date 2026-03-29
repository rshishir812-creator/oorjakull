import { useCallback, useRef } from 'react'
import { synthesizeSpeech } from '../api/client'
import { POSE_DESCRIPTIONS } from '../data/poseDescriptions'

export type VoiceGender = 'male' | 'female'

export type VoiceLanguageCode = 'en-IN' | 'hi-IN' | 'kn-IN' | 'bn-IN' | 'mr-IN' | 'gu-IN'

export interface VoiceSettings {
  languageCode: VoiceLanguageCode
  rate: number          // 0.5 – 1.5  → maps to Cloud TTS speakingRate
  pitch: number         // 0.5 – 1.5  → mapped to semitones: (pitch - 1) * 20
  volume: number        // 0 – 1      → applied client-side on the Audio element
  gender: VoiceGender   // selects en-IN-Neural2-A (female) or en-IN-Neural2-B (male)
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  languageCode: 'en-IN',
  rate: 1.00,
  pitch: 1.05,
  volume: 0.92,
  gender: 'female',
}

export interface VoiceGuide {
  /** Speak text via Cloud TTS. onEnd fires when audio completes (or after 5 s if voice disabled). */
  speak: (text: string, onEnd?: () => void) => void
  /**
   * Rate-limited speak for live feedback (2 s min gap, skips duplicate text).
   * onEnd fires when audio completes.
   */
  speakFeedback: (text: string, onEnd?: () => void) => void
  /** Cancel any in-progress audio. */
  cancel: () => void
}

// ── In-memory audio cache ──────────────────────────────────────────────────
// Key: `${lang}:${gender}:${rate}:${pitch}:${text}` → Value: Blob (MP3)
const audioCache = new Map<string, Blob>()
const MAX_CACHE = 50

type Replacement = { from: string; to: string }

const POSE_NAME_REPLACEMENTS: Replacement[] = (() => {
  const pairs: Replacement[] = []
  const seen = new Set<string>()

  for (const poseKey of Object.keys(POSE_DESCRIPTIONS)) {
    const desc = POSE_DESCRIPTIONS[poseKey]
    if (!desc?.sanskritName) continue

    // Replace the pose key itself (often used across the app)
    if (poseKey && !seen.has(poseKey)) {
      pairs.push({ from: poseKey, to: desc.sanskritName })
      seen.add(poseKey)
    }

    // Replace the English display name when available
    if (desc.englishName && !seen.has(desc.englishName)) {
      pairs.push({ from: desc.englishName, to: desc.sanskritName })
      seen.add(desc.englishName)
    }
  }

  // Longer first to avoid partial overlaps (e.g., "Warrior" inside "Warrior II")
  pairs.sort((a, b) => b.from.length - a.from.length)
  return pairs
})()

function normalizePoseNamesToSanskrit(text: string): string {
  if (!text) return text
  let output = text
  for (const { from, to } of POSE_NAME_REPLACEMENTS) {
    if (from && output.includes(from)) {
      output = output.split(from).join(to)
    }
  }
  return output
}

function cacheKey(text: string, languageCode: string, gender: VoiceGender, rate: number, pitch: number): string {
  return `${languageCode}:${gender}:${rate.toFixed(2)}:${pitch.toFixed(2)}:${text}`
}

function cacheSet(key: string, blob: Blob) {
  if (audioCache.size >= MAX_CACHE) {
    // Evict oldest entry
    const firstKey = audioCache.keys().next().value
    if (firstKey !== undefined) audioCache.delete(firstKey)
  }
  audioCache.set(key, blob)
}

// ── Resolve the backend base URL (same logic as App.tsx) ───────────────────
function getBaseUrl(): string {
  return (
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, '').replace(/\/$/, '') ??
    'http://localhost:8000'
  )
}

export function useVoiceGuide(
  voiceEnabled: boolean,
  settings: VoiceSettings = DEFAULT_VOICE_SETTINGS,
): VoiceGuide {
  const lastSpokenRef = useRef<string>('')
  const lastSpeakTsRef = useRef<number>(0)
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentObjectUrlRef = useRef<string | null>(null)

  /** Stop currently-playing audio and revoke its object URL. */
  const stopAudio = useCallback(() => {
    const audio = currentAudioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      currentAudioRef.current = null
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current)
      currentObjectUrlRef.current = null
    }
  }, [])

  /** Play a Blob and call onEnd when it finishes. */
  const playBlob = useCallback(
    (blob: Blob, volume: number, onEnd?: () => void) => {
      stopAudio()
      const url = URL.createObjectURL(blob)
      currentObjectUrlRef.current = url
      const audio = new Audio(url)
      audio.volume = volume
      currentAudioRef.current = audio
      audio.onended = () => {
        stopAudio()
        onEnd?.()
      }
      audio.onerror = () => {
        stopAudio()
        onEnd?.()
      }
      audio.play().catch(() => {
        stopAudio()
        onEnd?.()
      })
    },
    [stopAudio],
  )

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      // Clear any pending silent timer
      if (silentTimerRef.current !== null) {
        clearTimeout(silentTimerRef.current)
        silentTimerRef.current = null
      }

      // Stop any currently-playing audio
      stopAudio()

      if (!voiceEnabled) {
        // When voice is off, fire onEnd after 5 s so the app flow continues
        if (onEnd) {
          silentTimerRef.current = setTimeout(() => {
            silentTimerRef.current = null
            onEnd()
          }, 5000)
        }
        return
      }

      const normalizedText = normalizePoseNamesToSanskrit(text)
      const key = cacheKey(normalizedText, settings.languageCode, settings.gender, settings.rate, settings.pitch)
      const cached = audioCache.get(key)

      if (cached) {
        playBlob(cached, settings.volume, onEnd)
        return
      }

      // Map pitch from 0.5-1.5 slider to -10..+10 semitones for Cloud TTS
      const pitchSemitones = (settings.pitch - 1.0) * 20.0

      synthesizeSpeech({
        baseUrl: getBaseUrl(),
        text: normalizedText,
        languageCode: settings.languageCode,
        gender: settings.gender,
        speed: settings.rate,
        pitch: pitchSemitones,
      })
        .then((blob) => {
          cacheSet(key, blob)
          playBlob(blob, settings.volume, onEnd)
        })
        .catch(() => {
          // TTS failed — fire onEnd after a short delay so app flow isn't stuck
          if (onEnd) {
            silentTimerRef.current = setTimeout(() => {
              silentTimerRef.current = null
              onEnd()
            }, 2000)
          }
        })
    },
    [voiceEnabled, settings, stopAudio, playBlob],
  )

  const speakFeedback = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!voiceEnabled || !text) {
        onEnd?.()
        return
      }

      const normalizedText = normalizePoseNamesToSanskrit(text)
      const now = Date.now()
      if (normalizedText === lastSpokenRef.current) {
        onEnd?.()
        return
      }
      if (now - lastSpeakTsRef.current < 2000) {
        onEnd?.()
        return
      }

      lastSpokenRef.current = normalizedText
      lastSpeakTsRef.current = now

      // Reuse speak() which handles caching, audio playback, and error fallback
      speak(normalizedText, onEnd)
    },
    [voiceEnabled, speak],
  )

  const cancel = useCallback(() => {
    if (silentTimerRef.current !== null) {
      clearTimeout(silentTimerRef.current)
      silentTimerRef.current = null
    }
    stopAudio()
  }, [stopAudio])

  return { speak, speakFeedback, cancel }
}
