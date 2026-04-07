'use client'

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Event } from '@/lib/api'

const getMethodColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/40'
    case 'POST':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    case 'PUT':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40'
    case 'DELETE':
      return 'bg-red-500/15 text-red-300 border-red-500/40'
    case 'PATCH':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/40'
    default:
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40'
  }
}

const getStatusColor = (status?: number) => {
  if (!status) return 'text-zinc-400'
  if (status >= 200 && status < 300) return 'text-emerald-400'
  if (status >= 300 && status < 400) return 'text-sky-400'
  if (status >= 400 && status < 500) return 'text-amber-400'
  return 'text-red-400'
}

type EventMeta = Event & {
  relativeTimestamp: number
  computedDuration: number
}

function buildEventMeta(events: Event[]): EventMeta[] {
  if (events.length === 0) return []
  const firstStart = events[0]?.started_at ? new Date(events[0].started_at).getTime() : 0
  return events.map((event) => {
    const startMs = event.started_at ? new Date(event.started_at).getTime() : 0
    const computedDuration =
      event.started_at && event.ended_at
        ? new Date(event.ended_at).getTime() - new Date(event.started_at).getTime()
        : event.durationMs ?? 0
    return {
      ...event,
      durationMs: computedDuration,
      computedDuration,
      relativeTimestamp: startMs - firstStart,
    }
  })
}

function formatOffsetMs(ms: number) {
  if (ms >= 1000) return `+${(ms / 1000).toFixed(1)}s`
  return `+${ms}ms`
}

type ViewMode = 'list' | 'track'

