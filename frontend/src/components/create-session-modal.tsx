"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
import { createSession, Session } from "@/lib/api";
import { useAppError } from "@/components/app-error-provider";

interface CreateSessionModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (session: Session) => void;
}

export function CreateSessionModal({
  projectId,
  onClose,
  onCreated,
}: CreateSessionModalProps) {
  const { showError } = useAppError();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setName("");
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    const newSession = await createSession(projectId, trimmed);
    setLoading(false);

    if (newSession) {
      onCreated(newSession);
      onClose();
    } else {
      showError({
        severity: "error",
        title: "Could not create session",
        message:
          "The server did not create this session. Check that the backend is running and try again.",
      });
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-blue-900/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50 bg-blue-900/10">
          <h2 className="text-lg font-mono font-semibold text-blue-200 tracking-wide">
            Create New Session
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-blue-400 hover:text-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="create-session-form" onSubmit={handleSubmit} className="p-6">
          <div className="space-y-2">
            <label
              htmlFor="session-name"
              className="text-xs font-mono text-blue-400 uppercase tracking-wider block"
            >
              Session name
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Login flow debug"
              className="w-full bg-blue-900/10 border border-blue-900/50 rounded px-4 py-2 text-blue-200 font-mono text-sm focus:outline-none focus:border-blue-600/50 placeholder:text-blue-400/40"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-blue-900/50 bg-blue-900/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-blue-900/50 text-blue-300 rounded font-mono text-sm hover:bg-blue-900/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-session-form"
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {loading ? "Creating…" : "Create session"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(modal, document.body);
}
