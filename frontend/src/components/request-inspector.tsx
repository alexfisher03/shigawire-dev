import React, { useState } from "react"

import { ChevronDown, AlertCircle } from 'lucide-react'
import { Event } from '@/lib/api'

const getStatusText = (status?: number) => {
  if (!status) return 'Unknown'
  if (status >= 200 && status < 300) return 'OK'
  if (status >= 300 && status < 400) return 'Redirect'
  if (status >= 400 && status < 500) return 'Client Error'
  return 'Server Error'
}

export function RequestInspector({ requestIndex, events = [] }: { requestIndex: number; events?: Event[] }) {
  const event = events[requestIndex] || null

  if (!event) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-blue-900/50">
          <h3 className="text-sm font-mono font-semibold text-blue-200 tracking-wide">Request Details</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-blue-400/70 font-mono text-sm">Select a request to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-blue-900/50">
        <h3 className="text-sm font-mono font-semibold text-blue-200 tracking-wide">Request Details</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-blue-900/50">
          {/* Request Line */}
          <Section title="Request" defaultOpen>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-blue-300 font-bold">{event.method}</span>{' '}
                <span className="text-blue-400/70">{event.url}</span>
              </div>
              {event.started_at && (
                <div className="text-blue-400/70 text-xs mt-2">
                  {new Date(event.started_at).toLocaleString()}
                </div>
              )}
            </div>
          </Section>

          {/* Response Status */}
          <Section title="Response">
            <div className="text-xs space-y-1 font-mono">
              <div>
                <span className={`font-semibold ${event.status ? (event.status >= 200 && event.status < 300 ? 'text-green-400' : event.status >= 400 ? 'text-red-400' : 'text-yellow-400') : 'text-blue-400/70'}`}>
                  {event.status || 'N/A'}
                </span>{' '}
                <span className="text-blue-400/70">{getStatusText(event.status)}</span>
              </div>
              {event.durationMs && (
                <div className="text-blue-400/70 text-xs mt-1">
                  Duration: {event.durationMs}ms
                </div>
              )}
            </div>
          </Section>

          {/* Request Headers */}
          {event.req_headers && Object.keys(event.req_headers).length > 0 && (
            <Section title="Request Headers">
              <div className="space-y-1 text-xs font-mono">
                {Object.entries(event.req_headers).map(([key, vals]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:gap-2 border-b border-blue-900/30 pb-1 last:border-0 last:pb-0">
                    <span className="text-blue-300 font-semibold min-w-32">{key}:</span>
                    <span className="text-blue-400/80 break-all">{vals.join(', ')}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Request Body */}
          {event.req_body && (
            <Section title="Request Body">
              {event.req_body_truncated && (
                <div className="mb-2 text-xs text-yellow-500/80 flex items-center gap-1 bg-yellow-500/10 p-1.5 rounded border border-yellow-500/30">
                  <AlertCircle className="w-3 h-3" />
                  Body truncated
                </div>
              )}
              <div className="text-xs font-mono max-h-64 overflow-y-auto bg-black/40 p-2 rounded border border-blue-900/50">
                <pre className="text-blue-400/90 whitespace-pre-wrap break-words">{event.req_body}</pre>
              </div>
            </Section>
          )}

          {/* Response Headers */}
          {event.resp_headers && Object.keys(event.resp_headers).length > 0 && (
            <Section title="Response Headers">
              <div className="space-y-1 text-xs font-mono">
                {Object.entries(event.resp_headers).map(([key, vals]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:gap-2 border-b border-blue-900/30 pb-1 last:border-0 last:pb-0">
                    <span className="text-blue-300 font-semibold min-w-32">{key}:</span>
                    <span className="text-blue-400/80 break-all">{vals.join(', ')}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Response Body */}
          {event.resp_body && (
            <Section title="Response Body">
              {event.resp_body_truncated && (
                <div className="mb-2 text-xs text-yellow-500/80 flex items-center gap-1 bg-yellow-500/10 p-1.5 rounded border border-yellow-500/30">
                  <AlertCircle className="w-3 h-3" />
                  Body truncated
                </div>
              )}
              <div className="text-xs font-mono max-h-96 overflow-y-auto bg-black/40 p-2 rounded border border-blue-900/50">
                <pre className="text-blue-400/90 whitespace-pre-wrap break-words">{event.resp_body}</pre>
              </div>
            </Section>
          )}

          {/* Event Metadata */}
          <Section title="Metadata">
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-blue-300 font-semibold">Event ID:</span>{' '}
                <span className="text-blue-400/70">{event.id}</span>
              </div>
              {event.started_at && (
                <div>
                  <span className="text-blue-300 font-semibold">Timestamp:</span>{' '}
                  <span className="text-blue-400/70">{event.started_at}</span>
                </div>
              )}
              {event.redaction_applied && (
                <div>
                  <span className="text-blue-300 font-semibold">Redacted Fields:</span>{' '}
                  <span className="text-orange-400/80">{event.redaction_applied}</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen || false)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-600/10 transition-colors text-left border-b border-blue-900/50 cursor-pointer"
      >
        <span className="text-xs font-mono font-semibold text-blue-200">{title}</span>
        <ChevronDown
          className={`w-3 h-3 text-blue-400/70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 text-xs bg-blue-600/5 border-t border-blue-900/50">
          {children}
        </div>
      )}
    </div>
  )
}
