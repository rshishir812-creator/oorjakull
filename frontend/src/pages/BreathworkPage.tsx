import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BreathworkProtocol } from '../api/client'
import { fetchBreathworkProtocols } from '../api/client'
import BreathworkIcon from '../components/BreathworkIcons'
import BreathworkInfoSheet from '../components/BreathworkInfoSheet'

interface BreathworkPageProps {
  baseUrl: string
  onBackHome: () => void
  onStartSession: (protocol: BreathworkProtocol) => void
  toastMessage?: string | null
  onToastDone?: () => void
}

function tagClass(kind: 'hr' | 'hrv' | 'temp', value: 'increase' | 'decrease' | 'steady' | null) {
  if (kind === 'hr') {
    if (value === 'increase') return 'border-[#ff6b6b]/30 bg-[#ff6b6b]/10 text-[#ff8b8b]'
    if (value === 'decrease') return 'border-[#4ecdc4]/30 bg-[#4ecdc4]/10 text-[#7de0d8]'
    return 'border-white/10 bg-white/5 text-slate-300'
  }
  if (kind === 'hrv') {
    if (value === 'increase') return 'border-amber-300/30 bg-amber-300/10 text-amber-200'
    if (value === 'decrease') return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    return 'border-white/10 bg-white/5 text-slate-300'
  }
  if (value === 'increase') return 'border-orange-300/30 bg-orange-300/10 text-orange-200'
  if (value === 'decrease') return 'border-sky-300/30 bg-sky-300/10 text-sky-200'
  return 'border-white/10 bg-white/5 text-slate-300'
}

function effectTag(label: string, value: 'increase' | 'decrease' | 'steady' | null) {
  const symbol = value === 'increase' ? '↑' : value === 'decrease' ? '↓' : value === 'steady' ? '•' : ''
  return value === null ? null : `${label} ${symbol}`
}

function SkeletonTile() {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="animate-pulse">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/5" />
            <div className="h-3 w-52 rounded bg-white/5" />
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-16 rounded-full bg-white/5" />
              <div className="h-6 w-16 rounded-full bg-white/5" />
              <div className="h-6 w-16 rounded-full bg-white/5" />
            </div>
          </div>
          <div className="h-6 w-6 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  )
}

export default function BreathworkPage({
  baseUrl,
  onBackHome,
  onStartSession,
  toastMessage,
  onToastDone,
}: BreathworkPageProps) {
  const [protocols, setProtocols] = useState<BreathworkProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [infoProtocol, setInfoProtocol] = useState<BreathworkProtocol | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchBreathworkProtocols({ baseUrl })
      .then((data) => {
        if (cancelled) return
        setProtocols(data)
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load breathwork protocols right now. Please try again.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [baseUrl])

  useEffect(() => {
    if (!toastMessage || !onToastDone) return
    const timer = window.setTimeout(() => onToastDone(), 2200)
    return () => window.clearTimeout(timer)
  }, [toastMessage, onToastDone])

  const grouped = useMemo(() => {
    const map = new Map<string, BreathworkProtocol[]>()
    for (const protocol of protocols) {
      const existing = map.get(protocol.category) ?? []
      existing.push(protocol)
      map.set(protocol.category, existing)
    }
    return Array.from(map.entries())
  }, [protocols])

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[#0a0a0a] text-white">
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(78,205,196,0.22), transparent 30%), radial-gradient(circle at 80% 30%, rgba(45,88,130,0.18), transparent 32%), radial-gradient(circle at 50% 100%, rgba(24,60,88,0.22), transparent 42%)',
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-6 flex justify-start sm:mb-8">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <span aria-hidden="true">←</span>
            Back to home
          </button>
        </div>

        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <p className="font-cinzel text-sm uppercase tracking-[0.35em] text-teal-300/80">OorjaKull Breathwork</p>
          <h1 className="mt-3 font-cinzel text-4xl font-semibold tracking-[0.06em] text-white sm:text-5xl">
            Guided breath rituals for regulation, focus, and energy
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Explore calming, balancing, and activating protocols. Each session guides your rhythm visually using the OorjaKull logo so your breath, mind, and body move together.
          </p>
        </motion.div>

        {loading && (
          <div className="space-y-10">
            {[0, 1].map((section) => (
              <div key={section}>
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="font-cinzel text-sm uppercase tracking-[0.2em] text-teal-300/90">
                    Loading Breathwork
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-teal-400/40 to-transparent" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <SkeletonTile key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] border border-[#ff6b6b]/20 bg-[#ff6b6b]/8 p-6 text-[#ffd3d3] backdrop-blur-xl">
            <p className="font-cinzel text-lg">Unable to open Breathwork</p>
            <p className="mt-2 text-sm text-[#ffd3d3]/85">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full border border-[#ff6b6b]/30 px-4 py-2 text-sm font-medium transition hover:bg-[#ff6b6b]/10"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && grouped.map(([category, items], sectionIndex) => (
          <motion.section
            key={category}
            className="mb-12"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: sectionIndex * 0.06 }}
          >
            <div className="mb-5 flex items-center gap-4">
              <h2 className="font-cinzel text-sm uppercase tracking-[0.2em] text-[#4ecdc4]">
                {category}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-[#4ecdc4]/45 to-transparent" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((protocol) => (
                <motion.div
                  key={protocol.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onStartSession(protocol)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onStartSession(protocol)
                    }
                  }}
                  className="group relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-[#4ecdc4]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4ecdc4]"
                  whileHover={{ y: -2 }}
                >
                  <div className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-full bg-transparent transition group-hover:bg-[#4ecdc4]" />
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4ecdc4]/30 via-[#2f7f85]/25 to-[#15363d]/30 text-[#8ff7ef] shadow-lg shadow-[#4ecdc4]/10">
                      <BreathworkIcon protocol={protocol} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-white">{protocol.name}</h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {protocol.tagline} • {protocol.duration_mins} min
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInfoProtocol(protocol)
                          }}
                          aria-label={`Learn more about ${protocol.name}`}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-slate-300 transition hover:border-[#4ecdc4]/30 hover:text-[#9beddf]"
                        >
                          ⓘ
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {effectTag('HR', protocol.effects.hr) && (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tagClass('hr', protocol.effects.hr)}`}>
                            {effectTag('HR', protocol.effects.hr)}
                          </span>
                        )}
                        {effectTag('HRV', protocol.effects.hrv) && (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tagClass('hrv', protocol.effects.hrv)}`}>
                            {effectTag('HRV', protocol.effects.hrv)}
                          </span>
                        )}
                        {effectTag('Temp', protocol.effects.temperature) && (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tagClass('temp', protocol.effects.temperature)}`}>
                            {effectTag('Temp', protocol.effects.temperature)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-1 text-xl text-slate-500 transition group-hover:text-[#9beddf]">→</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-teal-400/25 bg-[#0f181b]/90 px-4 py-2 text-sm font-medium text-teal-100 shadow-xl shadow-black/30 backdrop-blur-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <BreathworkInfoSheet
        protocol={infoProtocol}
        onClose={() => setInfoProtocol(null)}
        onBegin={(protocol) => {
          setInfoProtocol(null)
          onStartSession(protocol)
        }}
      />
    </div>
  )
}
