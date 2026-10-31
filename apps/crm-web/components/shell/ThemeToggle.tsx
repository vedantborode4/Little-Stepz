"use client"

import clsx from "clsx"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Theme is unknown during SSR; render a stable icon until mounted to avoid a mismatch.
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={clsx("p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-colors", className)}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
