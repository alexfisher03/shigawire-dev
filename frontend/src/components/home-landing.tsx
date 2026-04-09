"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Circle, FolderKanban, ListTree, Lock, Plus, Square } from "lucide-react";
import {
  getSession,
  getSessionEvents,
  listAllSessions,
  startRecording,
  stopRecording,
  type Event,
  type Project,
  type Session,
} from "@/lib/api";
import { useRecordingStatusStream } from "@/hooks/use-recording-status-stream";
import { useEventStream } from "@/hooks/use-event-stream";
import {
  CaptureDensityVisual,
  LastSessionVisual,
} from "@/components/home-dashboard-panels";

interface HomeLandingProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenBacklog: () => void;
  onNewProject: () => void;
}

export function HomeLanding({
  projects,
  onSelectProject,
  onOpenBacklog,
  onNewProject,
}: HomeLandingProps) {
  const { status: recordingStatus, refresh: refreshRecording } =
    useRecordingStatusStream();
  const [visualsReady, setVisualsReady] = useState(false);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [lastSessionEvents, setLastSessionEvents] = useState<Event[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const statusReady = recordingStatus !== null;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisualsReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const recording = Boolean(recordingStatus?.recording);
  const liveProjectId = recordingStatus?.project_id ?? null;
  const liveSessionId = recordingStatus?.session_id ?? null;
  const liveProjectName =
    projects.find((p) => p.id === liveProjectId)?.name ?? null;

  const lastRecordedRef = useRef<{ projectId: string; sessionId: string } | null>(null);
  useEffect(() => {
    if (recording && liveProjectId && liveSessionId) {
      lastRecordedRef.current = { projectId: liveProjectId, sessionId: liveSessionId };
    }
  }, [recording, liveProjectId, liveSessionId]);

  const loadSessions = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (!statusReady) return;
    let cancelled = false;

    const preferredProjectId = liveProjectId || lastRecordedRef.current?.projectId || null;
    const preferredSessionId = liveSessionId || lastRecordedRef.current?.sessionId || null;

    async function load() {
      let target: Session | null = null;

      if (preferredProjectId && preferredSessionId) {
        const s = await getSession(preferredProjectId, preferredSessionId);
        if (!cancelled && s) {
          const proj = projects.find((p) => p.id === preferredProjectId);
          target = { ...s, projectName: proj?.name ?? "Project" };
        }
      }

      if (!target && !cancelled) {
        const all = await listAllSessions();
        if (!cancelled) target = all[0] ?? null;
      }

      if (cancelled) return;
      setLastSession(target);
      setSessionsLoading(false);
      if (target) {
        const evts = await getSessionEvents(target.project_id, target.id);
        if (!cancelled) setLastSessionEvents(evts);
      } else {
        setLastSessionEvents([]);
      }
    }
    loadSessions.current = load;
    void load();
    return () => { cancelled = true; };
  }, [statusReady, recording, liveProjectId, liveSessionId, projects]);

  const { events: liveStreamEvents, totalCount: liveTotalCount } =
    useEventStream(recording ? liveSessionId : null);

  const prevStreamLen = useRef(0);
  useEffect(() => { prevStreamLen.current = 0; }, [liveSessionId]);
  useEffect(() => {
    if (liveStreamEvents.length > prevStreamLen.current) {
      prevStreamLen.current = liveStreamEvents.length;
      if (lastSession && liveSessionId === lastSession.id) {
        getSessionEvents(lastSession.project_id, lastSession.id).then(
          (evts) => setLastSessionEvents(evts),
        );
      }
    }
  }, [liveStreamEvents.length, lastSession, liveSessionId]);

  useEffect(() => {
    if (!recording) return;
    let raf: number;
    const tick = () => {
      setNowMs(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording]);

  const handleStopRecording = async () => {
    if (!liveProjectId || !liveSessionId || stopping) return;
    setStopping(true);
    try {
      await stopRecording(liveProjectId, liveSessionId);
    } finally {
      await refreshRecording();
      if (loadSessions.current) void loadSessions.current();
      setStopping(false);
    }
  };

  const handleStartRecordingLastSession = async () => {
    if (!lastSession || lastSession.sealed || starting || recording) return;
    setStarting(true);
    try {
      await startRecording(lastSession.project_id, lastSession.id);
    } finally {
      await refreshRecording();
      if (loadSessions.current) void loadSessions.current();
      setStarting(false);
    }
  };

  const lastSessionSealed = Boolean(lastSession?.sealed);
  const isRecordingThisSession =
    recording && lastSession != null && liveSessionId === lastSession.id;

  const lastRelative =
    lastSession?.created_at &&
    formatDistanceToNow(new Date(lastSession.created_at), { addSuffix: true });

  return (
    <div className="flex-1 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8 sm:py-10 space-y-8">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider">
              Quick actions
            </h3>
            {recording && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onNewProject}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-600/55 bg-blue-600/12 text-blue-100 font-mono text-xs hover:bg-blue-600/22 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
            <button
              type="button"
              onClick={onOpenBacklog}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700/65 bg-zinc-900/50 text-zinc-300 font-mono text-xs hover:border-zinc-600 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <ListTree className="w-4 h-4" />
              Session backlog
            </button>
            {recording && liveProjectName && (
              <button
                type="button"
                disabled={stopping}
                onClick={handleStopRecording}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/50 bg-red-950/30 text-red-300 font-mono text-xs hover:bg-red-900/30 hover:border-red-500/60 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <Square className="w-3.5 h-3.5" />
                {stopping
                  ? "Stopping…"
                  : `Stop recording · ${liveProjectName}`}
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">
            Session activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-5 flex flex-col">
              <div className="mb-3">
                <LastSessionVisual
                  active={visualsReady}
                  events={lastSessionEvents}
                />
              </div>
              <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                Last active session
              </h4>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 font-mono">
                {sessionsLoading
                  ? "Loading…"
                  : lastSession
                    ? `${lastSession.name} · ${lastSession.projectName ?? "Project"} · ${lastRelative}`
                    : "No sessions yet — start recording from a project."}
              </p>
              {lastSessionEvents.length > 0 && (
                <p className="mt-1 text-[10px] text-zinc-600 font-mono tabular-nums">
                  {lastSessionEvents.length} request
                  {lastSessionEvents.length === 1 ? "" : "s"} captured
                </p>
              )}
              {lastSession && !sessionsLoading && (
                <div className="mt-3 pt-3 border-t border-zinc-800/60">
                  {lastSessionSealed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-700/40 bg-zinc-900/50 text-[11px] font-mono text-zinc-500">
                      <Lock className="w-3 h-3" />
                      Session sealed
                    </span>
                  ) : isRecordingThisSession ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-700/30 bg-emerald-950/30 text-[11px] font-mono text-emerald-400/70">
                      <Circle className="w-3 h-3 fill-emerald-500/50" />
                      Recording in progress
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={starting || recording}
                      onClick={handleStartRecordingLastSession}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-600/50 bg-emerald-950/25 text-[11px] font-mono text-emerald-300 hover:bg-emerald-900/30 hover:border-emerald-500/60 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Circle className="w-3 h-3 fill-emerald-500/60" />
                      {starting ? "Starting…" : "Record this session"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/35 p-5 flex flex-col">
              <div className="mb-3">
                <CaptureDensityVisual
                  active={visualsReady}
                  recording={recording}
                  events={liveStreamEvents}
                  nowMs={nowMs}
                />
              </div>
              <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                Capture density
              </h4>
              {recording ? (
                <p className="mt-1.5 text-[11px] leading-snug font-mono">
                  <span className="text-emerald-400/90">Recording</span>
                  {liveProjectName ? (
                    <span className="text-zinc-500"> · {liveProjectName}</span>
                  ) : null}
                  <span className="block text-zinc-600 mt-0.5 tabular-nums">
                    {liveTotalCount} event
                    {liveTotalCount === 1 ? "" : "s"} captured
                  </span>
                </p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex h-6 items-center rounded-full border border-zinc-700/50 bg-zinc-900/60 px-2.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Idle
                  </span>
                  <span className="text-[11px] font-mono text-zinc-600">
                    No active capture
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-mono font-semibold text-blue-400/70 uppercase tracking-wider">
            Your projects
          </h3>
          {projects.length === 0 ? (
            <p className="text-sm font-mono text-blue-500/60 py-4 border border-dashed border-blue-900/50 rounded-lg px-4">
              No projects yet. Create one to start recording traffic for a
              target service.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectProject(p.id)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-blue-900/50 bg-blue-950/20 hover:border-blue-600/40 hover:bg-blue-900/15 transition-colors cursor-pointer flex items-center gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-blue-800/50 bg-blue-900/30">
                      <FolderKanban className="w-4 h-4 text-blue-300/90" />
                    </span>
                    <span className="font-mono text-sm text-blue-200 truncate">
                      {p.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
