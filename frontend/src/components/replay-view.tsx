'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Play, Pause, RotateCcw } from 'lucide-react'
import { TimelinePlayer } from './timeline-player'
import { RequestInspector } from './request-inspector'
import { Event, getSession, getSessionEvents, Session } from '@/lib/api'

export function ReplayView({ projectId, sessionId, onBack }: { projectId: string | null; sessionId: string | null; onBack: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId || !projectId) return

    async function loadSessionData() {
      setLoading(true)
      try {
        const [sessionData, eventsData] = await Promise.all([
          getSession(projectId as string, sessionId as string),
          getSessionEvents(projectId as string, sessionId as string),
        ])

        if (sessionData) {
          setSession(sessionData)
        }

        setEvents(eventsData)
      } catch (error) {
        console.error('Error loading session data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSessionData()
  }, [sessionId, projectId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = events.reduce((acc, e) => acc + (e.durationMs || 0), 0)
  const currentTime = 0 // TODO: Calculate based on playback position

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-blue-900/50 bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-mono text-blue-400/70 hover:text-blue-200 transition-colors border border-transparent hover:border-blue-900/50 px-3 py-1 rounded cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Sessions
          </button>
          <h2 className="text-lg font-mono font-semibold text-blue-200 tracking-wide">
            {loading ? 'Loading...' : session?.name || 'Session'}
          </h2>
          <div className="w-32" />
        </div>
      </div>

      {/* Player Controls */}
      <div className="border-b border-blue-900/50 bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-blue-600/10 border border-blue-900/50 rounded transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-blue-300" />
              ) : (
                <Play className="w-5 h-5 text-blue-300" />
              )}
            </button>
            <button className="p-2 hover:bg-blue-600/10 border border-blue-900/50 rounded transition-colors cursor-pointer">
              <RotateCcw className="w-5 h-5 text-blue-400/70" />
            </button>
            <div className="h-6 w-px bg-blue-900/50" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-400/70">Speed:</span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-blue-600/10 border border-blue-900/50 text-blue-200 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/60 cursor-pointer"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </div>
          <div className="text-xs font-mono text-blue-400/70">
            <span className="font-semibold text-blue-200">{formatTime(currentTime)}</span> /{' '}
            <span>{formatTime(totalDuration / 1000)}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-blue-400/70 font-mono">Loading session data...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex gap-px bg-blue-900/50">
          {/* Timeline */}
          <div className="flex-1 overflow-hidden flex flex-col bg-black/60 border-r border-blue-900/50 backdrop-blur-sm">
            <TimelinePlayer
              isPlaying={isPlaying}
              selectedIndex={selectedRequest}
              onSelectRequest={setSelectedRequest}
              events={events}
            />
          </div>

          {/* Inspector */}
          <div className="w-96 overflow-hidden flex flex-col bg-black/60 border-l border-blue-900/50 backdrop-blur-sm">
            <RequestInspector requestIndex={selectedRequest} events={events} />
          </div>
        </div>
      )}
    </div>
  )
}
