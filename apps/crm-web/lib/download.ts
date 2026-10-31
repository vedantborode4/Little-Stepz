import type { ExportFormat } from "@repo/crm-schema"
import { api } from "./api-client"

/** Downloads a server-generated export for the current filters (not just the visible page). */
export async function downloadExport(path: string, params: object, format: ExportFormat) {
  const res = await api.get<Blob>(path, { params: { ...params, page: 1, format }, responseType: "blob" })
  const disposition = String(res.headers["content-disposition"] ?? "")
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `export.${format}`

  const url = URL.createObjectURL(res.data)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
