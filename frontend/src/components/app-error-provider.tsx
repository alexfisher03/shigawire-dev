"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, CircleAlert, Info } from "lucide-react";

export type AppErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppErrorOptions {
  severity: AppErrorSeverity;
  title: string;
  message: string;
  /** Optional technical detail (stack, status line, etc.) */
  detail?: string;
}

interface AppErrorContextValue {
  showError: (options: AppErrorOptions) => void;
}

const AppErrorContext = createContext<AppErrorContextValue | null>(null);

export function useAppError(): AppErrorContextValue {
  const ctx = useContext(AppErrorContext);
  if (!ctx) {
    throw new Error("useAppError must be used within AppErrorProvider");
  }
  return ctx;
}

const severityConfig: Record<
  AppErrorSeverity,
  {
    Icon: typeof Info;
    headerBg: string;
    headerBorder: string;
    iconClass: string;
    titleClass: string;
    shellBorder: string;
    buttonClass: string;
  }
> = {
  info: {
    Icon: Info,
    headerBg: "bg-blue-900/15",
    headerBorder: "border-blue-900/50",
    iconClass: "text-blue-400",
    titleClass: "text-blue-200",
    shellBorder: "border-blue-900/50",
    buttonClass:
      "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/40",
  },
  warning: {
    Icon: AlertTriangle,
    headerBg: "bg-amber-500/10",
    headerBorder: "border-amber-500/25",
    iconClass: "text-amber-400",
    titleClass: "text-amber-100",
    shellBorder: "border-amber-500/35",
    buttonClass:
      "bg-amber-600/90 hover:bg-amber-500 text-amber-50 border border-amber-500/40",
  },
  error: {
    Icon: CircleAlert,
    headerBg: "bg-red-900/15",
    headerBorder: "border-red-900/45",
    iconClass: "text-red-400",
    titleClass: "text-red-100",
    shellBorder: "border-red-900/45",
    buttonClass:
      "bg-red-600 hover:bg-red-500 text-white border border-red-500/40",
  },
  critical: {
    Icon: Ban,
    headerBg: "bg-red-950/50",
    headerBorder: "border-red-600/45",
    iconClass: "text-red-300",
    titleClass: "text-red-50",
    shellBorder: "border-red-600/50 ring-1 ring-red-500/25",
    buttonClass:
      "bg-red-700 hover:bg-red-600 text-white border border-red-500/50",
  },
};

function AppErrorModalFrame({
  options,
  onDismiss,
}: {
  options: AppErrorOptions;
  onDismiss: () => void;
}) {
  const cfg = severityConfig[options.severity];
  const { Icon } = cfg;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-error-title"
      aria-describedby="app-error-desc"
      className="fixed inset-0 z-220 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className={`w-full max-w-md rounded-lg shadow-2xl shadow-black/60 overflow-hidden bg-[#0a0a0a] border ${cfg.shellBorder}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b ${cfg.headerBorder} ${cfg.headerBg}`}
        >
          <Icon
            className={`w-5 h-5 shrink-0 ${cfg.iconClass}`}
            aria-hidden
          />
          <h2
            id="app-error-title"
            className={`text-lg font-mono font-semibold tracking-wide ${cfg.titleClass}`}
          >
            {options.title}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p
            id="app-error-desc"
            className="text-sm font-mono text-blue-100/85 leading-relaxed"
          >
            {options.message}
          </p>
          {options.detail ? (
            <pre className="text-xs font-mono text-blue-300/55 whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto rounded border border-blue-900/40 bg-black/40 p-3">
              {options.detail}
            </pre>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-blue-900/50 bg-blue-900/10 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className={`px-5 py-2 rounded font-mono text-sm transition-colors cursor-pointer ${cfg.buttonClass}`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppErrorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queue, setQueue] = useState<AppErrorOptions[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showError = useCallback((options: AppErrorOptions) => {
    setQueue((q) => [...q, options]);
  }, []);

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const active = queue[0] ?? null;

  return (
    <AppErrorContext.Provider value={{ showError }}>
      {children}
      {mounted && active
        ? createPortal(
            <AppErrorModalFrame options={active} onDismiss={dismiss} />,
            document.body,
          )
        : null}
    </AppErrorContext.Provider>
  );
}
