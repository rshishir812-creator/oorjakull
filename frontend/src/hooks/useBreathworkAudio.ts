import { useCallback, useRef, useEffect } from 'react'

type SoundType = 'inhale' | 'hold' | 'exhale'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createGongBuffer = (context: AudioContext, type: SoundType): AudioBuffer => {
  const sampleRate = context.sampleRate
  const duration = 0.8
  const frameCount = sampleRate * duration
  const audioBuffer = context.createBuffer(1, frameCount, sampleRate)
  const data = audioBuffer.getChannelData(0)

  let i = 0
  while (i < frameCount) {
    const t = i / sampleRate
    let frequency = 330
    let sample = 0.0

    if (type === 'inhale') {
      const progress = Math.min(t / (duration * 0.3), 1)
      frequency = 220 + (440 - 220) * Math.pow(progress, 0.8)
      const phase = (2 * Math.PI * frequency * t) % (2 * Math.PI)
      const primary = Math.sin(phase)
      const harmonic = Math.sin(phase * 2.5) * 0.3
      let envelope = 1.0
      if (t < 0.05) {
        envelope = t / 0.05
      }
      if (t > duration * 0.8) {
        envelope = (duration - t) / (duration * 0.2)
      }
      sample = (primary + harmonic) * envelope * 0.4
    } else if (type === 'hold') {
      const vibrato = Math.sin(2 * Math.PI * 4 * t) * 20
      const phase = (2 * Math.PI * (frequency + vibrato) * t) % (2 * Math.PI)
      const primary = Math.sin(phase)
      const harmonic = Math.sin(phase * 1.5) * 0.4
      let envelope = 1.0
      if (t < 0.08) {
        envelope = t / 0.08
      }
      if (t > duration * 0.7) {
        envelope = (duration - t) / (duration * 0.3)
      }
      sample = (primary + harmonic) * envelope * 0.35
    } else if (type === 'exhale') {
      const progress = Math.min(t / (duration * 0.4), 1)
      frequency = 440 - (440 - 220) * Math.pow(progress, 1.2)
      const phase = (2 * Math.PI * frequency * t) % (2 * Math.PI)
      const primary = Math.sin(phase)
      const harmonic = Math.sin(phase * 2) * 0.25
      let envelope = 1.0
      if (t < 0.06) {
        envelope = t / 0.06
      }
      if (t > duration * 0.75) {
        envelope = (duration - t) / (duration * 0.25)
      }
      sample = (primary + harmonic) * envelope * 0.4
    }

    data[i] = sample
    i += 1
  }

  return audioBuffer
}

export const useBreathworkAudio = (enabled: boolean = true, volume: number = 0.7) => {
  const contextRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Map<SoundType, AudioBuffer>>(new Map())

  useEffect(() => {
    if (!enabled) return

    const audioContext =
      contextRef.current ||
      new (window.AudioContext || (window as any).webkitAudioContext)()
    contextRef.current = audioContext

    const sounds: SoundType[] = ['inhale', 'hold', 'exhale']
    for (const sound of sounds) {
      if (!buffersRef.current.has(sound)) {
        const buffer = createGongBuffer(audioContext, sound)
        buffersRef.current.set(sound, buffer)
      }
    }
  }, [enabled])

  const playSound = useCallback(
    (type: SoundType) => {
      const context = contextRef.current
      const buffer = buffersRef.current.get(type)

      if (!context || !buffer || !enabled) return

      const source = context.createBufferSource()
      source.buffer = buffer

      const gainNode = context.createGain()
      gainNode.gain.setValueAtTime(0, context.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.05)
      gainNode.gain.linearRampToValueAtTime(0, context.currentTime + buffer.duration - 0.05)

      source.connect(gainNode)
      gainNode.connect(context.destination)
      source.start(context.currentTime)

      source.onended = () => {
        source.disconnect()
        gainNode.disconnect()
      }
    },
    [enabled, volume],
  )

  return { playSound }
}
