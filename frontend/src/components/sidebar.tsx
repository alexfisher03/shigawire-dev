'use client'

import React, { useState } from 'react'
import { Archive, Home, Plus, Settings } from 'lucide-react'
import { Project } from '@/lib/api'
import { ProjectConfigForm } from '@/components/project-config-form'

interface SidebarProps {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onProjectCreated: (project: Project) => void
}

export function Sidebar({ projects, selectedProjectId, onSelectProject, onProjectCreated }: SidebarProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleNewProject = () => {
    setIsCreateOpen(true)
  }

  return (
    <>
      <aside className="w-64 border-r border-blue-900/50 bg-black/60 flex flex-col h-full backdrop-blur-sm">
        <nav className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-1">
            <NavItem
              icon={<Home className="w-4 h-4" />}
              label="All Sessions"
              active={selectedProjectId === null}
              onClick={() => onSelectProject(null)}
            />
            {/* <NavItem icon={<Archive className="w-4 h-4" />} label="Archived" /> */}
            {/* <NavItem icon={<Settings className="w-4 h-4" />} label="Configuration" /> */}
          </div>

          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-semibold text-blue-400/70 uppercase tracking-wider">
                Projects
              </h3>
              <button
                onClick={handleNewProject}
                className="p-1 hover:bg-blue-600/20 rounded text-blue-400 hover:text-blue-200 transition-colors"
                title="New Project"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`px-3 py-2 rounded text-sm cursor-pointer border transition-colors font-mono ${selectedProjectId === project.id
                      ? 'bg-blue-600/20 border-blue-600/50 text-blue-200'
                      : 'border-transparent hover:bg-blue-600/10 hover:border-blue-900/50 text-blue-300/70 hover:text-blue-200'
                    }`}
                >
                  {project.name}
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-xs text-blue-500/50 italic px-2">No projects yet</div>
              )}
            </div>
          </div>

          <div className="px-4 py-4 border-t border-blue-900/50 text-xs space-y-1 font-mono">
            <div className="text-blue-400/70">
              <span className="font-semibold text-blue-300">Status:</span> Connected
            </div>
          </div>
        </nav>
      </aside>

      {isCreateOpen && (
        <ProjectConfigForm
          onCreate={(newProj) => {
            onProjectCreated(newProj)
            setIsCreateOpen(false)
          }}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </>
  )
}

function NavItem({
  icon,
  label,
  active = false,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-mono transition-colors ${active
        ? 'bg-blue-600/20 border border-blue-600/50 text-blue-200'
        : 'text-blue-400/70 hover:bg-blue-600/10 border border-transparent hover:border-blue-900/50 hover:text-blue-200'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}
