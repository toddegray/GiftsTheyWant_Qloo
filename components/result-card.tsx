"use client"

import { Loader2 } from "lucide-react"

interface ResultCardProps {
  title: string
  subtitle: string
  content: string
  isLoading?: boolean
}

export function ResultCard({ title, subtitle, content, isLoading }: ResultCardProps) {
  return (
    <div className="group">
      <div className="bg-white border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg">
        <div className="p-8">
          <div className="mb-6">
            <h3 className="text-2xl font-light text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 uppercase tracking-wide">{subtitle}</p>
          </div>

          <div className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="bg-gray-50 p-6 min-h-[200px]">
                <pre className="text-sm text-gray-700 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                  {content || "Awaiting analysis..."}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
