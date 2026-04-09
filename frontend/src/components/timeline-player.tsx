'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
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

function formatAxisMs(ms: number, totalSpan: number) {
  if (totalSpan >= 60_000) {
    const s = Math.round(ms / 1000)
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0 ? `${m}m ${r}s` : `${r}s`
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

const TIMELINE_PAD_MS = 30_000
const CLUSTER_GAP_MS = 5 * 60 * 1000
/** Upper bound on a single request-timeline window (track + list). Longer spans are split into multiple windows. */
const TIMELINE_MAX_WINDOW_MS = 3 * 60 * 1000

type TimelineSegment = {
  startMs: number
  endMs: number
  windowMs: number
  metaIndices: number[]
}

function buildTimelineSegments(meta: EventMeta[]): TimelineSegment[] {
  if (meta.length === 0) return []

  const order = meta
    .map((e, metaIdx) => ({ e, metaIdx }))
    .sort((a, b) => a.e.relativeTimestamp - b.e.relativeTimestamp)

  const clusters: number[][] = []
  let cur: number[] = []

  for (const { e, metaIdx } of order) {
    if (cur.length === 0) {
      cur.push(metaIdx)
      continue
    }
    const prevIdx = cur[cur.length - 1]
    const prevStart = meta[prevIdx].relativeTimestamp
    if (e.relativeTimestamp - prevStart > CLUSTER_GAP_MS) {
      clusters.push(cur)
      cur = [metaIdx]
    } else {
      cur.push(metaIdx)
    }
  }
  if (cur.length) clusters.push(cur)

  let prevEnd = 0
  const segments: TimelineSegment[] = []

  for (let ci = 0; ci < clusters.length; ci++) {
    const idxs = clusters[ci]
    const evs = idxs.map((i) => meta[i])
    const rawMin = Math.min(...evs.map((e) => e.relativeTimestamp))
    const rawMax = Math.max(
      ...evs.map((e) => e.relativeTimestamp + (e.computedDuration || 0)),
    )

    let startMs: number
    let endMs: number
    if (ci === 0) {
      startMs = 0
      endMs = rawMax + TIMELINE_PAD_MS
    } else {
      startMs = Math.max(rawMin - TIMELINE_PAD_MS, prevEnd)
      endMs = rawMax + TIMELINE_PAD_MS
    }
    prevEnd = endMs

    const sortedIndices = [...idxs].sort(
      (a, b) => meta[a].relativeTimestamp - meta[b].relativeTimestamp,
    )

    let chunkStart = startMs
    while (chunkStart < endMs) {
      const chunkEnd = Math.min(chunkStart + TIMELINE_MAX_WINDOW_MS, endMs)
      const metaIndices = sortedIndices.filter((idx) => {
        const t = meta[idx].relativeTimestamp
        return t >= chunkStart && t < chunkEnd
      })
      if (metaIndices.length > 0) {
        segments.push({
          startMs: chunkStart,
          endMs: chunkEnd,
          windowMs: Math.max(chunkEnd - chunkStart, 1),
          metaIndices,
        })
      }
      chunkStart = chunkEnd
    }
  }

  return segments
}

const DENSITY_VB_W = 1000
const DENSITY_VB_H = 44
const DENSITY_BIN_COUNT = 96

function findSegmentIndexForTime(segments: TimelineSegment[], ms: number): number {
  if (segments.length === 0) return 0
  const clamped = Math.max(0, ms)
  let best = 0
  let bestScore = Infinity
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    let score: number
    if (clamped >= s.startMs && clamped < s.endMs) {
      score = 0
    } else if (clamped < s.startMs) {
      score = s.startMs - clamped
    } else {
      score = clamped - s.endMs + 0.001
    }
    if (score < bestScore || (score === bestScore && i < best)) {
      bestScore = score
      best = i
    }
  }
  return best
}

function buildDensityLinePath(
  meta: EventMeta[],
  totalSpanMs: number,
  binCount: number,
): string {
  if (binCount < 2 || totalSpanMs <= 0) {
    return `M 0 ${DENSITY_VB_H - 4} L ${DENSITY_VB_W} ${DENSITY_VB_H - 4}`
  }
  const raw = new Array(binCount).fill(0)
  for (const e of meta) {
    const i = Math.min(
      binCount - 1,
      Math.floor((e.relativeTimestamp / totalSpanMs) * binCount),
    )
    raw[i]++
  }
  const smooth = raw.map((_, i) => {
    let s = 0
    let c = 0
    for (let d = -1; d <= 1; d++) {
      const j = i + d
      if (j >= 0 && j < binCount) {
        s += raw[j]
        c++
      }
    }
    return s / c
  })
  const maxV = Math.max(...smooth, 1e-6)
  const padY = 5
  const bottom = DENSITY_VB_H - padY
  const top = padY
  const parts: string[] = []
  for (let i = 0; i < binCount; i++) {
    const x = (i / (binCount - 1)) * DENSITY_VB_W
    const y = bottom - (smooth[i]! / maxV) * (bottom - top)
    parts.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return parts.join('')
}

function SessionDensityStrip({
  eventsForDensity,
  totalSpan,
  windowStart,
  windowEnd,
  onPickTime,
  densityIsFiltered,
}: {
  eventsForDensity: EventMeta[]
  totalSpan: number
  windowStart: number
  windowEnd: number
  onPickTime: (sessionMs: number) => void
  densityIsFiltered: boolean
}) {
  const pathD = useMemo(
    () => buildDensityLinePath(eventsForDensity, totalSpan, DENSITY_BIN_COUNT),
    [eventsForDensity, totalSpan],
  )

  const safeSpan = totalSpan > 0 ? totalSpan : 1
  const hiX = (windowStart / safeSpan) * DENSITY_VB_W
  const hiW = Math.max(
    0.5,
    ((windowEnd - windowStart) / safeSpan) * DENSITY_VB_W,
  )

  const selectionPatternId = useId().replace(/:/g, '')

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width <= 0) return
    const frac = (e.clientX - r.left) / r.width
    const ms = Math.min(Math.max(0, frac * totalSpan), Math.max(totalSpan, 0))
    onPickTime(ms)
  }

  return (
    <div className="mb-3 px-3.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
          Density
        </span>
        <span className="text-[9px] font-mono text-zinc-600">
          {densityIsFiltered ? 'Matching requests · click to jump' : 'Full session · click to jump'}
        </span>
      </div>
      <svg
        role="img"
        aria-label={
          densityIsFiltered
            ? 'Density of matching requests across the session. Click to select time window.'
            : 'Request density across the full session timeline. Click to select time window and request.'
        }
        viewBox={`0 0 ${DENSITY_VB_W} ${DENSITY_VB_H}`}
        preserveAspectRatio="none"
        className="w-full h-10 rounded-md border border-zinc-800/60 bg-zinc-950/50 cursor-crosshair"
        onClick={handleClick}
      >
        <title>
          {densityIsFiltered ? 'Request density — matching requests' : 'Request density — full session'}
        </title>
        <defs>
          <pattern
            id={selectionPatternId}
            width={9}
            height={9}
            patternUnits="userSpaceOnUse"
          >
            <rect width={9} height={9} fill="rgba(255,255,255,0.045)" />
            <path
              d="M0 9 L9 0"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.85}
            />
          </pattern>
        </defs>
        <rect
          x={hiX}
          y={0}
          width={hiW}
          height={DENSITY_VB_H}
          fill={`url(#${selectionPatternId})`}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <path
          d={pathD}
          fill="none"
          stroke="rgba(56, 189, 248, 0.65)"
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
      </svg>
    </div>
  )
}

