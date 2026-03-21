import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChatMessage, PoseResultData, ProductSuggestion } from '../hooks/useChatStore'
import { callAssistant } from '../api/client'

/* ── Sub-components ──────────────────────────────────────────────────────── */

function ProductSuggestionCard({
  suggestion,
  onNavigate,
}: {
  suggestion: ProductSuggestion
  onNavigate?: (type: 'breathwork' | 'pose', id: string) => void
}) {
  const icon = suggestion.type === 'breathwork' ? '🌬️' : '🧘'
  const accentClass =
    suggestion.type === 'breathwork'
      ? 'border-teal-200/70 from-teal-50 to-cyan-50 dark:border-teal-800/40 dark:from-teal-950/40 dark:to-cyan-950/30'
      : 'border-emerald-200/70 from-emerald-50 to-teal-50 dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-teal-950/30'
  const btnClass =
    suggestion.type === 'breathwork'
      ? 'bg-teal-500 hover:bg-teal-400'
      : 'bg-emerald-500 hover:bg-emerald-400'

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${accentClass}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-base leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{suggestion.label}</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{suggestion.reason}</div>
        </div>
      </div>
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(suggestion.type, suggestion.id)}
          className={`mt-2.5 w-full rounded-lg py-1.5 text-xs font-semibold text-white transition ${btnClass}`}
        >
          Explore →
        </button>
      )}
    </div>
  )
}

function PoseResultCard({ data }: { data: PoseResultData }) {
  const scoreColor =
    (data.score ?? 0) >= 90
      ? 'text-emerald-500'
      : (data.score ?? 0) >= 70
        ? 'text-amber-500'
        : 'text-rose-500'

  const scoreBg =
    (data.score ?? 0) >= 90
      ? 'bg-emerald-50 dark:bg-emerald-950/40'
      : (data.score ?? 0) >= 70
        ? 'bg-amber-50 dark:bg-amber-950/40'
        : 'bg-rose-50 dark:bg-rose-950/40'

  return (
    <div className={`rounded-xl ${scoreBg} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">🧘 {data.pose}</span>
        <span className={`text-lg font-bold tabular-nums ${scoreColor}`}>
          {data.score ?? '—'}
          <span className="text-xs text-slate-400">/100</span>
        </span>
      </div>

      {data.positiveObservation && (
        <p className="text-xs text-emerald-600 dark:text-emerald-300">✅ {data.positiveObservation}</p>
      )}

      {data.correctionBullets.length > 0 && (
        <div className="space-y-0.5">
          {data.correctionBullets.map((b, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-200">
              ▸ {b}
            </p>
          ))}
        </div>
      )}

      {data.breathCue && (
        <p className="text-xs text-blue-600 dark:text-blue-300">🌬️ {data.breathCue}</p>
      )}

      {data.safetyNote && (
        <p className="text-xs text-red-600 dark:text-red-300">⚠️ {data.safetyNote}</p>
      )}
    </div>
  )
}

function SessionSummaryCard({ summary }: { summary: NonNullable<ChatMessage['sessionSummary']> }) {
  const avgColor =
    summary.averageScore >= 90
      ? 'text-emerald-500'
      : summary.averageScore >= 70
        ? 'text-amber-500'
        : 'text-rose-500'

  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/40 dark:to-teal-950/40 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-800 dark:text-white">🏆 Session Complete!</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Great work, {summary.userName}!
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-slate-800 dark:text-white">{summary.totalPoses}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Poses Tried</div>
        </div>
        <div>
          <div className={`text-lg font-bold ${avgColor}`}>{summary.averageScore}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Avg Score</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-500">{summary.bestPose.score}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Best Score</div>
        </div>
      </div>

      {summary.bestPose.pose !== 'N/A' && (
        <div className="text-center text-xs text-slate-600 dark:text-slate-300">
          ⭐ Best pose: <span className="font-semibold">{summary.bestPose.pose}</span>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          All Results
        </div>
        {summary.results.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-700 dark:text-slate-300">{r.pose}</span>
            <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
              {r.score ?? '—'}/100
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────────────────────── */

interface ChatBotProps {
  messages: ChatMessage[]
  unreadCount: number
  open: boolean
  onToggle: () => void
  onSendMessage: (text: string) => void
  onBotReply: (text: string) => void
  onBotSuggestion?: (suggestion: ProductSuggestion) => void
  onNavigate?: (type: 'breathwork' | 'pose', id: string) => void
  userName: string
  baseUrl: string
}

export default function ChatBot({
  messages,
  unreadCount,
  open,
  onToggle,
  onSendMessage,
  onBotReply,
  onBotSuggestion,
  onNavigate,
  baseUrl,
}: ChatBotProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    onSendMessage(text)
    setInput('')

    // Convert chat history to format expected by assistant
    // Filter for 'text' messages only and cap at 10
    const history = messages
      .filter((msg) => msg.type === 'text')
      .slice(-10)
      .map((msg) => ({
        role: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.text || '',
      }))

    try {
      // Call backend assistant endpoint
      const result = await callAssistant({
        baseUrl,
        message: text,
        messages: history,
      })
      onBotReply(result.reply)
      if (result.suggestion && onBotSuggestion) {
        onBotSuggestion(result.suggestion)
      }
    } catch (error) {
      console.error('Assistant error:', error)
      onBotReply("I'm having a moment of stillness — please try again shortly.")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputFocus = () => {
    window.setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3">
      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex h-[480px] max-h-[calc(100vh-6rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧘</span>
                <div>
                  <div className="text-sm font-semibold text-white">Madhu</div>
                  <div className="text-[10px] text-emerald-100">Your yoga companion</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] text-sm leading-relaxed ${
                      msg.type === 'text'
                        ? msg.sender === 'user'
                          ? 'rounded-2xl rounded-br-md bg-emerald-500 px-3.5 py-2.5 text-white'
                          : 'rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        : '' /* rich cards have their own styling */
                    }`}
                  >
                    {msg.type === 'text' && <span className="whitespace-pre-wrap">{msg.text}</span>}
                    {msg.type === 'pose-result' && msg.poseResult && (
                      <PoseResultCard data={msg.poseResult} />
                    )}
                    {msg.type === 'session-summary' && msg.sessionSummary && (
                      <SessionSummaryCard summary={msg.sessionSummary} />
                    )}
                    {msg.type === 'product-suggestion' && msg.suggestion && (
                      <ProductSuggestionCard suggestion={msg.suggestion} onNavigate={onNavigate} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about yoga…"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 dark:border-white/10 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-400 disabled:opacity-40"
                >
                  ↑
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        type="button"
        onClick={onToggle}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg shadow-emerald-500/30 transition-colors hover:bg-emerald-400"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {open ? '✕' : '💬'}
        {/* Notification badge */}
        {!open && unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>
    </div>
  )
}
