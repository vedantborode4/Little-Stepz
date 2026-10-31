import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CreateReturnInput,
  Paginated,
  ReturnPreviewDto,
  ReturnPreviewInput,
  SalesReturnDto,
  SalesReturnListItemDto,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { customerKeys } from "../customers/api"
import { inventoryKeys } from "../inventory/api"
import { paymentKeys } from "../payments/api"
import { catalogKeys } from "../products/api"
import { salesKeys } from "../sales/api"

export const returnKeys = {
  all: ["returns"] as const,
  list: (params: object) => [...returnKeys.all, "list", params] as const,
  detail: (id: string) => [...returnKeys.all, "detail", id] as const,
}

export const useReturns = (params: object) =>
  useQuery({
    queryKey: returnKeys.list(params),
    queryFn: () => getData<Paginated<SalesReturnListItemDto>>("/returns", params),
    placeholderData: keepPreviousData,
  })

export const useReturn = (id: string | null) =>
  useQuery({ queryKey: returnKeys.detail(id ?? ""), queryFn: () => getData<SalesReturnDto>(`/returns/${id}`), enabled: Boolean(id) })

export const previewReturn = (orderId: string, input: ReturnPreviewInput) =>
  sendData<ReturnPreviewDto>("post", `/sales/${orderId}/returns/preview`, input)

/** A return moves stock and money and changes the order, so all of those caches refresh. */
export function useCreateReturn(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReturnInput) => sendData<SalesReturnDto>("post", `/sales/${orderId}/returns`, input),
    onSuccess: () => {
      for (const key of [returnKeys.all, salesKeys.all, paymentKeys.all, inventoryKeys.all, catalogKeys.all, customerKeys.all]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
