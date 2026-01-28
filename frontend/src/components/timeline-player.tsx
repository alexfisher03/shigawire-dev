'use client'

interface Event {
  id: string
  method: string
  path: string
  status?: number
  duration?: number
  timestamp?: string
}

const getMethodColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    case 'POST':
      return 'bg-green-500/20 text-green-400 border-green-500/50'
    case 'PUT':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    case 'DELETE':
      return 'bg-red-500/20 text-red-400 border-red-500/50'
    case 'PATCH':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
  }
}

const getStatusColor = (status?: number) => {
  if (!status) return 'text-blue-400/70'
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 300 && status < 400) return 'text-blue-400'
  if (status >= 400 && status < 500) return 'text-yellow-400'
  return 'text-red-400'
}

export function TimelinePlayer({
  isPlaying,
  selectedIndex,
  onSelectRequest,
  events = [],
}: {
  isPlaying: boolean
  selectedIndex: number
  onSelectRequest: (index: number) => void
  events?: Event[]
}) {
  // Calculate relative timestamps from event timestamps
  const eventsWithTimestamps = events.map((event, index) => {
    const timestamp = event.timestamp ? new Date(event.timestamp).getTime() : 0
    const firstTimestamp = events[0]?.timestamp ? new Date(events[0].timestamp).getTime() : 0
    return {
      ...event,
      relativeTimestamp: timestamp - firstTimestamp,
    }
  })

  const maxTimestamp = eventsWithTimestamps.length > 0
    ? Math.max(...eventsWithTimestamps.map((e) => e.relativeTimestamp + (e.duration || 0)))
    : 0

  if (events.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-mono font-semibold text-blue-200 mb-4 tracking-wide">Request Timeline</h3>
        <div className="text-center text-blue-400/70 font-mono text-sm py-8">
          No events recorded for this session
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="text-sm font-mono font-semibold text-blue-200 mb-4 tracking-wide">Request Timeline</h3>
      <div className="space-y-2">
        {eventsWithTimestamps.map((event, index) => {
          const isSelected = selectedIndex === index

          return (
            <button
              key={event.id}
              onClick={() => onSelectRequest(index)}
              className={`w-full p-3 rounded border transition-all text-left cursor-pointer ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-600/50'
                  : 'bg-blue-600/5 border-blue-900/50 hover:bg-blue-600/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getMethodColor(event.method)}`}>
                    {event.method}
                  </span>
                  <code className="text-xs text-blue-300/70 truncate font-mono">
                    {event.path}
                  </code>
                </div>
                {event.status && (
                  <span className={`text-xs font-mono whitespace-nowrap ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-400/70 font-mono">
                  <span>+{event.relativeTimestamp}ms</span>
                  {event.duration && <span>{event.duration}ms</span>}
                </div>
                {event.duration && maxTimestamp > 0 && (
                  <div className="h-1.5 bg-blue-900/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60"
                      style={{ width: `${Math.min((event.duration / maxTimestamp) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 p-3 rounded bg-blue-600/10 border border-blue-900/50 text-xs text-blue-400/70 font-mono">
        <div className="font-semibold text-blue-200 mb-2">Timeline Stats</div>
        <div className="space-y-1">
          <div>Total requests: {events.length}</div>
          <div>Total duration: {maxTimestamp}ms</div>
          {events.length > 0 && (
            <div>
              Average response:{' '}
              {Math.round(
                events.reduce((acc, e) => acc + (e.duration || 0), 0) / events.length
              )}
              ms
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
