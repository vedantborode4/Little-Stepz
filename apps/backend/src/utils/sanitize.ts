export function sanitizeString(str?: string) {
  if (!str) return "";
  return str.replace(/[^a-zA-Z0-9-_: ]/g, "").trim();
}
