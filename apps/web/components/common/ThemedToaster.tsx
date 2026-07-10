"use client"

import { Toaster } from "sonner"
import { useTheme } from "next-themes"

/** Toaster that follows the active theme (next-themes is class-based, so pass the resolved theme explicitly). */
export default function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      richColors
      duration={2500}
      visibleToasts={1}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  )
}
