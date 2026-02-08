'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, Lock, Plus } from 'lucide-react'
import { createSession, getSessionEvents, listSessions, listAllSessions, Session } from '@/lib/api'

interface SessionWithStats extends Session {
  requests: number
  redacted: number
}

interface SessionListProps {
  projectId?: string | null
  onSessionSelect: (sessionId: string, projectId: string) => void
}

export function SessionList({ projectId, onSessionSelect }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessions() {
      setLoading(true)
      let fetchedSessions: Session[] = []

      if (projectId) {
        fetchedSessions = await listSessions(projectId)
      } else {
        fetchedSessions = await listAllSessions()
      }

      // Fetch event counts for each session
      const sessionsWithStats = await Promise.all(
        fetchedSessions.map(async (session) => {
          const pid = projectId || session.project_id
          const events = await getSessionEvents(pid, session.id)
          return {
            ...session,
            requests: events.length || 0,
            // For now, redacted count is 0 since backend doesn't track it yet
            redacted: 0,
          }
        })
      )

      setSessions(sessionsWithStats)
      setLoading(false)
    }

    loadSessions()
  }, [projectId])

  const handleNewSession = async () => {
    if (!projectId) return // Cannot create session without a project context

    const name = prompt('Enter session name:')
    if (!name) return

    const newSession = await createSession(projectId, name)

    if (newSession) {
      setSessions([
        {
          ...newSession,
          requests: 0,
          redacted: 0,
        },
        ...sessions,
      ])
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="p-6 border-b border-blue-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-mono font-semibold text-blue-200 tracking-wide">
              {projectId ? 'Project Sessions' : 'All Sessions'}
            </h2>
            <p className="text-sm font-mono text-blue-400/70 mt-1">
              {loading ? 'Loading...' : `${sessions.length} total sessions`}
            </p>
          </div>
          {projectId && (
            <button
              onClick={handleNewSession}
              className="px-4 py-2 rounded border border-blue-600/70 bg-blue-600/10 text-blue-200 font-mono text-sm hover:bg-blue-600/20 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-blue-400/70 font-mono">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-blue-400/70 font-mono">No sessions found. {projectId && 'Create a new session to get started.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-blue-900/50">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} onSelect={onSessionSelect} showProjectTag={!projectId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({ session, onSelect, showProjectTag }: { session: SessionWithStats; onSelect: (sessionId: string, projectId: string) => void; showProjectTag?: boolean }) {
  const startTime = session.created_at ? new Date(session.created_at) : new Date()

  return (
    <button
      onClick={() => onSelect(session.id, session.project_id)}
      className="w-full px-6 py-4 pointer-events-auto hover:bg-blue-600/10 border-b border-blue-900/50 last:border-b-0 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-sm font-mono font-semibold text-blue-200 truncate">{session.name}</h3>
            {showProjectTag && session.projectName && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-purple-500/50 bg-purple-500/10 text-purple-400 text-xs font-mono whitespace-nowrap">
                {session.projectName}
              </span>
            )}
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
