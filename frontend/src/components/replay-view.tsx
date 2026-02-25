'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Play, Pause, RotateCcw, Trash2, Circle, Square } from 'lucide-react'
import { TimelinePlayer } from './timeline-player'
import { RequestInspector } from './request-inspector'
import {
  Event,
  getSession,
  getSessionEvents,
  Session,
  deleteSession,
  getGlobalRecordingStatus,
  RecordingStatus,
  startRecording,
  stopRecording
} from '@/lib/api'
import { ConfirmDialog } from './confirm-dialog'

interface ReplayViewProps {
  projectId: string | null
  sessionId: string | null
  onBack: () => void
  onDeleteSession?: () => void
}

export function ReplayView({ projectId, sessionId, onBack, onDeleteSession }: ReplayViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null)

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

  // Hydrate recording status and new events
  useEffect(() => {
    if (!sessionId || !projectId) return

    async function checkRecordingStateAndRefreshEvents() {
      const status = await getGlobalRecordingStatus()
      if (status) {
        setRecordingStatus(status)
        // If the active recording session exactly matches our session, refresh events
        if (status.recording && status.session_id === sessionId && status.project_id === projectId) {
          try {
            const newEvents = await getSessionEvents(projectId, sessionId)
            setEvents(newEvents)
          } catch (error) {
            console.error('Error hydrating events:', error)
          }
        }
      }
    }

    // Ping every 2 seconds
    const interval = setInterval(checkRecordingStateAndRefreshEvents, 2000)
    return () => clearInterval(interval)
  }, [sessionId, projectId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalDuration = events.reduce((acc, e) => acc + (e.durationMs || 0), 0)
  const currentTime = 0 // TODO: Calculate based on playback position

  const handleStartRecording = async () => {
    if (!projectId || !sessionId) return;

    // Check global recording status
    const status = await getGlobalRecordingStatus();
    if (status && status.recording) {
      if (status.session_id === sessionId) {
        // Already recording this session, should be handled by UI state but just in case
        return;
      } else {
        alert("Session currently running on another session.");
        return;
      }
    }

    const success = await startRecording(projectId, sessionId);
    if (success) {
      setRecordingStatus({ recording: true, project_id: projectId, session_id: sessionId });
    } else {
      alert("Failed to start recording.");
    }
  };

  const handleStopRecording = async () => {
    if (!projectId || !sessionId) return;
    const success = await stopRecording(projectId, sessionId);
    if (success) {
      setRecordingStatus({ recording: false, project_id: "", session_id: "" });
    } else {
      alert("Failed to stop recording.");
    }
  };

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
          <h2 className="text-lg font-mono font-semibold text-blue-200 tracking-wide flex items-center gap-2">
            {loading ? 'Loading...' : session?.name || 'Session'}
            {recordingStatus?.recording && recordingStatus.session_id === sessionId && (
              <span className="flex items-center gap-2 px-2 py-0.5 ml-2 rounded border border-orange-500/50 bg-orange-500/20 text-orange-400 text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Recording
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 ml-2 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors text-red-400/70 hover:text-red-300 cursor-pointer"
              title="Delete Session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="border-b border-blue-900/50 bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {recordingStatus?.recording && recordingStatus.session_id === sessionId ? (
              <button
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-orange-500/20 border border-orange-500/30 rounded transition-colors text-orange-400/80 hover:text-orange-300 cursor-pointer text-sm font-mono"
                title="Stop Recording"
              >
                <Square className="w-4 h-4" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-500/20 border border-blue-500/30 rounded transition-colors text-blue-400/80 hover:text-blue-300 cursor-pointer text-sm font-mono"
                title="Start Recording"
              >
                <Play className="w-4 h-4" />
                Start Recording
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {
        loading ? (
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
                headerControls={
                  <div className="flex items-center gap-2 bg-blue-900/10 px-2 py-1 border border-blue-900/30 rounded-md">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-1 hover:bg-blue-600/20 rounded transition-colors cursor-pointer"
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-blue-300" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-blue-300" />
                        )}
                      </button>
                      <button className="p-1 hover:bg-blue-600/20 rounded transition-colors cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5 text-blue-400/70" />
                      </button>
                      <div className="h-4 w-px bg-blue-900/50 mx-1" />
                      <div className="flex items-center gap-1">
                        <select
                          value={speed}
                          onChange={(e) => setSpeed(Number(e.target.value))}
                          className="bg-transparent text-blue-300 text-[10px] uppercase font-mono focus:outline-none cursor-pointer hover:text-blue-200"
                        >
                          <option value={0.5}>.5x</option>
                          <option value={1}>1x</option>
                          <option value={2}>2x</option>
                          <option value={4}>4x</option>
                        </select>
                      </div>
                    </div>
                    <div className="h-4 w-px bg-blue-900/50" />
                    <div className="text-[10px] font-mono text-blue-400/70 tracking-tighter">
                      <span className="font-medium text-blue-300">{formatTime(currentTime)}</span> / {formatTime(totalDuration / 1000)}
                    </div>
                  </div>
                }
              />
            </div>

            {/* Inspector */}
            <div className="w-96 overflow-hidden flex flex-col bg-black/60 border-l border-blue-900/50 backdrop-blur-sm">
              <RequestInspector requestIndex={selectedRequest} events={events} />
            </div>
          </div>
        )
      }

      {
        showDeleteConfirm && (
          <ConfirmDialog
            title="Delete Session"
            message="Are you sure? This will permanently delete this session and all its events."
            confirmLabel="Delete Session"
            onConfirm={async () => {
              if (!projectId || !sessionId) return
              setDeleting(true)
              const success = await deleteSession(projectId, sessionId)
              setDeleting(false)
              if (success) {
                setShowDeleteConfirm(false)
                onDeleteSession?.()
                onBack()
              } else {
                alert('Failed to delete session')
              }
            }}
            onCancel={() => setShowDeleteConfirm(false)}
            loading={deleting}
          />
        )
      }
    </div >
  )
}
