"use client"

import { useEffect, useRef, useState } from "react"

/** Splits e.g. "500+" → { prefix:"", target:500, suffix:"+" }, "₹1,000" → { prefix:"₹", target:1000 }. */
function parse(value: string) {
  const match = value.match(/^(\D*)([\d,]*\.?\d+)(.*)$/)
  if (!match) return { prefix: "", target: 0, suffix: value, decimals: 0 }
  const prefix = match[1] ?? ""
  const numStr = (match[2] ?? "0").replace(/,/g, "")
  const suffix = match[3] ?? ""
  const dot = numStr.indexOf(".")
  const decimals = dot >= 0 ? numStr.length - dot - 1 : 0
  return { prefix, target: parseFloat(numStr), suffix, decimals }
}

export default function CountUp({
  value,
  duration = 1400,
  delay = 0,
  className,
}: {
  value: string
  duration?: number
  delay?: number
  className?: string
}) {
  const { prefix, target, suffix, decimals } = parse(value)
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    if (reduce) {
      setDisplay(target)
      return
    }

    let raf = 0
    let timer: ReturnType<typeof setTimeout>
    let started = false

    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
        setDisplay(target * eased)
        if (t < 1) raf = requestAnimationFrame(tick)
        else setDisplay(target)
      }
      raf = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started) {
          started = true
          timer = setTimeout(run, delay)
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [target, duration, delay])

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("en-IN")

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
