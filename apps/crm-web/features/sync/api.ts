import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Paginated, SyncRunDto, SyncStatusDto } from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"

export const syncKeys = {
  all: ["sync"] as const,
  status: () => [...syncKeys.all, "status"] as const,
  runs: (params: object) => [...syncKeys.all, "runs", params] as const,
}

export const useSyncStatus = () => useQuery({ queryKey: syncKeys.status(), queryFn: () => getData<SyncStatusDto>("/sync/status") })

export const useSyncRuns = (params: object) =>
  useQuery({ queryKey: syncKeys.runs(params), queryFn: () => getData<Paginated<SyncRunDto>>("/sync/runs", params) })

export const useDryRun = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => sendData<SyncRunDto>("post", "/sync/dry-run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: syncKeys.all }),
  })
}

/** Linking writes website ids onto products, so catalogue caches refresh too. */
export const useLinkIds = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dryRunId: string) => sendData<SyncRunDto>("post", "/sync/link-ids", { dryRunId }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
