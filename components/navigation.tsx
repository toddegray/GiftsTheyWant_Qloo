"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Empty left side - no logo/site name */}
          <div className="flex-shrink-0">{/* Intentionally empty */}</div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="#" className="text-gray-900 hover:text-gray-600 px-3 py-2 text-sm font-medium transition-colors">
                Discover
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                How It Works
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">
                About
              </a>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-900 hover:text-gray-600 p-2">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-100">
              <a href="#" className="text-gray-900 block px-3 py-2 text-base font-medium">
                Discover
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                How It Works
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                About
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
