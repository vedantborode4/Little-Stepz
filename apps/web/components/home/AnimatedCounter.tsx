"use client"

import { useEffect, useRef, useState } from "react"

/** Splits "500+", "2025", "100%" into a leading prefix, an integer, and a trailing suffix. */
function parseValue(value: string) {
  const match = value.match(/^(\D*)(\d[\d,]*)(.*)$/)
  if (!match) return { prefix: "", num: 0, suffix: value }
  return {
    prefix: match[1] ?? "",
    num: Number((match[2] ?? "0").replace(/,/g, "")),
    suffix: match[3] ?? "",
  }
}

interface Props {
  value: string
  className?: string
  duration?: number
}

/** Counts up from 0 to the target the first time it scrolls into view. */
export default function AnimatedCounter({ value, className, duration = 1400 }: Props) {
  const { prefix, num, suffix } = parseValue(value)
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const run = () => {
      if (started.current) return
      started.current = true
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
        setDisplay(Math.round(eased * num))
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    // Respect reduced-motion — show the final value immediately.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(num)
      started.current = true
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run()
          obs.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [num, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}{display}{suffix}
    </span>
  )
}
