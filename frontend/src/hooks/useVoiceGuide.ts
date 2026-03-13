import { useCallback, useRef } from 'react'

/**
 * Pick a calm, natural-sounding female voice — ideal for a yoga instructor.
 * Priority: female en-IN voices (best for Sanskrit) → female en-US/en-GB → any en voice.
 */
function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // 1. Premium female en-IN voices (calm, natural, great for Sanskrit)
  const FEMALE_EN_IN = [
    'Microsoft Neerja Online',  // Neural — very natural
    'Microsoft Neerja',
    'Neerja',
    'Google हिन्दी',           // Some Chrome builds expose this for en-IN
    'Veena',                    // macOS / iOS en-IN female
    'Lekha',                    // macOS en-IN female
  ]
  for (const name of FEMALE_EN_IN) {
    const v = voices.find((v) => v.name.includes(name))
    if (v) return v
  }

  // 2. Any female-sounding en-IN voice (avoid "Rishi" which is male)
  const enINFemale = voices.find(
    (v) => v.lang === 'en-IN' && !v.name.toLowerCase().includes('rishi'),
  )
  if (enINFemale) return enINFemale

  // 3. Any en-IN voice at all
  const enIN = voices.find((v) => v.lang === 'en-IN')
  if (enIN) return enIN

  // 4. Calm female voices from other English locales
  const FEMALE_FALLBACK = [
    'Samantha',             // macOS — warm, natural
    'Karen',                // macOS en-AU — soft
    'Moira',                // macOS en-IE — gentle
    'Tessa',                // macOS en-ZA
    'Google UK English Female',
    'Google US English',
    'Microsoft Zira',       // Windows en-US female
  ]
  for (const name of FEMALE_FALLBACK) {
    const v = voices.find((v) => v.name.includes(name))
    if (v) return v
  }

  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null
  )
}

export interface VoiceGuide {
  /** Speak text. onEnd fires when utterance completes (or after 5 s if voice disabled). */
  speak: (text: string, onEnd?: () => void) => void
  /**
   * Rate-limited speak for live feedback (2 s min gap, skips duplicate text).
   * onEnd fires when utterance completes.
   */
  speakFeedback: (text: string, onEnd?: () => void) => void
  /** Cancel any in-progress speech. */
  cancel: () => void
}

export function useVoiceGuide(voiceEnabled: boolean): VoiceGuide {
  const lastSpokenRef = useRef<string>('')
  const lastSpeakTsRef = useRef<number>(0)
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (silentTimerRef.current !== null) {
        clearTimeout(silentTimerRef.current)
        silentTimerRef.current = null
      }

      if (!voiceEnabled) {
        if (onEnd) {
          silentTimerRef.current = setTimeout(() => {
            silentTimerRef.current = null
            onEnd()
          }, 5000)
        }
        return
      }

      window.speechSynthesis.cancel()

      const doSpeak = () => {
        const u = new SpeechSynthesisUtterance(text)
        u.rate = 0.82     // slower — calm, instructor-like pacing
        u.pitch = 1.05    // slightly higher — softer, feminine tone
        u.volume = 0.92   // slightly under max — gentler on the ear
        const voice = getPreferredVoice()
        if (voice) u.voice = voice
        if (onEnd) u.onend = () => onEnd()
        window.speechSynthesis.speak(u)
      }

      if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak()
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true })
        setTimeout(() => {
          if (!window.speechSynthesis.speaking) doSpeak()
        }, 300)
      }
    },
    [voiceEnabled],
  )

  const speakFeedback = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!voiceEnabled || !text) {
        onEnd?.()
        return
      }
      const now = Date.now()
      if (text === lastSpokenRef.current) {
        onEnd?.()
        return
      }
      if (now - lastSpeakTsRef.current < 2000) {
        onEnd?.()
        return
      }

      lastSpokenRef.current = text
      lastSpeakTsRef.current = now

      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.82     // calm, instructor-like pacing
      u.pitch = 1.05    // softer, feminine tone
      u.volume = 0.92   // gentle volume
      const voice = getPreferredVoice()
      if (voice) u.voice = voice
      if (onEnd) u.onend = () => onEnd()
      window.speechSynthesis.speak(u)
    },
    [voiceEnabled],
  )

  const cancel = useCallback(() => {
    if (silentTimerRef.current !== null) {
      clearTimeout(silentTimerRef.current)
      silentTimerRef.current = null
    }
    window.speechSynthesis.cancel()
  }, [])

  return { speak, speakFeedback, cancel }
}
