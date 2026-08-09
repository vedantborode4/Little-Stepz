/** Minimal className joiner (NativeWind-friendly; avoids tailwind-merge web deps). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
