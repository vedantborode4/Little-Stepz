"use client"

import { useEffect, useRef, useState } from "react"

const SESSION_KEY = "ls:seen-loader"
const DURATION = 1500 // ms — simulated load time (within the 1.2–1.8s target)
const FADE = 320 // ms — opacity transition before unmount

export default function LoadingScreen() {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Decide whether to show — but DON'T persist "seen" yet. Marking it seen on
    // start (instead of on completion) is what breaks under React StrictMode's
    // double-invoke: the second setup would early-return and never reschedule
    // the dismissal the first cleanup just cancelled, leaving the overlay stuck.
    let seen = true
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      // storage blocked (private mode) — treat as seen so we never gate the page
    }
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (seen || reduced) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1")
      } catch {}
      return
    }

    setVisible(true)
    setFading(false)
    setProgress(0)

    // rAF only drives the smooth 0→100 number. It can be throttled or cancelled,
    // so it must NEVER be the thing that dismisses the overlay.
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1)
      setProgress((1 - Math.pow(1 - t, 3)) * 100) // easeOutCubic
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // Guaranteed dismissal via plain timers — fires regardless of rAF state.
    const doneTimer = setTimeout(() => {
      setProgress(100)
      setFading(true)
    }, DURATION)
    const unmountTimer = setTimeout(() => {
      setVisible(false)
      try {
        sessionStorage.setItem(SESSION_KEY, "1") // persist only once it's actually done
      } catch {}
    }, DURATION + FADE)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      clearTimeout(doneTimer)
      clearTimeout(unmountTimer)
    }
  }, [])

  // Server render and first client render both return null (visible starts false),
  // so there's no hydration mismatch.
  if (!visible) return null

  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img
        src="/logo.webp"
        alt="Little Stepz"
        className="mb-8 h-16 w-auto select-none"
        draggable={false}
      />
      <div className="h-2 w-[220px] overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="mt-3 text-sm text-muted tabular-nums">
        {Math.round(progress)}%
      </span>
    </div>
  )
}
