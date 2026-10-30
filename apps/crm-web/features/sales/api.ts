import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CancelOrderInput,
  Paginated,
  PosSaleInput,
  PreOrderRowDto,
  PreOrderSummaryDto,
  SaleQuoteDto,
  SaleQuoteInput,
  SalesOrderDetailDto,
  SalesOrderInput,
  SalesOrderListItemDto,
  SalesSummaryDto,
  SellableItemDto,
  WaitingItemDto,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { customerKeys } from "../customers/api"
import { inventoryKeys } from "../inventory/api"
import { paymentKeys } from "../payments/api"
import { catalogKeys } from "../products/api"

export const salesKeys = {
  all: ["sales"] as const,
  list: (params: object) => [...salesKeys.all, "list", params] as const,
  detail: (id: string) => [...salesKeys.all, "detail", id] as const,
  summary: (params: object) => [...salesKeys.all, "summary", params] as const,
  preOrders: (params: object) => [...salesKeys.all, "pre-orders", params] as const,
  preOrderSummary: () => [...salesKeys.all, "pre-order-summary"] as const,
  waiting: () => [...salesKeys.all, "waiting"] as const,
}

export const usePreOrders = (params: object) =>
  useQuery({
    queryKey: salesKeys.preOrders(params),
    queryFn: () => getData<Paginated<PreOrderRowDto>>("/pre-orders", params),
    placeholderData: keepPreviousData,
  })

export const usePreOrderSummary = (enabled = true) =>
  useQuery({ queryKey: salesKeys.preOrderSummary(), queryFn: () => getData<PreOrderSummaryDto>("/pre-orders/summary"), enabled })

export const useWaitingItems = () =>
  useQuery({ queryKey: salesKeys.waiting(), queryFn: () => getData<WaitingItemDto[]>("/pre-orders/waiting") })

export const useOrders = (params: object, enabled = true) =>
  useQuery({
    queryKey: salesKeys.list(params),
    queryFn: () => getData<Paginated<SalesOrderListItemDto>>("/sales", params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useOrder = (id: string) =>
  useQuery({ queryKey: salesKeys.detail(id), queryFn: () => getData<SalesOrderDetailDto>(`/sales/${id}`) })

export const useSalesSummary = (params: { from: string; to: string }, enabled = true) =>
  useQuery({ queryKey: salesKeys.summary(params), queryFn: () => getData<SalesSummaryDto>("/sales/summary", params), enabled })

export const searchSellable = (q: string, locationId: string) => getData<SellableItemDto[]>("/sales/items", { q, locationId })
export const quoteSale = (input: SaleQuoteInput) => sendData<SaleQuoteDto>("post", "/sales/quote", input)

/** Sales move stock and customer totals, so those caches refresh as well. */
function useSalesMutation<TInput>(fn: (input: TInput) => Promise<SalesOrderDetailDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [salesKeys.all, inventoryKeys.all, catalogKeys.all, customerKeys.all, paymentKeys.all])
        queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const usePosSale = () => useSalesMutation((input: PosSaleInput) => sendData<SalesOrderDetailDto>("post", "/sales/pos", input))
export const useSaveOrder = () =>
  useSalesMutation(({ id, input }: { id?: string; input: SalesOrderInput }) =>
    id ? sendData<SalesOrderDetailDto>("put", `/sales/${id}`, input) : sendData<SalesOrderDetailDto>("post", "/sales", input),
  )

export type OrderAction = "confirm" | "pack" | "fulfil" | "deliver" | "allocate"
export const useOrderAction = (id: string) =>
  useSalesMutation((action: OrderAction) => sendData<SalesOrderDetailDto>("post", `/sales/${id}/${action}`))
export const useCancelOrder = (id: string) =>
  useSalesMutation((input: CancelOrderInput) => sendData<SalesOrderDetailDto>("post", `/sales/${id}/cancel`, input))

export const useDeallocate = (id: string) =>
  useSalesMutation((reason: string) => sendData<SalesOrderDetailDto>("post", `/sales/${id}/deallocate`, { reason }))
export const useExpectedArrival = (id: string) =>
  useSalesMutation((expectedArrival: string | null) =>
    sendData<SalesOrderDetailDto>("put", `/sales/${id}/expected-arrival`, { expectedArrival }),
  )

export function useAllocateAvailable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variantId?: string) =>
      sendData<{ allocated: string[]; skipped: string[] }>("post", "/pre-orders/allocate-available", { variantId }),
    onSuccess: () => {
      for (const key of [salesKeys.all, inventoryKeys.all, catalogKeys.all]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
