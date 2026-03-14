import { useState } from 'react'
import type { VoiceSettings as VoiceSettingsType, VoiceGender } from '../hooks/useVoiceGuide'

export default function VoiceSettings(props: {
  voiceOn: boolean
  onToggleVoice: (on: boolean) => void
  settings: VoiceSettingsType
  onChangeSettings: (s: VoiceSettingsType) => void
  onPreview?: () => void
}) {
  const { voiceOn, onToggleVoice, settings, onChangeSettings, onPreview } = props
  const [open, setOpen] = useState(false)

  const setGender = (g: VoiceGender) => {
    onChangeSettings({ ...settings, gender: g })
  }

  return (
    <div className="relative z-20">
      {/* Top bar: voice toggle + gear */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 backdrop-blur cursor-pointer">
          <input
            type="checkbox"
            checked={voiceOn}
            onChange={(e) => onToggleVoice(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-emerald-500"
          />
          🔊 Voice
        </label>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          title="Voice settings"
        >
          ⚙
        </button>
      </div>

      {/* Settings dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-72 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-lg">
          <h4 className="mb-3 text-sm font-semibold text-white">Voice Settings</h4>

          {/* Cloud TTS badge */}
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300">
            ☁️ Using Google Cloud TTS — consistent across all browsers
          </div>

          {/* Gender toggle */}
          <label className="block text-xs text-slate-400 mb-1">Voice</label>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {(['female', 'male'] as VoiceGender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ' +
                  (settings.gender === g
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white')
                }
              >
                {g === 'female' ? '👩 Female' : '👨 Male'}
              </button>
            ))}
          </div>

          {/* Voice info */}
          <div className="mt-2 text-[11px] text-slate-500">
            {settings.gender === 'female' ? 'en-IN Neural2-A' : 'en-IN Neural2-B'} · Indian English
          </div>

          {/* Speed */}
          <label className="mt-3 block text-xs text-slate-400">
            Speed: {settings.rate.toFixed(2)}×
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.rate}
              onChange={(e) =>
                onChangeSettings({ ...settings, rate: parseFloat(e.target.value) })
              }
              className="mt-1 block w-full accent-emerald-500"
            />
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Slow</span>
              <span>Fast</span>
            </span>
          </label>

          {/* Pitch */}
          <label className="mt-3 block text-xs text-slate-400">
            Pitch: {settings.pitch.toFixed(2)}
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.pitch}
              onChange={(e) =>
                onChangeSettings({ ...settings, pitch: parseFloat(e.target.value) })
              }
              className="mt-1 block w-full accent-emerald-500"
            />
            <span className="flex justify-between text-[10px] text-slate-500">
              <span>Low</span>
              <span>High</span>
            </span>
          </label>

          {/* Volume */}
          <label className="mt-3 block text-xs text-slate-400">
            Volume: {Math.round(settings.volume * 100)}%
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) =>
                onChangeSettings({ ...settings, volume: parseFloat(e.target.value) })
              }
              className="mt-1 block w-full accent-emerald-500"
            />
          </label>

          {/* Preview + Close */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={!onPreview}
              className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              ▶ Preview
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
