"use client"

import { useEffect } from "react"

/**
 * Prevents mouse-wheel scrolling from changing the value of a focused
 * <input type="number">. We blur the input when the wheel scrolls over it,
 * so the page still scrolls but the number stays put.
 */
export default function NumberInputWheelGuard() {
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const el = document.activeElement
      if (
        el instanceof HTMLInputElement &&
        el.type === "number" &&
        e.target === el
      ) {
        el.blur()
      }
    }
    document.addEventListener("wheel", handler, { passive: true })
    return () => document.removeEventListener("wheel", handler)
  }, [])

  return null
}
