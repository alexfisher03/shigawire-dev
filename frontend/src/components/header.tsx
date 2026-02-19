"use client";

import { Route } from "lucide-react";

export function Header() {
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
              HTTP Recording & Replay
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4"></div>
      </div>
    </header>
  );
}
