"use client";

import { useState, useEffect, useRef } from "react";
import {
  Project,
  ProjectConfig,
  updateProject,
  createProject,
  deleteProject,
} from "@/lib/api";
import { Save, X, Trash2, ChevronDown } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";
import { useAppError } from "./app-error-provider";

interface ProjectConfigFormProps {
  project?: Project;
  onUpdate?: (updatedProject: Project) => void;
  onCreate?: (newProject: Project) => void;
  onDelete?: (projectId: string) => void;
  onClose: () => void;
}

const DEFAULT_CONFIG: ProjectConfig = { targetScheme: "http" };

const SCHEME_OPTIONS = ["http", "https"] as const;

export function ProjectConfigForm({
  project,
  onUpdate,
  onCreate,
  onDelete,
  onClose,
}: ProjectConfigFormProps) {
  const { showError } = useAppError();
  const [config, setConfig] = useState<ProjectConfig>(DEFAULT_CONFIG);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const schemePickerRef = useRef<HTMLDivElement>(null);

  // Parse config on mount or project change
  useEffect(() => {
    if (project) {
      setName(project.name);
      try {
        const parsed = JSON.parse(project.config_json);
        setConfig(parsed);
      } catch (e) {
        console.error("Failed to parse project config", e);
        setConfig({});
      }
    } else {
      // Defaults for new project
      setName("");
      setConfig({});
    }
  }, [project]);

  useEffect(() => {
    if (!schemeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (schemePickerRef.current?.contains(e.target as Node)) return;
      setSchemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSchemeOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [schemeOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (project) {
      const updated = await updateProject(project.id, name, config);
      if (updated && onUpdate) {
        onUpdate(updated);
        onClose();
      } else {
        showError({
          severity: "error",
          title: "Could not save project",
          message:
            "The server did not accept the update. Check that the backend is running and try again.",
        });
      }
    } else {
      const normalizedConfig: ProjectConfig = { ...DEFAULT_CONFIG, ...config };
      const newProject = await createProject(name, normalizedConfig);

      if (newProject && onCreate) {
        onCreate(newProject);
        onClose();
      } else {
        showError({
          severity: "error",
          title: "Could not create project",
          message:
            "The project could not be created. Check that the backend is running and try again.",
        });
      }
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!project) return;
    setLoading(true);
    const success = await deleteProject(project.id);
    if (success && onDelete) {
      onDelete(project.id);
      onClose();
    } else if (!success) {
      showError({
        severity: "critical",
        title: "Could not delete project",
        message:
          "The project was not removed. Close other clients using it, verify the backend, and try again.",
      });
    }
    setLoading(false);
    setShowDeleteConfirm(false);
  };

  const title = project ? "Project Configuration" : "Create New Project";
  const activeScheme = (config.targetScheme || "http") as "http" | "https";

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
          <form
            id="project-config-form"
            onSubmit={handleSave}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                Project Name
              </label>
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
              <h3 className="text-sm font-mono font-semibold text-blue-300">
                Target Service Configuration
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                    Service Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Payment Service"
                    value={config.targetName || ""}
                    onChange={(e) =>
                      setConfig({ ...config, targetName: e.target.value })
                    }
                    className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="scheme-trigger"
                    className="block text-xs font-mono text-blue-400 uppercase tracking-wider"
                  >
                    Scheme
                  </label>
                  <div ref={schemePickerRef} className="relative">
                    <button
                      type="button"
                      id="scheme-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={schemeOpen}
                      onClick={() => setSchemeOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 rounded border border-blue-900/50 bg-blue-900/10 px-4 py-2 text-left font-mono text-blue-200 transition-colors hover:border-blue-700/60 focus:border-blue-600/50 focus:outline-none cursor-pointer"
                    >
                      <span>{activeScheme}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-blue-400/80 transition-transform ${schemeOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {schemeOpen ? (
                      <ul
                        role="listbox"
                        aria-label="URL scheme"
                        className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded border border-blue-900/60 bg-[#0a0a0a] py-1 shadow-lg shadow-black/40"
                      >
                        {SCHEME_OPTIONS.map((opt) => (
                          <li key={opt} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={opt === activeScheme}
                              onClick={() => {
                                setConfig({
                                  ...config,
                                  targetScheme: opt,
                                });
                                setSchemeOpen(false);
                              }}
                              className={`w-full px-4 py-2 text-left font-mono text-sm transition-colors cursor-pointer ${
                                opt === activeScheme
                                  ? "bg-blue-600/25 text-blue-100"
                                  : "text-blue-200/90 hover:bg-blue-900/40"
                              }`}
                            >
                              {opt}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                    Host
                  </label>
                  <input
                    type="text"
                    placeholder="localhost"
                    value={config.targetHost || ""}
                    onChange={(e) =>
                      setConfig({ ...config, targetHost: e.target.value })
                    }
                    className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono focus:outline-none focus:border-blue-600/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                    Port
                  </label>
                  <input
                    type="number"
                    placeholder="8080"
                    value={config.targetPort || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        targetPort: parseInt(e.target.value) || undefined,
                      })
                    }
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
          ) : (
            <div />
          )}
          <button
            type="submit"
            form="project-config-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-mono text-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading
              ? "Saving..."
              : title === "Create New Project"
                ? "Create Project"
                : "Save Configuration"}
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
  );
}
