'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, Lock, Plus } from 'lucide-react'
import { getBackendBaseUrl } from '@/lib/backend'

interface Session {
  id: string
  name: string
  created_at?: string
  sealed?: boolean
}

interface SessionWithStats extends Session {
  requests: number
  redacted: number
}

interface SessionListProps {
  onSessionSelect: (sessionId: string) => void
}

async function fetchSessions(): Promise<Session[]> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/sessions`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

async function fetchSessionEvents(sessionId: string): Promise<{ count: number; redacted: number }> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/sessions/${sessionId}/events`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { count: 0, redacted: 0 }
    }

    const events = await response.json()
    // For now, redacted count is 0 since backend doesn't track it yet
    return { count: events.length || 0, redacted: 0 }
  } catch (error) {
    console.error('Error fetching session events:', error)
    return { count: 0, redacted: 0 }
  }
}

export function SessionList({ onSessionSelect }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessions() {
      setLoading(true)
      const fetchedSessions = await fetchSessions()
      
      // Fetch event counts for each session
      const sessionsWithStats = await Promise.all(
        fetchedSessions.map(async (session) => {
          const { count, redacted } = await fetchSessionEvents(session.id)
          return {
            ...session,
            requests: count,
            redacted,
          }
        })
      )

      setSessions(sessionsWithStats)
      setLoading(false)
    }

    loadSessions()
  }, [])

  const handleNewSession = async () => {
    const name = prompt('Enter session name:')
    if (!name) return

    try {
      const response = await fetch(`${getBackendBaseUrl()}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        const newSession = await response.json()
        setSessions([
          {
            ...newSession,
            requests: 0,
            redacted: 0,
          },
          ...sessions,
        ])
      }
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="p-6 border-b border-blue-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-mono font-semibold text-blue-200 tracking-wide">Sessions</h2>
            <p className="text-sm font-mono text-blue-400/70 mt-1">
              {loading ? 'Loading...' : `${sessions.length} total sessions`}
            </p>
          </div>
          <button
            onClick={handleNewSession}
            className="px-4 py-2 rounded border border-blue-600/70 bg-blue-600/10 text-blue-200 font-mono text-sm hover:bg-blue-600/20 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-blue-400/70 font-mono">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-blue-400/70 font-mono">No sessions found. Create a new session to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-blue-900/50">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} onSelect={onSessionSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({ session, onSelect }: { session: SessionWithStats; onSelect: (sessionId: string) => void }) {
  const startTime = session.created_at ? new Date(session.created_at) : new Date()

  return (
    <button
      onClick={() => onSelect(session.id)}
      className="w-full px-6 py-4 pointer-events-auto hover:bg-blue-600/10 border-b border-blue-900/50 last:border-b-0 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-sm font-mono font-semibold text-blue-200 truncate">{session.name}</h3>
            {session.redacted > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-blue-600/50 bg-blue-600/20 text-blue-300 text-xs font-mono whitespace-nowrap">
                <Lock className="w-3 h-3" />
                <span>{session.redacted} redacted</span>
              </div>
            )}
            {!session.sealed && (
              <span className="flex items-center gap-2 px-2 py-0.5 rounded border border-orange-500/50 bg-orange-500/20 text-orange-400 text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Recording
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-blue-400/70 font-mono">
            <span>{format(startTime, 'MMM dd, HH:mm')}</span>
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-blue-400/70" />
              {session.requests} requests
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-blue-400/70 flex-shrink-0" />
      </div>
    </button>
  )
}
