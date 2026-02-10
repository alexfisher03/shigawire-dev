'use client'

import { useState, useEffect } from 'react'
import { Project, ProjectConfig, updateProject, createProject, deleteProject } from '@/lib/api'
import { Save, X, Trash2 } from 'lucide-react'
import { ConfirmDialog } from './confirm-dialog'

interface ProjectConfigFormProps {
    project?: Project
    onUpdate?: (updatedProject: Project) => void
    onCreate?: (newProject: Project) => void
    onDelete?: (projectId: string) => void
    onClose: () => void
}

export function ProjectConfigForm({ project, onUpdate, onCreate, onDelete, onClose }: ProjectConfigFormProps) {
    const [config, setConfig] = useState<ProjectConfig>({})
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Parse config on mount or project change
    useEffect(() => {
        if (project) {
            setName(project.name)
            try {
                const parsed = JSON.parse(project.config_json)
                setConfig(parsed)
            } catch (e) {
                console.error("Failed to parse project config", e)
                setConfig({})
            }
        } else {
            // Defaults for new project
            setName('')
            setConfig({})
        }
    }, [project])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (project) {
            // Update existing
            const updated = await updateProject(project.id, name, config)
            if (updated && onUpdate) {
                onUpdate(updated)
                onClose()
            } else {
                alert('Failed to save project')
            }
        } else {
            // Create new
            const newProject = await createProject(name, config)
            if (newProject && onCreate) {
                onCreate(newProject)
                onClose()
            } else {
                alert('Failed to create project')
            }
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        if (!project) return
        setLoading(true)
        const success = await deleteProject(project.id)
        if (success && onDelete) {
            onDelete(project.id)
            onClose()
        } else if (!success) {
            alert('Failed to delete project')
        }
        setLoading(false)
        setShowDeleteConfirm(false)
    }

    const title = project ? "Project Configuration" : "Create New Project"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-blue-900/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50 bg-blue-900/10">
                    <h2 className="text-lg font-mono font-semibold text-blue-200 tracking-wide">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-blue-400 hover:text-blue-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    <form id="project-config-form" onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Awesome Project"
                                required
                                className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50 placeholder-blue-900/50"
                            />
                        </div>

                        <div className="p-6 border border-blue-900/50 rounded bg-blue-900/5 space-y-6">
                            <h3 className="text-sm font-mono font-semibold text-blue-300">Target Service Configuration</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Service Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Payment Service"
                                        value={config.targetName || ''}
                                        onChange={(e) => setConfig({ ...config, targetName: e.target.value })}
                                        className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Scheme</label>
                                    <select
                                        value={config.targetScheme || 'http'}
                                        onChange={(e) => setConfig({ ...config, targetScheme: e.target.value as 'http' | 'https' })}
                                        className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                                    >
                                        <option value="http">http</option>
                                        <option value="https">https</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Host</label>
                                    <input
                                        type="text"
                                        placeholder="localhost"
                                        value={config.targetHost || ''}
                                        onChange={(e) => setConfig({ ...config, targetHost: e.target.value })}
                                        className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">Port</label>
                                    <input
                                        type="number"
                                        placeholder="8080"
                                        value={config.targetPort || ''}
                                        onChange={(e) => setConfig({ ...config, targetPort: parseInt(e.target.value) || undefined })}
                                        className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-blue-900/50 bg-blue-900/10 flex justify-between">
                    {project ? (
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded font-mono text-sm transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Project
                        </button>
                    ) : <div />}
                    <button
                        type="submit"
                        form="project-config-form"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-mono text-sm transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Saving...' : title === "Create New Project" ? 'Create Project' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Project"
                    message="Are you sure? This will permanently delete this project and all its sessions."
                    confirmLabel="Delete Project"
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                    loading={loading}
                />
            )}
        </div>
    )
}
