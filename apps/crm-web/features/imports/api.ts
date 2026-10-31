import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ImportBatchDto,
  ImportBatchListItemDto,
  ImportKind,
  ImportMappingInput,
  ImportRowDto,
  ImportTemplateDto,
  Paginated,
} from "@repo/crm-schema"
import { api, getData, sendData } from "@/lib/api-client"

export const importKeys = {
  all: ["imports"] as const,
  list: (params: object) => [...importKeys.all, "list", params] as const,
  detail: (id: string) => [...importKeys.all, "detail", id] as const,
  rows: (id: string, params: object) => [...importKeys.all, "rows", id, params] as const,
  templates: (kind: ImportKind) => [...importKeys.all, "templates", kind] as const,
}

export const useImports = (params: object) =>
  useQuery({
    queryKey: importKeys.list(params),
    queryFn: () => getData<Paginated<ImportBatchListItemDto>>("/imports", params),
    placeholderData: keepPreviousData,
  })

export const useImport = (id: string) =>
  useQuery({ queryKey: importKeys.detail(id), queryFn: () => getData<ImportBatchDto>(`/imports/${id}`) })

export const useImportRows = (id: string, params: object, enabled = true) =>
  useQuery({
    queryKey: importKeys.rows(id, params),
    queryFn: () => getData<Paginated<ImportRowDto>>(`/imports/${id}/rows`, params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useImportTemplates = (kind: ImportKind) =>
  useQuery({ queryKey: importKeys.templates(kind), queryFn: () => getData<ImportTemplateDto[]>("/imports/templates", { kind }) })

/** Approval and rollback create or undo records anywhere in the CRM, so every cache is refreshed. */
function useImportMutation<TInput>(fn: (input: TInput) => Promise<ImportBatchDto>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries() })
}

export interface UploadInput {
  kind: ImportKind
  file: File
  /** Which worksheet of an Excel file; the server asks when there are several. */
  sheet?: string
  /** The row with the column headings; found automatically when left out. */
  headerRow?: number
}

/** The file goes up as the raw request body; the server reads .csv and .xlsx. */
export const useUploadImport = () =>
  useImportMutation(async ({ kind, file, sheet, headerRow }: UploadInput) => {
    const res = await api.post<{ data: ImportBatchDto }>("/imports", file, {
      params: { kind, fileName: file.name, sheet, headerRow },
      headers: { "Content-Type": "application/octet-stream" },
    })
    return res.data.data
  })

export const useMapImport = (id: string) =>
  useImportMutation((input: ImportMappingInput) => sendData<ImportBatchDto>("put", `/imports/${id}/mapping`, input))

export type ImportAction = "approve" | "rollback" | "cancel"
export const useImportAction = (id: string) =>
  useImportMutation(({ action, reason }: { action: ImportAction; reason?: string }) =>
    sendData<ImportBatchDto>("post", `/imports/${id}/${action}`, reason ? { reason } : undefined),
  )
