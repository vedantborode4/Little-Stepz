"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import clsx from "clsx"

/**
 * Light/dark toggle. Renders a stable placeholder until mounted so server and
 * client markup match (theme isn't known during SSR). Flips between light and
 * dark explicitly — the "system" default still applies on first visit.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={clsx(
        "p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-colors",
        className
      )}
    >
      {/* Keep a fixed icon until mounted to avoid a hydration mismatch flash. */}
      {mounted && isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
