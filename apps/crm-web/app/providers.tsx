"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, useTheme } from "next-themes"
import { useState } from "react"
import { Toaster } from "sonner"
import { isApiError } from "@/lib/api-error"

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster richColors duration={2500} visibleToasts={1} theme={resolvedTheme === "dark" ? "dark" : "light"} />
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx answers are final; only network/5xx failures are worth retrying.
        retry: (count, err) => count < 2 && !(isApiError(err) && err.status < 500),
      },
    },
  })
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
