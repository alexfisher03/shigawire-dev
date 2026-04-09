"use client";

import { HelpCircle, Route } from "lucide-react";

interface HeaderProps {
  onShowGuide?: () => void;
}

export function Header({ onShowGuide }: HeaderProps) {
  return (
    <header className="border-b border-blue-900/50 bg-black/60 sticky top-0 z-50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600/20 border border-blue-600/50 rounded">
            <Route className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-lg font-mono font-semibold text-blue-200 tracking-wide">
              Shigawire Dev
            </h1>
            <p className="text-xs font-mono text-blue-400/70">
              HTTP(S) Recording & Replay
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {onShowGuide && (
            <button
              type="button"
              onClick={onShowGuide}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-blue-300 hover:bg-blue-600/10 transition-colors cursor-pointer"
              title="Quick start guide"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
