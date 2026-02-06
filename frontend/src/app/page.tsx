'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { SessionList } from '@/components/session-list'
import { ReplayView } from '@/components/replay-view'
import { ProjectView } from '@/components/project-view'
import { listProjects, Project } from '@/lib/api'

export default function Home() {
  const [view, setView] = useState<'list' | 'replay'>('list')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    const fetched = await listProjects()
    setProjects(fetched)
  }

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setView('replay')
  }

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    // Reset view to list when switching projects/global
    setView('list')
  }

  // Called when a new project is created via Sidebar
  const handleProjectCreated = (newProject: Project) => {
    setProjects(prev => [newProject, ...prev])
    handleProjectSelect(newProject.id)
  }

  // Called when ProjectView updates a project (rename)
  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p))
  }

  // Determine main content based on state
  const renderContent = () => {
    if (view === 'replay') {
      return <ReplayView sessionId={selectedSessionId} onBack={() => setView('list')} />
    }

    if (selectedProjectId) {
      return <ProjectView
        projectId={selectedProjectId}
        onSessionSelect={handleSessionSelect}
        onUpdateProject={handleProjectUpdated}
      />
    }

    // Default: Global Session List (Aggregated)
    return <SessionList onSessionSelect={handleSessionSelect} />
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,136,255,0.10)_0%,rgba(0,0,0,0.95)_55%,rgba(0,0,0,1)_100%)]" />
      <div className="relative flex flex-col h-full">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleProjectSelect}
            onProjectCreated={handleProjectCreated}
          />
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
