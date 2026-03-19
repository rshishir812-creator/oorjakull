import { useCallback, useEffect, useRef, useState } from 'react'

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface PoseResultData {
  pose: string
  score: number | null
  correctionMessage: string
  correctionBullets: string[]
  positiveObservation: string
  breathCue: string
  safetyNote: string | null
}

export interface SessionResult {
  pose: string
  score: number | null
  timestamp: number
}

export type ChatMessageType = 'text' | 'pose-result' | 'session-summary'

export interface ChatMessage {
  id: string
  sender: 'bot' | 'user'
  type: ChatMessageType
  text?: string
  poseResult?: PoseResultData
  sessionSummary?: {
    userName: string
    totalPoses: number
    averageScore: number
    bestPose: { pose: string; score: number }
    results: SessionResult[]
  }
  timestamp: number
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

export function useChatStore(userName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const sessionResultsRef = useRef<SessionResult[]>([])
  const initializedRef = useRef(false)

  // Auto-send welcome message once userName is set
  useEffect(() => {
    if (userName && !initializedRef.current) {
      initializedRef.current = true
      setMessages([
        {
          id: uid(),
          sender: 'bot',
          type: 'text',
          text: `Namaste, ${userName}! 🙏 Welcome to OorjaKull AI Yoga.\n\nI'm your practice companion. Ask me anything about yoga, or start a pose — I'll track your progress throughout this session!`,
          timestamp: Date.now(),
        },
      ])
    }
  }, [userName])

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const addBotMessage = useCallback((text: string, incrementUnread = true) => {
    const msg: ChatMessage = { id: uid(), sender: 'bot', type: 'text', text, timestamp: Date.now() }
    setMessages((prev) => [...prev, msg])
    if (incrementUnread) setUnreadCount((prev) => prev + 1)
  }, [])

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = { id: uid(), sender: 'user', type: 'text', text, timestamp: Date.now() }
    setMessages((prev) => [...prev, msg])
  }, [])

  const addPoseResult = useCallback((data: PoseResultData) => {
    sessionResultsRef.current.push({ pose: data.pose, score: data.score, timestamp: Date.now() })
    const msg: ChatMessage = {
      id: uid(),
      sender: 'bot',
      type: 'pose-result',
      poseResult: data,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
    setUnreadCount((prev) => prev + 1)
  }, [])

  const addSessionSummary = useCallback(() => {
    const results = sessionResultsRef.current

    if (results.length === 0) {
      const msg: ChatMessage = {
        id: uid(),
        sender: 'bot',
        type: 'text',
        text: 'No poses were completed in this session. Try a pose and I\u2019ll track your progress! 🧘',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, msg])
      setUnreadCount((prev) => prev + 1)
      return
    }

    const scored = results.filter((r) => r.score !== null && r.score !== undefined)
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length)
        : 0

    let best = { pose: 'N/A', score: 0 }
    for (const r of scored) {
      if ((r.score ?? 0) > best.score) {
        best = { pose: r.pose, score: r.score ?? 0 }
      }
    }

    const msg: ChatMessage = {
      id: uid(),
      sender: 'bot',
      type: 'session-summary',
      sessionSummary: {
        userName,
        totalPoses: results.length,
        averageScore: avgScore,
        bestPose: best,
        results,
      },
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
    setUnreadCount((prev) => prev + 1)

    // Reset for next session
    sessionResultsRef.current = []
  }, [userName])

  const markRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) setUnreadCount(0) // mark read when opening
      return !prev
    })
  }, [])

  return {
    messages,
    unreadCount,
    chatOpen,
    setChatOpen,
    toggleChat,
    addBotMessage,
    addUserMessage,
    addPoseResult,
    addSessionSummary,
    markRead,
  }
}
