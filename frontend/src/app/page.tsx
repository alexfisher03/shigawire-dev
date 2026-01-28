'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { SessionList } from '@/components/session-list'
import { ReplayView } from '@/components/replay-view'

export default function Home() {
  const [view, setView] = useState<'list' | 'replay'>('list')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setView('replay')
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,136,255,0.10)_0%,rgba(0,0,0,0.95)_55%,rgba(0,0,0,1)_100%)]" />
      <div className="relative flex flex-col h-full">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          {view === 'list' ? (
            <SessionList onSessionSelect={handleSessionSelect} />
          ) : (
            <ReplayView sessionId={selectedSessionId} onBack={() => setView('list')} />
          )}
        </div>
      </div>
    </div>
  )
}
