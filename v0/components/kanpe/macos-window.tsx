"use client"

import type { ReactNode } from "react"

interface MacOSWindowProps {
  children: ReactNode
  className?: string
  title?: string
}

export function MacOSWindow({ children, className = "", title }: MacOSWindowProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-[var(--glass-border)] bg-card overflow-hidden shadow-2xl shadow-black/50 ${className}`}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        {title && (
          <span className="flex-1 text-center text-xs text-muted-foreground font-medium">
            {title}
          </span>
        )}
        {title && <div className="w-14" />}
      </div>
      {children}
    </div>
  )
}