export function TimelinePlayer({
  selectedIndex,
  onSelectRequest,
  events = [],
  currentReplaySeq,
}: {
  selectedIndex: number
  onSelectRequest: (index: number) => void
  events?: Event[]
  currentReplaySeq?: number
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('track')
  const rowRefs = useRef<Record<number, HTMLButtonElement | null>>({})

  const meta = useMemo(() => buildEventMeta(events), [events])

  const totalSpan = useMemo(() => {
    if (meta.length === 0) return 0
    return Math.max(...meta.map((e) => e.relativeTimestamp + (e.computedDuration || 0)), 1)
  }, [meta])

  useEffect(() => {
    if (currentReplaySeq == null) return
    const el = rowRefs.current[currentReplaySeq]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentReplaySeq])

  if (events.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono font-semibold text-blue-200 tracking-wide">Request timeline</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-blue-400/70 font-mono text-sm py-8">No events recorded for this session</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap shrink-0">
        <h3 className="text-sm font-mono font-semibold text-blue-200 tracking-wide">Request timeline</h3>
        <div
          className="inline-flex rounded-md border border-zinc-700/60 bg-zinc-950/60 p-0.5 shadow-sm"
          role="group"
          aria-label="Timeline layout"
        >
          <button
            type="button"
            onClick={() => setViewMode('track')}
            className={`px-3 py-1 rounded font-mono text-[11px] uppercase tracking-wide transition-colors cursor-pointer ${
              viewMode === 'track'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600/40'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            Track
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded font-mono text-[11px] uppercase tracking-wide transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600/40'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <TimelineListView
          meta={meta}
          totalSpan={totalSpan}
          selectedIndex={selectedIndex}
          onSelectRequest={onSelectRequest}
          currentReplaySeq={currentReplaySeq ?? null}
          rowRefs={rowRefs}
        />
      ) : (
        <TimelineTrackView
          meta={meta}
          totalSpan={totalSpan}
          selectedIndex={selectedIndex}
          onSelectRequest={onSelectRequest}
          currentReplaySeq={currentReplaySeq ?? null}
          rowRefs={rowRefs}
        />
      )}

      <div className="mt-6 p-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 text-xs text-zinc-400 font-mono">
        <div className="font-semibold text-zinc-200 mb-2 tracking-wide">Timeline stats</div>
        <div className="space-y-1">
          <div>Total requests: {events.length}</div>
          <div>Total span: {totalSpan}ms</div>
          {events.length > 0 && (
            <div>
              Average response:{' '}
              {Math.round(meta.reduce((acc, e) => acc + (e.computedDuration || 0), 0) / events.length)}ms
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineListView({
  meta,
  totalSpan,
  selectedIndex,
  onSelectRequest,
  currentReplaySeq,
  rowRefs,
}: {
  meta: EventMeta[]
  totalSpan: number
  selectedIndex: number
  onSelectRequest: (index: number) => void
  currentReplaySeq: number | null
  rowRefs: MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  const safeSpan = totalSpan > 0 ? totalSpan : 1

  return (
    <div className="space-y-2">
      {meta.map((event, index) => {
        const isSelected = selectedIndex === index
        const isReplayActive =
          currentReplaySeq != null && Number(event.seq) === currentReplaySeq
        const startPct = (event.relativeTimestamp / safeSpan) * 100
        const widthPct = Math.max((event.computedDuration / safeSpan) * 100, 0.35)

        return (
          <button
            key={event.id}
            ref={(el) => {
              rowRefs.current[event.seq] = el
            }}
            type="button"
            onClick={() => onSelectRequest(index)}
            className={[
              'w-full p-3 rounded-lg border text-left cursor-pointer transition-all duration-200',
              isReplayActive
                ? 'border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_24px_-4px_rgba(52,211,153,0.45)] z-1 ring-1 ring-emerald-400/25'
                : isSelected
                  ? 'border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-400/20'
                  : 'border-zinc-800/90 bg-zinc-950/40 hover:border-zinc-600/70 hover:bg-zinc-900/35',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${getMethodColor(
                    event.method || '',
                  )}`}
                >
                  {event.method}
                </span>
                <code className="text-xs text-zinc-300/90 truncate font-mono">{event.url}</code>
              </div>
              {event.status ? (
                <span className={`text-xs font-mono whitespace-nowrap shrink-0 ${getStatusColor(event.status)}`}>
                  {event.status}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>{formatOffsetMs(event.relativeTimestamp)}</span>
                {event.computedDuration ? <span>{event.computedDuration}ms</span> : null}
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800/90 overflow-hidden relative">
                <div
                  className="absolute top-0 h-full rounded-full bg-linear-to-r from-sky-600/70 to-emerald-500/60"
                  style={{
                    left: `${Math.min(startPct, 100)}%`,
                    width: `${Math.min(widthPct, 100 - Math.min(startPct, 99.65))}%`,
                  }}
                />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function TimelineTrackView({
  meta,
  totalSpan,
  selectedIndex,
  onSelectRequest,
  currentReplaySeq,
  rowRefs,
}: {
  meta: EventMeta[]
  totalSpan: number
  selectedIndex: number
  onSelectRequest: (index: number) => void
  currentReplaySeq: number | null
  rowRefs: MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  const safeSpan = totalSpan > 0 ? totalSpan : 1

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 pt-5 pb-3">
      <div className="relative h-[108px] w-full mb-3">
        <div
          className="absolute left-0 right-0 top-[46%] h-px bg-linear-to-r from-transparent via-zinc-600/70 to-transparent"
          aria-hidden
        />
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            className="absolute top-[30%] bottom-[28%] w-px bg-zinc-700/35"
            style={{ left: `${t * 100}%`, transform: 'translateX(-50%)' }}
            aria-hidden
          />
        ))}
        {meta.map((event, index) => {
          const leftPct = (event.relativeTimestamp / safeSpan) * 100
          const isSelected = selectedIndex === index
          const isReplayActive =
            currentReplaySeq != null && Number(event.seq) === currentReplaySeq

          return (
            <button
              key={event.id}
              type="button"
              title={`${event.method} ${event.url}`}
              onClick={() => onSelectRequest(index)}
              className="absolute top-1/2 z-10 flex flex-col items-center outline-none"
              style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
            >
              <span
                className={[
                  'mb-1 block rounded-full transition-all duration-200 border-2',
                  isReplayActive
                    ? 'h-4 w-4 border-emerald-300 bg-emerald-400 shadow-[0_0_18px_2px_rgba(52,211,153,0.55)] scale-110'
                    : isSelected
                      ? 'h-3 w-3 border-sky-400 bg-sky-500/90 shadow-[0_0_10px_rgba(56,189,248,0.35)]'
                      : 'h-2.5 w-2.5 border-zinc-500 bg-zinc-800 hover:border-zinc-400 hover:bg-zinc-700',
                ].join(' ')}
              />
              <span
                className={[
                  'hidden sm:block w-px h-5 shrink-0',
                  isReplayActive ? 'bg-emerald-500/50' : 'bg-zinc-600/50',
                ].join(' ')}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
      <div className="grid gap-2 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {meta.map((event, index) => {
          const isSelected = selectedIndex === index
          const isReplayActive =
            currentReplaySeq != null && Number(event.seq) === currentReplaySeq
          return (
            <button
              key={`label-${event.id}`}
              ref={(el) => {
                rowRefs.current[event.seq] = el
              }}
              type="button"
              onClick={() => onSelectRequest(index)}
              className={[
                'rounded-lg border px-2.5 py-2 text-left transition-all duration-200 cursor-pointer',
                isReplayActive
                  ? 'border-emerald-500/55 bg-emerald-500/10 shadow-[0_0_16px_-4px_rgba(52,211,153,0.4)] ring-1 ring-emerald-400/20'
                  : isSelected
                    ? 'border-sky-500/45 bg-sky-500/10 ring-1 ring-sky-400/15'
                    : 'border-zinc-800/90 bg-zinc-950/50 hover:border-zinc-600/80',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border shrink-0 ${getMethodColor(
                    event.method || '',
                  )}`}
                >
                  {event.method}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 truncate">{formatOffsetMs(event.relativeTimestamp)}</span>
              </div>
              <div className="text-[11px] font-mono text-zinc-200/90 truncate mt-1">{event.url}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
