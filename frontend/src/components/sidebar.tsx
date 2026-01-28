'use client'

import React from "react"

import { Archive, Home, Settings } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-blue-900/50 bg-black/60 flex flex-col h-full backdrop-blur-sm">
      <nav className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1">
          <NavItem icon={<Home className="w-4 h-4" />} label="Sessions" active />
          <NavItem icon={<Archive className="w-4 h-4" />} label="Archived" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Configuration" />
        </div>
        {/* TODO:Projects for multiple services monitoring */}
        <div className="px-4 py-6">
          <h3 className="text-xs font-mono font-semibold text-blue-400/70 uppercase tracking-wider mb-3">
            Projects
          </h3>
          <div className="space-y-2">
            {['Project 001', 'Project 002', 'Project 003'].map((project) => (
              <div
                key={project}
                className="px-3 py-2 rounded text-sm cursor-pointer hover:bg-blue-600/10 border border-transparent hover:border-blue-900/50 transition-colors text-blue-300/70 hover:text-blue-200 font-mono"
              >
                {project}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 border-t border-blue-900/50 text-xs space-y-1 font-mono">
          <div className="text-blue-400/70">
            <span className="font-semibold text-blue-300">Status:</span> Connected
          </div>
          {/* <div className="text-blue-400/70">
            <span className="font-semibold text-blue-300">Requests:</span> 247
          </div>
          <div className="text-blue-400/70">
            <span className="font-semibold text-blue-300">Redacted:</span> 12
          </div> */}
        </div>
      </nav>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-mono transition-colors ${
        active
          ? 'bg-blue-600/20 border border-blue-600/50 text-blue-200'
          : 'text-blue-400/70 hover:bg-blue-600/10 border border-transparent hover:border-blue-900/50 hover:text-blue-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
