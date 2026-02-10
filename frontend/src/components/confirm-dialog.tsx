'use client'

import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
    title: string
    message: string
    confirmLabel?: string
    onConfirm: () => void
    onCancel: () => void
    loading?: boolean
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, loading }: ConfirmDialogProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-blue-900/50 rounded-lg shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-blue-900/50 bg-red-900/10">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <h2 className="text-lg font-mono font-semibold text-red-200 tracking-wide">
                        {title}
                    </h2>
                </div>

                <div className="px-6 py-6">
                    <p className="text-sm font-mono text-blue-300/80 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-blue-900/50 bg-blue-900/10 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 border border-blue-900/50 hover:bg-blue-600/10 text-blue-300 rounded font-mono text-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-mono text-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {loading ? 'Deleting...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