function formatClockFromSessionStart(ms: number) {
  const totalS = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatSegmentLabel(startMs: number, endMs: number) {
  return `${formatClockFromSessionStart(startMs)} – ${formatClockFromSessionStart(endMs)}`
}

const METHOD_FILTER_ALL = 'all'

function collectMethodOptions(meta: EventMeta[]): string[] {
  const s = new Set<string>()
  for (const e of meta) {
    const m = e.method?.trim().toUpperCase()
    if (m) s.add(m)
  }
  return Array.from(s).sort()
}

function eventMatchesSearch(event: EventMeta, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const url = (event.url ?? '').toLowerCase()
  const method = (event.method ?? '').toLowerCase()
  return url.includes(q) || method.includes(q)
}

function eventMatchesMethodFilter(event: EventMeta, filter: string): boolean {
  if (filter === METHOD_FILTER_ALL) return true
  const m = (event.method ?? '').trim().toUpperCase()
  return m === filter.toUpperCase()
}

function filterMetaIndices(
  meta: EventMeta[],
  searchQuery: string,
  methodFilter: string,
): number[] {
  const out: number[] = []
  for (let i = 0; i < meta.length; i++) {
    const e = meta[i]!
    if (!eventMatchesMethodFilter(e, methodFilter)) continue
    if (!eventMatchesSearch(e, searchQuery)) continue
    out.push(i)
  }
  return out
}

function SessionRequestsCompactTable({
  rows,
  selectedIndex,
  onSelectRequest,
  currentReplaySeq,
  rowRefs,
  idPrefix,
}: {
  rows: { event: EventMeta; idx: number }[]
  selectedIndex: number
  onSelectRequest: (index: number) => void
  currentReplaySeq: number | null
  rowRefs: MutableRefObject<Record<number, HTMLElement | null>>
  idPrefix: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 overflow-hidden">
      <div
        className="grid grid-cols-[minmax(0,3.25rem)_minmax(0,1fr)_3.75rem_3rem_2.25rem] gap-x-2 px-2 py-1 bg-zinc-900/45 border-b border-zinc-800/80 text-[9px] font-mono text-zinc-500 uppercase tracking-wide"
        aria-hidden
      >
        <span>Method</span>
        <span className="min-w-0">URL</span>
        <span className="text-right">Offset</span>
        <span className="text-right">Dur</span>
        <span className="text-right">HTTP</span>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {rows.map(({ event, idx }) => {
          const isSelected = selectedIndex === idx
          const isReplayActive =
            currentReplaySeq != null && Number(event.seq) === currentReplaySeq
          return (
            <button
              key={`${idPrefix}-${event.id}`}
              ref={(el) => {
                rowRefs.current[event.seq] = el
              }}
              type="button"
              onClick={() => onSelectRequest(idx)}
              className={[
                'grid w-full grid-cols-[minmax(0,3.25rem)_minmax(0,1fr)_3.75rem_3rem_2.25rem] gap-x-2 px-2 py-1 text-left font-mono text-[10px] leading-snug transition-colors cursor-pointer',
                isReplayActive
                  ? 'bg-emerald-500/10 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]'
                  : isSelected
                    ? 'bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.25)]'
                    : 'hover:bg-zinc-900/55',
              ].join(' ')}
            >
              <span
                className={`inline-flex w-fit items-center text-[9px] font-bold px-1 py-0 rounded border shrink-0 ${getMethodColor(
                  event.method || '',
                )}`}
              >
                {event.method}
              </span>
              <span className="min-w-0 text-zinc-300/90 truncate" title={event.url}>
                {event.url}
              </span>
              <span className="text-right text-zinc-500 tabular-nums">
                {formatOffsetMs(event.relativeTimestamp)}
              </span>
              <span className="text-right text-zinc-500 tabular-nums">
                {event.computedDuration ? `${event.computedDuration}ms` : '—'}
              </span>
              <span
                className={`text-right tabular-nums ${event.status ? getStatusColor(event.status) : 'text-zinc-600'}`}
              >
                {event.status ?? '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const TRACK_DOT_CLASS =
  'mb-1 block rounded-full transition-all duration-200 border-2 shrink-0'

const TIMELINE_ZOOM_MIN = 1
const TIMELINE_ZOOM_MAX = 8

/** List — window mode: max cards per page (responsive grid). */
const LIST_GRID_PAGE_SIZE = 12
/** List — all-session table rows per page. */
const LIST_ALL_TABLE_PAGE_SIZE = 24
/** Track layout — grid cards per page. */
const TRACK_GRID_PAGE_SIZE = 12
/** Track layout — compact table rows per page. */
const TRACK_TABLE_PAGE_SIZE = 24

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
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>(METHOD_FILTER_ALL)
  const [methodMenuOpen, setMethodMenuOpen] = useState(false)
  const methodPickerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<number, HTMLElement | null>>({})

  const meta = useMemo(() => buildEventMeta(events), [events])

  const methodFilterOptions = useMemo(() => collectMethodOptions(meta), [meta])

  const allowedMetaIndices = useMemo(
    () => filterMetaIndices(meta, searchQuery, methodFilter),
    [meta, searchQuery, methodFilter],
  )

  const densityMeta = useMemo(
    () => allowedMetaIndices.map((i) => meta[i]!),
    [meta, allowedMetaIndices],
  )

  const densityIsFiltered =
    searchQuery.trim() !== '' || methodFilter !== METHOD_FILTER_ALL

  useEffect(() => {
    if (
      methodFilter !== METHOD_FILTER_ALL &&
      !methodFilterOptions.includes(methodFilter)
    ) {
      setMethodFilter(METHOD_FILTER_ALL)
    }
  }, [methodFilter, methodFilterOptions])

  const totalSpan = useMemo(() => {
    if (meta.length === 0) return 0
    return Math.max(...meta.map((e) => e.relativeTimestamp + (e.computedDuration || 0)), 1)
  }, [meta])

  const segments = useMemo(() => buildTimelineSegments(meta), [meta])

  const maxSegmentIdx = Math.max(0, segments.length - 1)

  useEffect(() => {
    setSegmentIndex((i) => Math.min(i, maxSegmentIdx))
  }, [maxSegmentIdx])

  useEffect(() => {
    if (currentReplaySeq == null) return
    const hitIdx = meta.findIndex((e) => Number(e.seq) === currentReplaySeq)
    if (hitIdx < 0) return
    const idx = segments.findIndex((s) => s.metaIndices.includes(hitIdx))
    if (idx >= 0) setSegmentIndex(idx)
  }, [currentReplaySeq, meta, segments])

  useEffect(() => {
    if (currentReplaySeq == null) return
    const el = rowRefs.current[currentReplaySeq]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentReplaySeq])

  useEffect(() => {
    if (!methodMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (methodPickerRef.current?.contains(e.target as Node)) return
      setMethodMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMethodMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [methodMenuOpen])

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
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
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

      <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0 sm:items-end">
        <div className="relative flex-1 min-w-0">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search path or method…"
            aria-label="Search requests by URL path or HTTP method"
            className="w-full rounded-md border border-zinc-700/35 bg-zinc-950/80 py-1.5 pl-8 pr-2.5 font-mono text-xs text-zinc-200 shadow-sm ring-1 ring-black/20 placeholder:text-zinc-600 outline-none focus:border-zinc-600/50 focus:ring-1 focus:ring-sky-500/30"
          />
        </div>
        <div ref={methodPickerRef} className="relative w-full sm:w-[min(100%,12rem)] shrink-0">
          <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">
            Method
          </span>
          <button
            type="button"
            aria-expanded={methodMenuOpen}
            aria-haspopup="listbox"
            aria-label="Filter by HTTP method"
            onClick={() => setMethodMenuOpen((o) => !o)}
            className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-zinc-700/35 bg-zinc-950/80 px-2 py-1 text-left font-mono text-[11px] leading-tight text-zinc-200 tabular-nums tracking-tight shadow-sm ring-1 ring-black/20 transition-colors hover:bg-zinc-800/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
          >
            <span className="truncate">
              {methodFilter === METHOD_FILTER_ALL ? 'All methods' : methodFilter}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-zinc-500 opacity-80 transition-transform ${methodMenuOpen ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
              aria-hidden
            />
          </button>
          {methodMenuOpen ? (
            <ul
              role="listbox"
              aria-label="HTTP methods"
              className="absolute z-30 mt-1 left-0 min-w-full w-max max-w-[16rem] max-h-44 overflow-y-auto rounded-md border border-zinc-700/50 bg-zinc-950/98 py-0.5 shadow-xl shadow-black/40 backdrop-blur-md"
            >
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={methodFilter === METHOD_FILTER_ALL}
                  onClick={() => {
                    setMethodFilter(METHOD_FILTER_ALL)
                    setMethodMenuOpen(false)
                  }}
                  className={`w-full px-2.5 py-1.5 text-left font-mono text-[11px] tabular-nums transition-colors cursor-pointer ${
                    methodFilter === METHOD_FILTER_ALL
                      ? 'bg-sky-500/12 text-sky-200/95'
                      : 'text-zinc-400 hover:bg-zinc-800/55 hover:text-zinc-200'
                  }`}
                >
                  All methods
                </button>
              </li>
              {methodFilterOptions.map((m) => (
                <li key={m} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={methodFilter === m}
                    onClick={() => {
                      setMethodFilter(m)
                      setMethodMenuOpen(false)
                    }}
                    className={`w-full px-2.5 py-1.5 text-left font-mono text-[11px] tabular-nums transition-colors cursor-pointer ${
                      methodFilter === m
                        ? 'bg-sky-500/12 text-sky-200/95'
                        : 'text-zinc-400 hover:bg-zinc-800/55 hover:text-zinc-200'
                    }`}
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {viewMode === 'list' ? (
        <TimelineListView
          meta={meta}
          allowedMetaIndices={allowedMetaIndices}
          segments={segments}
          segmentIndex={segmentIndex}
          setSegmentIndex={setSegmentIndex}
          selectedIndex={selectedIndex}
          onSelectRequest={onSelectRequest}
          currentReplaySeq={currentReplaySeq ?? null}
          rowRefs={rowRefs}
        />
      ) : (
        <TimelineTrackView
          meta={meta}
          allowedMetaIndices={allowedMetaIndices}
          densityMeta={densityMeta}
          densityIsFiltered={densityIsFiltered}
          totalSpan={totalSpan}
          segments={segments}
          segmentIndex={segmentIndex}
          setSegmentIndex={setSegmentIndex}
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
          {densityIsFiltered ? (
            <div className="text-zinc-500">
              Matching filters: {allowedMetaIndices.length}
            </div>
          ) : null}
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
  allowedMetaIndices,
  segments,
  segmentIndex,
  setSegmentIndex,
  selectedIndex,
  onSelectRequest,
  currentReplaySeq,
  rowRefs,
}: {
  meta: EventMeta[]
  allowedMetaIndices: number[]
  segments: TimelineSegment[]
  segmentIndex: number
  setSegmentIndex: React.Dispatch<React.SetStateAction<number>>
  selectedIndex: number
  onSelectRequest: (index: number) => void
  currentReplaySeq: number | null
  rowRefs: MutableRefObject<Record<number, HTMLElement | null>>
}) {
  const [separateByTimeWindow, setSeparateByTimeWindow] = useState(false)
  const [listWindowMenuOpen, setListWindowMenuOpen] = useState(false)
  const [listPage, setListPage] = useState(0)
  const listWindowPickerRef = useRef<HTMLDivElement>(null)

  const maxSegmentIdx = Math.max(0, segments.length - 1)
  const activeSeg = segments[segmentIndex] ?? segments[0]
  const windowStart = activeSeg?.startMs ?? 0
  const windowEnd = activeSeg?.endMs ?? windowStart + TIMELINE_PAD_MS
  const windowMs = activeSeg?.windowMs ?? TIMELINE_PAD_MS

  const allowedSet = useMemo(() => new Set(allowedMetaIndices), [allowedMetaIndices])

  const allRows = useMemo(
    () =>
      meta
        .map((event, idx) => ({ event, idx }))
        .filter(({ idx }) => allowedSet.has(idx)),
    [meta, allowedSet],
  )

  const windowRows = useMemo(() => {
    const idxs = activeSeg?.metaIndices ?? []
    return idxs.filter((idx) => allowedSet.has(idx)).map((idx) => ({ event: meta[idx], idx }))
  }, [activeSeg, meta, allowedSet])

  const sourceRows = separateByTimeWindow ? windowRows : allRows
  const pageSize = separateByTimeWindow ? LIST_GRID_PAGE_SIZE : LIST_ALL_TABLE_PAGE_SIZE
  const totalInSource = sourceRows.length
  const pageCount = Math.max(1, Math.ceil(totalInSource / pageSize))

  useEffect(() => {
    setListPage(0)
  }, [segmentIndex, separateByTimeWindow, allowedMetaIndices])

  useEffect(() => {
    setListPage((p) => Math.min(p, Math.max(0, pageCount - 1)))
  }, [pageCount])

  useEffect(() => {
    if (!listWindowMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (listWindowPickerRef.current?.contains(e.target as Node)) return
      setListWindowMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListWindowMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [listWindowMenuOpen])

  const safeListPage = Math.min(listPage, pageCount - 1)
  const pageStart = safeListPage * pageSize
  const pageRows = sourceRows.slice(pageStart, pageStart + pageSize)
  const pageLabelFrom = totalInSource === 0 ? 0 : pageStart + 1
  const pageLabelTo = Math.min(pageStart + pageSize, totalInSource)

  const paginationLabel = separateByTimeWindow
    ? 'Pagination within this time window'
    : 'Pagination for all session requests'

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 pt-4 pb-3">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
              Session requests
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={separateByTimeWindow}
                aria-label="Separate by time window"
                title="When on, only requests in the selected time window are listed."
                onClick={() => setSeparateByTimeWindow((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 cursor-pointer ${
                  separateByTimeWindow
                    ? 'bg-sky-600/35 border-sky-500/45'
                    : 'bg-zinc-800 border-zinc-600/60'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-zinc-100 shadow transition-transform duration-200 ease-out ${
                    separateByTimeWindow ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                  aria-hidden
                />
              </button>
              <span className="text-[11px] font-mono text-zinc-400 leading-snug">
                Separate by time window
              </span>
            </div>
          </div>

          {!separateByTimeWindow ? (
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums text-right shrink-0">
              {allRows.length} matching
              {allRows.length !== meta.length ? (
                <span className="text-zinc-600"> · {meta.length} total in session</span>
              ) : (
                <span className="text-zinc-600"> · full session</span>
              )}
              {totalInSource > 0 && (
                <span className="text-zinc-600 block sm:inline sm:ml-2 mt-0.5 sm:mt-0">
                  · {pageLabelFrom}–{pageLabelTo} of {totalInSource}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums text-right shrink-0">
              Window {segmentIndex + 1} / {segments.length}
              {totalInSource > 0 && (
                <span className="text-zinc-600 ml-2">
                  · {pageLabelFrom}–{pageLabelTo} of {totalInSource} in window
                </span>
              )}
            </div>
          )}
        </div>

        {separateByTimeWindow ? (
          <div ref={listWindowPickerRef} className="relative w-fit max-w-[min(100%,18rem)]">
            <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">
              Time window
            </span>
            <div className="flex items-stretch rounded-md border border-zinc-700/35 bg-zinc-950/80 shadow-sm ring-1 ring-black/20 overflow-visible">
              <button
                type="button"
                aria-label="Previous time window"
                disabled={segmentIndex <= 0}
                onClick={() => setSegmentIndex((i) => Math.max(0, i - 1))}
                className="flex items-center justify-center px-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <div className="w-px shrink-0 bg-zinc-700/30 self-stretch my-1 rounded-full" aria-hidden />
              <button
                type="button"
                aria-expanded={listWindowMenuOpen}
                aria-haspopup="listbox"
                aria-label="Choose time window"
                onClick={() => setListWindowMenuOpen((o) => !o)}
                className="flex min-w-0 items-center justify-center gap-1 px-2 py-1 text-center font-mono text-[11px] leading-tight text-zinc-200 tabular-nums tracking-tight hover:bg-zinc-800/30 transition-colors cursor-pointer"
              >
                <span className="truncate">{formatSegmentLabel(windowStart, windowEnd)}</span>
                <ChevronDown
                  className={`w-3 h-3 shrink-0 text-zinc-500 opacity-80 transition-transform ${listWindowMenuOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.5}
                />
              </button>
              <div className="w-px shrink-0 bg-zinc-700/30 self-stretch my-1 rounded-full" aria-hidden />
              <button
                type="button"
                aria-label="Next time window"
                disabled={segmentIndex >= maxSegmentIdx}
                onClick={() => setSegmentIndex((i) => Math.min(maxSegmentIdx, i + 1))}
                className="flex items-center justify-center px-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
            {listWindowMenuOpen ? (
              <ul
                role="listbox"
                aria-label="Time windows with requests"
                className="absolute z-30 mt-1 left-0 min-w-full w-max max-w-[18rem] max-h-44 overflow-y-auto rounded-md border border-zinc-700/50 bg-zinc-950/98 py-0.5 shadow-xl shadow-black/40 backdrop-blur-md"
              >
                {segments.map((seg, listIdx) => (
                  <li key={seg.startMs} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={listIdx === segmentIndex}
                      onClick={() => {
                        setSegmentIndex(listIdx)
                        setListWindowMenuOpen(false)
                      }}
                      className={`w-full px-2.5 py-1.5 text-left font-mono text-[11px] tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                        listIdx === segmentIndex
                          ? 'bg-sky-500/12 text-sky-200/95'
                          : 'text-zinc-400 hover:bg-zinc-800/55 hover:text-zinc-200'
                      }`}
                    >
                      {formatSegmentLabel(seg.startMs, seg.endMs)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {separateByTimeWindow && totalInSource === 0 ? (
        <div className="text-[11px] font-mono text-zinc-500 py-10 text-center border border-dashed border-zinc-800/80 rounded-lg">
          {(activeSeg?.metaIndices.length ?? 0) > 0 ? (
            <>No requests in this window match your search or method filter.</>
          ) : (
            <>No requests in {formatSegmentLabel(windowStart, windowEnd)}</>
          )}
        </div>
      ) : !separateByTimeWindow ? (
        allRows.length === 0 ? (
          <div className="text-[11px] font-mono text-zinc-500 py-10 text-center border border-dashed border-zinc-800/80 rounded-lg">
            No requests match your search or method filter.
          </div>
        ) : (
        <>
          <SessionRequestsCompactTable
            rows={pageRows}
            selectedIndex={selectedIndex}
            onSelectRequest={onSelectRequest}
            currentReplaySeq={currentReplaySeq}
            rowRefs={rowRefs}
            idPrefix="list-all"
          />
          {pageCount > 1 ? (
            <div
              className="flex items-center justify-center gap-1 mt-4 pt-3 border-t border-zinc-800/60"
              aria-label={paginationLabel}
            >
              <button
                type="button"
                aria-label="Previous page"
                disabled={safeListPage <= 0}
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <span className="min-w-30 text-center text-[11px] font-mono text-zinc-500 tabular-nums px-2">
                Page {safeListPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={safeListPage >= pageCount - 1}
                onClick={() => setListPage((p) => Math.min(pageCount - 1, p + 1))}
                className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </>
        )
      ) : (
        <>
          <div className="grid gap-2 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageRows.map(({ event, idx }) => {
              const isSelected = selectedIndex === idx
              const isReplayActive =
                currentReplaySeq != null && Number(event.seq) === currentReplaySeq
              const localStart = event.relativeTimestamp - windowStart
              const startPct = windowMs > 0 ? (localStart / windowMs) * 100 : 0
              const widthPct =
                windowMs > 0 ? Math.max((event.computedDuration / windowMs) * 100, 0.35) : 0.35

              return (
                <button
                  key={event.id}
                  ref={(el) => {
                    rowRefs.current[event.seq] = el
                  }}
                  type="button"
                  onClick={() => onSelectRequest(idx)}
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
                      <span
                        className={`text-xs font-mono whitespace-nowrap shrink-0 ${getStatusColor(
                          event.status,
                        )}`}
                      >
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

          {pageCount > 1 ? (
            <div
              className="flex items-center justify-center gap-1 mt-4 pt-3 border-t border-zinc-800/60"
              aria-label={paginationLabel}
            >
              <button
                type="button"
                aria-label="Previous page in this time window"
                disabled={safeListPage <= 0}
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <span className="min-w-30 text-center text-[11px] font-mono text-zinc-500 tabular-nums px-2">
                Page {safeListPage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page in this time window"
                disabled={safeListPage >= pageCount - 1}
                onClick={() => setListPage((p) => Math.min(pageCount - 1, p + 1))}
                className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function TimelineTrackView({
  meta,
  allowedMetaIndices,
  densityMeta,
  densityIsFiltered,
  totalSpan,
  segments,
  segmentIndex,
  setSegmentIndex,
  selectedIndex,
  onSelectRequest,
  currentReplaySeq,
  rowRefs,
}: {
  meta: EventMeta[]
  allowedMetaIndices: number[]
  densityMeta: EventMeta[]
  densityIsFiltered: boolean
  totalSpan: number
  segments: TimelineSegment[]
  segmentIndex: number
  setSegmentIndex: React.Dispatch<React.SetStateAction<number>>
  selectedIndex: number
  onSelectRequest: (index: number) => void
  currentReplaySeq: number | null
  rowRefs: MutableRefObject<Record<number, HTMLElement | null>>
}) {
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_MIN)
  const [windowMenuOpen, setWindowMenuOpen] = useState(false)
  const windowPickerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dotRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [viewportWidth, setViewportWidth] = useState(0)
  const [trackCardLayout, setTrackCardLayout] = useState<'grid' | 'table'>('grid')
  const [trackCardPage, setTrackCardPage] = useState(0)

  useEffect(() => {
    if (!windowMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (windowPickerRef.current?.contains(e.target as Node)) return
      setWindowMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWindowMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [windowMenuOpen])

  const maxSegmentIdx = Math.max(0, segments.length - 1)

  const activeSeg = segments[segmentIndex] ?? segments[0]
  const windowStart = activeSeg?.startMs ?? 0
  const windowEnd = activeSeg?.endMs ?? windowStart + TIMELINE_PAD_MS
  const windowMs = activeSeg?.windowMs ?? TIMELINE_PAD_MS

  const allowedSet = useMemo(() => new Set(allowedMetaIndices), [allowedMetaIndices])

  const inWindow = useMemo(() => {
    const idxs = activeSeg?.metaIndices ?? []
    return idxs.filter((idx) => allowedSet.has(idx)).map((idx) => ({ event: meta[idx], idx }))
  }, [activeSeg, meta, allowedSet])

  const trackPageSize =
    trackCardLayout === 'grid' ? TRACK_GRID_PAGE_SIZE : TRACK_TABLE_PAGE_SIZE
  const trackTotal = inWindow.length
  const trackPageCount = Math.max(1, Math.ceil(trackTotal / trackPageSize))

  useEffect(() => {
    setTrackCardPage(0)
  }, [segmentIndex, trackCardLayout, allowedMetaIndices])

  useEffect(() => {
    setTrackCardPage((p) => Math.min(p, Math.max(0, trackPageCount - 1)))
  }, [trackPageCount])

  const safeTrackPage = Math.min(trackCardPage, Math.max(0, trackPageCount - 1))
  const trackPageStart = safeTrackPage * trackPageSize
  const trackPageRows = inWindow.slice(trackPageStart, trackPageStart + trackPageSize)
  const trackLabelFrom = trackTotal === 0 ? 0 : trackPageStart + 1
  const trackLabelTo = Math.min(trackPageStart + trackPageSize, trackTotal)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setViewportWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    setViewportWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const contentWidth =
    viewportWidth > 0 ? Math.max(Math.round(viewportWidth * zoom), viewportWidth) : 0

  const clampScrollToDot = useCallback(
    (seq: number, behavior: ScrollBehavior = 'smooth') => {
      const dot = dotRefs.current[seq]
      const vp = viewportRef.current
      if (!dot || !vp || contentWidth <= 0) return
      const center = dot.offsetLeft + dot.offsetWidth / 2
      const half = vp.clientWidth / 2
      const maxScroll = Math.max(0, contentWidth - vp.clientWidth)
      vp.scrollTo({
        left: Math.min(maxScroll, Math.max(0, center - half)),
        behavior,
      })
    },
    [contentWidth],
  )

  useEffect(() => {
    if (currentReplaySeq == null || contentWidth <= 0) return
    clampScrollToDot(currentReplaySeq, 'smooth')
  }, [currentReplaySeq, contentWidth, clampScrollToDot, segmentIndex])

  const onTrackWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1 / 1.08 : 1.08
    setZoom((z) =>
      Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, Math.round(z * factor * 100) / 100)),
    )
  }

  const tickFractions = [0.25, 0.5, 0.75]
  const windowCount = inWindow.length

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 px-4 pt-5 pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div ref={windowPickerRef} className="relative w-fit max-w-[min(100%,15rem)] shrink-0">
          <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">
            Time Window
          </span>
          <div className="flex items-stretch rounded-md border border-zinc-700/35 bg-zinc-950/80 shadow-sm ring-1 ring-black/20 overflow-visible">
            <button
              type="button"
              aria-label="Previous time window"
              disabled={segmentIndex <= 0}
              onClick={() => setSegmentIndex((i) => Math.max(0, i - 1))}
              className="flex items-center justify-center px-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <div className="w-px shrink-0 bg-zinc-700/30 self-stretch my-1 rounded-full" aria-hidden />
            <button
              type="button"
              aria-expanded={windowMenuOpen}
              aria-haspopup="listbox"
              aria-label="Choose time window"
              onClick={() => setWindowMenuOpen((o) => !o)}
              className="flex min-w-0 items-center justify-center gap-1 px-2 py-1 text-center font-mono text-[11px] leading-tight text-zinc-200 tabular-nums tracking-tight hover:bg-zinc-800/30 transition-colors cursor-pointer"
            >
              <span className="truncate">{formatSegmentLabel(windowStart, windowEnd)}</span>
              <ChevronDown
                className={`w-3 h-3 shrink-0 text-zinc-500 opacity-80 transition-transform ${windowMenuOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </button>
            <div className="w-px shrink-0 bg-zinc-700/30 self-stretch my-1 rounded-full" aria-hidden />
            <button
              type="button"
              aria-label="Next time window"
              disabled={segmentIndex >= maxSegmentIdx}
              onClick={() => setSegmentIndex((i) => Math.min(maxSegmentIdx, i + 1))}
              className="flex items-center justify-center px-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          {windowMenuOpen ? (
            <ul
              role="listbox"
              aria-label="Time windows with requests"
              className="absolute z-30 mt-1 left-0 min-w-full w-max max-w-[16rem] max-h-44 overflow-y-auto rounded-md border border-zinc-700/50 bg-zinc-950/98 py-0.5 shadow-xl shadow-black/40 backdrop-blur-md"
            >
              {segments.map((seg, listIdx) => (
                <li key={seg.startMs} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={listIdx === segmentIndex}
                    onClick={() => {
                      setSegmentIndex(listIdx)
                      setWindowMenuOpen(false)
                    }}
                    className={`w-full px-2.5 py-1.5 text-left font-mono text-[11px] tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                      listIdx === segmentIndex
                        ? 'bg-sky-500/12 text-sky-200/95'
                        : 'text-zinc-400 hover:bg-zinc-800/55 hover:text-zinc-200'
                    }`}
                  >
                    {formatSegmentLabel(seg.startMs, seg.endMs)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Zoom</span>
            <div className="inline-flex items-center rounded-md border border-zinc-700/60 bg-zinc-950/80 p-0.5">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) =>
                    Math.max(TIMELINE_ZOOM_MIN, Math.round((z / 1.2) * 100) / 100),
                  )
                }
                disabled={zoom <= TIMELINE_ZOOM_MIN}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-zinc-400 tabular-nums px-2 min-w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setZoom((z) =>
                    Math.min(TIMELINE_ZOOM_MAX, Math.round(z * 1.2 * 100) / 100),
                  )
                }
                disabled={zoom >= TIMELINE_ZOOM_MAX}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Layout</span>
            <div
              className="inline-flex rounded-md border border-zinc-700/60 bg-zinc-950/60 p-0.5 shadow-sm"
              role="group"
              aria-label="Request list layout"
            >
              <button
                type="button"
                onClick={() => setTrackCardLayout('grid')}
                aria-pressed={trackCardLayout === 'grid'}
                title="Grid cards"
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wide transition-colors cursor-pointer ${
                  trackCardLayout === 'grid'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600/40'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setTrackCardLayout('table')}
                aria-pressed={trackCardLayout === 'table'}
                title="Compact table"
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wide transition-colors cursor-pointer ${
                  trackCardLayout === 'table'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600/40'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                <List className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        onWheel={onTrackWheel}
        className="overflow-x-auto overflow-y-visible mb-3 px-3.5"
        style={{ touchAction: zoom > TIMELINE_ZOOM_MIN ? 'pan-x' : undefined }}
        aria-label="Request timeline track"
      >
        {windowCount === 0 ? (
          <div className="text-[11px] font-mono text-zinc-500 py-10 text-center border border-dashed border-zinc-800/80 rounded-lg">
            {(activeSeg?.metaIndices.length ?? 0) === 0 ? (
              <>No requests in {formatSegmentLabel(windowStart, windowEnd)}</>
            ) : (
              <>No requests in this window match your search or method filter.</>
            )}
          </div>
        ) : (
          <div
            className="relative h-[108px] w-full"
            style={{
              width: contentWidth > 0 ? contentWidth : '100%',
              minWidth: '100%',
            }}
          >
            <div
              className="absolute left-0 right-0 top-[46%] h-px bg-linear-to-r from-transparent via-zinc-600/70 to-transparent pointer-events-none"
              aria-hidden
            />
            {[0, ...tickFractions, 1].map((t) => {
              const tickLocalMs = t * windowMs
              const left = contentWidth > 0 ? `${Math.round(t * contentWidth)}px` : `${t * 100}%`
              const showTickLine = t > 0 && t < 1
              const labelStyle =
                t === 0
                  ? ({ left: 0, transform: 'translateX(0)' } as const)
                  : t === 1
                    ? ({ left: '100%', transform: 'translateX(-100%)' } as const)
                    : ({ left, transform: 'translateX(-50%)' } as const)
              return (
                <div key={t} className="pointer-events-none absolute inset-0">
                  {showTickLine ? (
                    <div
                      className="absolute top-[30%] bottom-[28%] w-px bg-zinc-700/35 -translate-x-1/2"
                      style={{ left }}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`absolute top-[78%] text-[9px] font-mono text-zinc-500 whitespace-nowrap ${
                      t === 0 ? 'text-left' : t === 1 ? 'text-right' : 'text-center'
                    }`}
                    style={labelStyle}
                  >
                    {t === 0
                      ? formatClockFromSessionStart(windowStart)
                      : t === 1
                        ? formatClockFromSessionStart(windowEnd)
                        : `+${formatAxisMs(tickLocalMs, windowMs)}`}
                  </span>
                </div>
              )
            })}
            {inWindow.map(({ event, idx }) => {
              const localMs = event.relativeTimestamp - windowStart
              const frac = windowMs > 0 ? localMs / windowMs : 0
              const leftPct = frac * 100
              const leftPx = contentWidth > 0 ? (localMs / windowMs) * contentWidth : 0
              const isSelected = selectedIndex === idx
              const isReplayActive =
                currentReplaySeq != null && Number(event.seq) === currentReplaySeq
              const leftStyle =
                contentWidth > 0
                  ? ({
                      left: `${leftPx}px`,
                      transform: 'translate(-50%, -50%)',
                    } as const)
                  : ({
                      left: `${leftPct}%`,
                      transform: 'translate(-50%, -50%)',
                    } as const)

              return (
                <button
                  key={event.id}
                  ref={(el) => {
                    dotRefs.current[event.seq] = el
                  }}
                  type="button"
                  title={`#${event.seq} ${event.method} ${event.url} · ${formatOffsetMs(event.relativeTimestamp)}`}
                  onClick={() => {
                    onSelectRequest(idx)
                    requestAnimationFrame(() => clampScrollToDot(Number(event.seq), 'smooth'))
                  }}
                  className="absolute top-1/2 z-10 flex flex-col items-center outline-none"
                  style={leftStyle}
                >
                  <span
                    className={[
                      TRACK_DOT_CLASS,
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
        )}
      </div>

      <SessionDensityStrip
        eventsForDensity={densityMeta}
        totalSpan={totalSpan}
        windowStart={windowStart}
        windowEnd={windowEnd}
        densityIsFiltered={densityIsFiltered}
        onPickTime={(ms) => {
          const segIdx = findSegmentIndexForTime(segments, ms)
          setSegmentIndex(segIdx)
          const seg = segments[segIdx]
          if (!seg?.metaIndices.length) return
          let bestIdx: number | null = null
          let bestDt = Infinity
          for (const mi of seg.metaIndices) {
            if (!allowedSet.has(mi)) continue
            const dt = Math.abs(meta[mi]!.relativeTimestamp - ms)
            if (dt < bestDt) {
              bestDt = dt
              bestIdx = mi
            }
          }
          if (bestIdx == null) return
          onSelectRequest(bestIdx)
          const seq = Number(meta[bestIdx]!.seq)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => clampScrollToDot(seq, 'smooth'))
          })
        }}
      />

      {trackTotal > 0 ? (
        <div className="px-0.5">
          <div className="flex items-center justify-end mb-2 text-[10px] font-mono text-zinc-600 tabular-nums">
            {trackLabelFrom}–{trackLabelTo} of {trackTotal}
          </div>

          {trackCardLayout === 'grid' ? (
              <div className="grid gap-2 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {trackPageRows.map(({ event, idx }) => {
                  const isSelected = selectedIndex === idx
                  const isReplayActive =
                    currentReplaySeq != null && Number(event.seq) === currentReplaySeq
                  return (
                    <button
                      key={`label-${event.id}`}
                      ref={(el) => {
                        rowRefs.current[event.seq] = el
                      }}
                      type="button"
                      onClick={() => onSelectRequest(idx)}
                      className={[
                        'rounded-lg border px-2.5 py-2 text-left transition-all duration-200 cursor-pointer h-full min-h-0',
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
                        <span className="text-[10px] font-mono text-zinc-400 truncate">
                          {formatOffsetMs(event.relativeTimestamp)}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-200/90 truncate mt-1">{event.url}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <SessionRequestsCompactTable
                rows={trackPageRows}
                selectedIndex={selectedIndex}
                onSelectRequest={onSelectRequest}
                currentReplaySeq={currentReplaySeq}
                rowRefs={rowRefs}
                idPrefix="track-tbl"
              />
            )}

            {trackPageCount > 1 ? (
              <div
                className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-zinc-800/60"
                aria-label="Pagination for requests in this window"
              >
                <button
                  type="button"
                  aria-label="Previous page of requests"
                  disabled={safeTrackPage <= 0}
                  onClick={() => setTrackCardPage((p) => Math.max(0, p - 1))}
                  className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                </button>
                <span className="min-w-30 text-center text-[11px] font-mono text-zinc-500 tabular-nums px-2">
                  Page {safeTrackPage + 1} / {trackPageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page of requests"
                  disabled={safeTrackPage >= trackPageCount - 1}
                  onClick={() => setTrackCardPage((p) => Math.min(trackPageCount - 1, p + 1))}
                  className="flex items-center justify-center rounded-md border border-zinc-700/40 bg-zinc-950/60 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/45 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            ) : null}
        </div>
      ) : null}
    </div>
  )
}
