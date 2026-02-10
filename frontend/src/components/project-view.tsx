'use client'

import { useState, useEffect } from 'react'
import { Project, getProject } from '@/lib/api'
import { SessionList } from '@/components/session-list'
import { ProjectConfigForm } from '@/components/project-config-form'
import { Settings } from 'lucide-react'

interface ProjectViewProps {
    projectId: string
    onSessionSelect: (sessionId: string) => void
    onUpdateProject: (project: Project) => void
    onDeleteProject: (projectId: string) => void
}

export function ProjectView({ projectId, onSessionSelect, onUpdateProject, onDeleteProject }: ProjectViewProps) {
    const [project, setProject] = useState<Project | null>(null)
    const [isConfigOpen, setIsConfigOpen] = useState(false)

    useEffect(() => {
        loadProject()
    }, [projectId])

    async function loadProject() {
        const p = await getProject(projectId)
        setProject(p)
    }

    const handleProjectUpdate = (updated: Project) => {
        setProject(updated)
        onUpdateProject(updated) // Bubble up to parent/sidebar
    }

    if (!project) {
        return <div className="p-8 text-blue-400/70 font-mono">Loading project...</div>
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Project Header */}
            <div className="h-14 border-b border-blue-900/50 bg-black/40 flex items-center px-6 justify-between shrink-0">
                <h2 className="text-lg font-mono font-semibold text-blue-200">
                    {project.name}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="p-2 hover:bg-blue-600/10 border border-blue-900/50 rounded transition-colors text-blue-400/70 hover:text-blue-200"
                        title="Configuration"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <SessionList projectId={projectId} onSessionSelect={onSessionSelect} />
            </div>

            {isConfigOpen && (
                <ProjectConfigForm
                    project={project}
                    onUpdate={handleProjectUpdate}
                    onDelete={onDeleteProject}
                    onClose={() => setIsConfigOpen(false)}
                />
            )}
        </div>
    )
}
