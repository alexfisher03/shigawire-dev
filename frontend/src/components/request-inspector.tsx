'use client'

import React from "react"

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
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
              {event.startedAt && (
                <div className="text-blue-400/70 text-xs mt-2">
                  {new Date(event.startedAt).toLocaleString()}
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

          {/* Event Metadata */}
          <Section title="Metadata">
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-blue-300 font-semibold">Event ID:</span>{' '}
                <span className="text-blue-400/70">{event.id}</span>
              </div>
              {event.startedAt && (
                <div>
                  <span className="text-blue-300 font-semibold">Timestamp:</span>{' '}
                  <span className="text-blue-400/70">{event.startedAt}</span>
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
