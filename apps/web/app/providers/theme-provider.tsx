"use client"

import { ThemeProvider as NextThemeProvider } from "next-themes"

/**
 * Class-based theme provider. Defaults to the visitor's OS preference and
 * persists a manual override (via ThemeToggle) to localStorage. `disableTransitionOnChange`
 * stops every element from animating its colours during the flip.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  )
}
