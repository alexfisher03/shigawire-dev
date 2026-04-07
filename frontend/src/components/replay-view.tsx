'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Play, Pause, Trash2, Lock, Square, SkipForward } from 'lucide-react'
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
  stopRecording,
  stopCapture,
  startReplay,
  stopReplay,
  pauseReplay,
  resumeReplay,
  stepReplay,
  getReplayWsUrl,
} from '@/lib/api'
import { ConfirmDialog } from './confirm-dialog'

interface ReplayViewProps {
  projectId: string | null
  sessionId: string | null
  onBack: () => void
  onDeleteSession?: () => void
}

export function ReplayView({ projectId, sessionId, onBack, onDeleteSession }: ReplayViewProps) {
  const [speed, setSpeed] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSealConfirm, setShowSealConfirm] = useState(false)
  const [sealing, setSealing] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null)

  // Replay state
  const [replayId, setReplayId] = useState<string | null>(null)
  const [replayStatus, setReplayStatus] = useState<'idle' | 'running' | 'paused' | 'done'>('idle')
  const [currentReplaySeq, setCurrentReplaySeq] = useState<number | null>(null)
  const [wsError, setWsError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

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

  // WebSocket lifecycle — open when a replayId is set, close on cleanup
  useEffect(() => {
    if (!replayId) return

    const ws = new WebSocket(getReplayWsUrl(replayId))
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        const n = Number(msg.current_seq)
        setCurrentReplaySeq(Number.isFinite(n) ? n : null)
        setReplayStatus(msg.status)
        if (msg.status === 'done') ws.close()
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => setWsError('WebSocket error — replay updates unavailable')

    ws.onclose = (e) => {
      if (!e.wasClean) {
        setWsError('Connection lost')
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [replayId])

  const isSealed = session?.sealed === true
  const isRecordingThisSession =
    recordingStatus?.recording &&
    recordingStatus.session_id === sessionId &&
    recordingStatus.project_id === projectId

  const replayActive = replayStatus !== 'idle'

  const handleStartRecording = async () => {
    if (!projectId || !sessionId || isSealed) return;

    // Check global recording status
    const status = await getGlobalRecordingStatus();
    if (status && status.recording) {
      if (status.session_id === sessionId) {
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

  const handleEndCapture = async () => {
    if (!projectId || !sessionId) return
    setSealing(true)
    const success = await stopCapture(projectId, sessionId)
    setSealing(false)
    if (success) {
      setShowSealConfirm(false)
      setRecordingStatus({ recording: false, project_id: '', session_id: '' })
      setSession((prev) => prev ? { ...prev, sealed: true } : prev)
    } else {
      alert('Failed to seal session.')
    }
  }

  const handleReplayPlayPause = async () => {
    if (!projectId || !sessionId) return

    if (replayStatus === 'idle' || replayStatus === 'done') {
      setWsError(null)
      const firstSeq = events.length > 0 ? Number(events[0].seq) : NaN
      setCurrentReplaySeq(Number.isFinite(firstSeq) ? firstSeq : null)
      const result = await startReplay(projectId, sessionId, speed)
      if (!result) {
        setCurrentReplaySeq(null)
        alert('Failed to start replay.')
        return
      }
      setReplayId(result.replay_id)
      setReplayStatus('running')
      return
    }

    if (replayStatus === 'running') {
      await pauseReplay(projectId, sessionId, replayId!)
      // Status will be updated via WS
      return
    }

    if (replayStatus === 'paused') {
      await resumeReplay(projectId, sessionId, replayId!)
      // Status will be updated via WS
    }
  }

  const handleReplayStop = async () => {
    if (!projectId || !sessionId || !replayId) return
    wsRef.current?.close()
    await stopReplay(projectId, sessionId, replayId)
    setReplayId(null)
    setReplayStatus('idle')
    setCurrentReplaySeq(null)
    setWsError(null)
  }

  const handleReplayStep = async () => {
    if (!projectId || !sessionId || !replayId) return
    await stepReplay(projectId, sessionId, replayId)
  }

  const replayPlayPauseIcon = () => {
    if (replayStatus === 'running') return <Pause className="w-3.5 h-3.5 text-blue-300" />
    return <Play className="w-3.5 h-3.5 text-blue-300" />
  }

  const replayStatusLabel = () => {
    if (replayStatus === 'running') return `Replay running at ${speed}x`
    if (replayStatus === 'paused') return `Paused on request #${currentReplaySeq ?? '—'}`
    if (replayStatus === 'done') return 'Replay complete'
    return null
  }

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
          <h2 className="text-lg font-mono font-semibold text-blue-200 tracking-wide flex items-center gap-2 flex-wrap">
            {loading ? 'Loading...' : session?.name || 'Session'}
            {isSealed && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-500/50 bg-slate-500/15 text-slate-300 text-xs font-mono">
                <Lock className="w-3 h-3" />
                Sealed
              </span>
            )}
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

      {/* Recording / Replay Controls */}
      <div className="border-b border-blue-900/50 bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Recording */}
          <div className="flex items-center gap-2">
            {isRecordingThisSession ? (
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
                type="button"
                disabled={isSealed}
                onClick={handleStartRecording}
                className={
                  isSealed
                    ? 'flex items-center gap-2 px-3 py-1.5 rounded border border-blue-500/15 text-blue-400/35 cursor-not-allowed text-sm font-mono'
                    : 'flex items-center gap-2 px-3 py-1.5 hover:bg-blue-500/20 border border-blue-500/30 rounded transition-colors text-blue-400/80 hover:text-blue-300 cursor-pointer text-sm font-mono'
                }
                title={isSealed ? 'Session is sealed; recording is disabled' : 'Start Recording'}
              >
                <Play className="w-4 h-4" />
                Start Recording
              </button>
            )}
            {!isSealed && (
              <button
                onClick={() => setShowSealConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors text-red-400/80 hover:text-red-300 cursor-pointer text-sm font-mono"
                title="Permanently seal this session — no further recording allowed"
              >
                <Lock className="w-4 h-4" />
                End Capture
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-blue-900/50 shrink-0" />

          {/* Replay controls */}
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1">
              <button
                onClick={handleReplayPlayPause}
                className="p-1 hover:bg-blue-600/20 rounded transition-colors cursor-pointer"
                title={replayStatus === 'running' ? 'Pause' : 'Play'}
              >
                {replayPlayPauseIcon()}
              </button>

              {replayStatus === 'paused' && (
                <button
                  onClick={handleReplayStep}
                  className="p-1 hover:bg-blue-600/20 rounded transition-colors cursor-pointer"
                  title="Step one event"
                >
                  <SkipForward className="w-3.5 h-3.5 text-blue-400/70" />
                </button>
              )}

              <button
                onClick={handleReplayStop}
                disabled={!replayActive}
                className="p-1 hover:bg-blue-600/20 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Stop replay"
              >
                <Square className="w-3.5 h-3.5 text-blue-400/70" />
              </button>

              <div className="h-4 w-px bg-blue-900/50 mx-1" />

              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                disabled={replayActive}
                className="bg-transparent text-blue-300 text-[10px] uppercase font-mono focus:outline-none cursor-pointer hover:text-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value={0.5}>.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            {/* Status text */}
            {wsError ? (
              <span className="text-xs font-mono text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {wsError}
              </span>
            ) : replayStatusLabel() ? (
              <span className={`text-xs font-mono flex items-center gap-2 ${replayStatus === 'done' ? 'text-green-400' : 'text-blue-300'}`}>
                {replayStatus === 'running' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />}
                {replayStatusLabel()}
              </span>
            ) : null}
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
                selectedIndex={selectedRequest}
                onSelectRequest={setSelectedRequest}
                events={events}
                currentReplaySeq={currentReplaySeq ?? undefined}
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

      {
        showSealConfirm && (
          <ConfirmDialog
            title="End Capture"
            message="Are you sure? This will permanently seal this session. No further recording or event capture will be allowed."
            confirmLabel="Seal Session"
            onConfirm={handleEndCapture}
            onCancel={() => setShowSealConfirm(false)}
            loading={sealing}
          />
        )
      }
    </div >
  )
}
