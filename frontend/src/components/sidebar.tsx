"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Archive, Home, Plus, Settings, Pencil, X, Trash2 } from "lucide-react";
import { Project } from "@/lib/api";
import { ProjectConfigForm } from "@/components/project-config-form";
import { deleteProject } from "@/lib/api";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onProjectCreated: (project: Project) => void;
  onProjectsDeleted?: (deletedIds: string[]) => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onProjectCreated,
  onProjectsDeleted,
}: SidebarProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;

  const selectedNames = useMemo(() => {
    if (selectedCount === 0) return [];
    const ids = selectedIds;
    return projects.filter((p) => ids.has(p.id)).map((p) => p.name);
  }, [selectedIds, projects, selectedCount]);

  const toggleSelectMode = () => {
    setDeleteError(null);
    setIsConfirmDeleteOpen(false);

    setIsSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  };

  const toggleProjectSelected = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const openConfirmIfNeeded = () => {
    setDeleteError(null);
    if (selectedCount === 0) return;
    setIsConfirmDeleteOpen(true);
  };

  const cancelConfirm = () => {
    if (isDeleting) return;
    setIsConfirmDeleteOpen(false);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    setDeleteError(null);

    const idsToDelete = Array.from(selectedIds);

    try {
      const results = await Promise.all(
        idsToDelete.map(async (id) => ({ id, ok: await deleteProject(id) })),
      );

      const succeeded = results.filter((r) => r.ok).map((r) => r.id);
      const failed = results.filter((r) => !r.ok).map((r) => r.id);

      if (succeeded.length > 0) {
        onProjectsDeleted?.(succeeded);
      }

      if (failed.length > 0) {
        setDeleteError(`Failed to delete ${failed.length} project(s).`);
        return;
      }

      setSelectedIds(new Set());
      setIsConfirmDeleteOpen(false);
      setIsSelectMode(false);

      if (selectedProjectId && succeeded.includes(selectedProjectId)) {
        onSelectProject(null);
      }
    } catch (err) {
      setDeleteError("Failed to delete one or more projects.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNewProject = () => {
    setIsCreateOpen(true);
  };

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
          </div>

          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-semibold text-blue-400/70 uppercase tracking-wider">
                Projects
              </h3>

              <div className="flex items-center gap-1">
                {/* New Project */}
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="p-1 hover:bg-blue-600/20 text-blue-400 hover:text-blue-200 transition-colors"
                  title="New Project"
                >
                  <Plus className="w-3 h-3" />
                </button>

                {/* Select Mode */}
                <button
                  onClick={toggleSelectMode}
                  className={`p-1 transition-colors ${
                    isSelectMode
                      ? "bg-blue-600/20 text-blue-200"
                      : "text-blue-400 hover:bg-blue-600/20 hover:text-blue-200"
                  }`}
                  title={isSelectMode ? "Exit Select Mode" : "Select Projects"}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Select mode actions */}
            {isSelectMode && (
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-mono text-blue-400/70">
                  Selected: {selectedCount}
                </div>
                <button
                  onClick={openConfirmIfNeeded}
                  disabled={selectedCount === 0}
                  className={`flex items-center gap-2 px-2 py-1 text-xs font-mono border transition-colors ${
                    selectedCount === 0
                      ? "border-blue-900/40 text-blue-500/40 cursor-not-allowed"
                      : "border-blue-800/60 text-blue-200 hover:bg-blue-600/10"
                  }`}
                  title="Delete selected"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selectedCount})
                </button>
              </div>
            )}

            <div className="space-y-2">
              {projects.map((project) => {
                const isActive = selectedProjectId === project.id;
                const isChecked = selectedIds.has(project.id);

                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (isSelectMode) toggleProjectSelected(project.id);
                      else onSelectProject(project.id);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer border transition-colors font-mono flex items-center gap-2 ${
                      isActive && !isSelectMode
                        ? "bg-blue-600/20 border-blue-600/50 text-blue-200"
                        : "border-transparent hover:bg-blue-600/10 hover:border-blue-900/50 text-blue-300/70 hover:text-blue-200"
                    }`}
                  >
                    {isSelectMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProjectSelected(project.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-blue-500"
                      />
                    )}
                    <span className="truncate">{project.name}</span>
                  </div>
                );
              })}

              {projects.length === 0 && (
                <div className="text-xs text-blue-500/50 italic px-2">
                  No projects yet
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-4 border-t border-blue-900/50 text-xs space-y-1 font-mono">
            <div className="text-blue-400/70">
              <span className="font-semibold text-blue-300">Status:</span>{" "}
              Connected
            </div>
          </div>
        </nav>
      </aside>

      {isCreateOpen && (
        <ProjectConfigForm
          onCreate={(newProj) => {
            onProjectCreated(newProj);
            setIsCreateOpen(false);
          }}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {isConfirmDeleteOpen && (
        <ConfirmDeleteModal
          count={selectedCount}
          names={selectedNames}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={cancelConfirm}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-mono transition-colors border ${
        active
          ? "bg-blue-600/20 border-blue-600/50 text-blue-200"
          : "text-blue-400/70 hover:bg-blue-600/10 border-transparent hover:border-blue-900/50 hover:text-blue-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ConfirmDeleteModal({
  count,
  names,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  count: number;
  names: string[];
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md border border-blue-900/60 bg-black text-blue-100 font-mono">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-900/60">
          <div className="text-sm tracking-wide">Confirm delete</div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 text-blue-400 hover:text-blue-200 hover:bg-blue-600/10"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div className="text-sm text-blue-200">
            Are you sure you want to delete {count} project
            {count === 1 ? "" : "s"}?
          </div>

          {names.length > 0 && (
            <div className="max-h-40 overflow-auto border border-blue-900/50 bg-black/40 p-2 text-xs text-blue-300/80">
              {names.map((n) => (
                <div key={n} className="truncate">
                  {n}
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-blue-400/70">
            This will also delete all sessions and events under the project.
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-blue-900/60">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3 py-1 text-xs border border-blue-900/60 text-blue-300 hover:bg-blue-600/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-3 py-1 text-xs border border-blue-600/60 text-blue-100 hover:bg-blue-600/20"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
