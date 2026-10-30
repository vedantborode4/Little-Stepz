import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApproveStockCountInput,
  CreateStockCountInput,
  Paginated,
  SaveCountsInput,
  StockCountDetailDto,
  StockCountListItemDto,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { inventoryKeys } from "../inventory/api"
import { catalogKeys } from "../products/api"

export const countKeys = {
  all: ["stock-counts"] as const,
  list: (params: object) => [...countKeys.all, "list", params] as const,
  detail: (id: string) => [...countKeys.all, "detail", id] as const,
}

export const useStockCounts = (params: object) =>
  useQuery({
    queryKey: countKeys.list(params),
    queryFn: () => getData<Paginated<StockCountListItemDto>>("/stock-counts", params),
    placeholderData: keepPreviousData,
  })

export const useStockCount = (id: string) =>
  useQuery({ queryKey: countKeys.detail(id), queryFn: () => getData<StockCountDetailDto>(`/stock-counts/${id}`) })

/** Approving or reversing moves stock, so stock and product caches refresh too. */
function useCountMutation<TInput>(fn: (input: TInput) => Promise<StockCountDetailDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [countKeys.all, inventoryKeys.all, catalogKeys.all]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useCreateStockCount = () =>
  useCountMutation((input: CreateStockCountInput) => sendData<StockCountDetailDto>("post", "/stock-counts", input))
export const useSaveCounts = (id: string) =>
  useCountMutation((input: SaveCountsInput) => sendData<StockCountDetailDto>("put", `/stock-counts/${id}/counts`, input))
export const useAddCountLine = (id: string) =>
  useCountMutation((variantId: string) => sendData<StockCountDetailDto>("post", `/stock-counts/${id}/lines`, { variantId }))
export type CountAction = "submit" | "cancel" | "send-back" | "reverse"
export const useCountAction = (id: string) =>
  useCountMutation(({ action, reason }: { action: CountAction; reason?: string }) =>
    sendData<StockCountDetailDto>("post", `/stock-counts/${id}/${action}`, reason ? { reason } : undefined),
  )
export const useApproveCount = (id: string) =>
  useCountMutation((input: ApproveStockCountInput) => sendData<StockCountDetailDto>("post", `/stock-counts/${id}/approve`, input))
