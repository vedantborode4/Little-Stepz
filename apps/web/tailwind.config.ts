import path from "path"
import type { Config } from "tailwindcss"

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",

  ],
} satisfies Config
