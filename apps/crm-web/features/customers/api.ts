import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CreateCustomerInput,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerListItemDto,
  DuplicateCheckQuery,
  DuplicateMatchDto,
  DuplicatePairDto,
  MergeCustomerInput,
  Paginated,
  UpdateCustomerInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"

export const customerKeys = {
  all: ["customers"] as const,
  list: (params: object) => [...customerKeys.all, "list", params] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
  duplicates: (params: object) => [...customerKeys.all, "duplicates", params] as const,
  pairs: () => [...customerKeys.all, "pairs"] as const,
}

export const useCustomers = (params: object, enabled = true) =>
  useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => getData<Paginated<CustomerListItemDto>>("/customers", params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useCustomer = (id: string | null | undefined) =>
  useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => getData<CustomerDetailDto>(`/customers/${id}`),
    enabled: Boolean(id),
  })

export const useDuplicateCheck = (params: DuplicateCheckQuery, enabled: boolean) =>
  useQuery({
    queryKey: customerKeys.duplicates(params),
    queryFn: () => getData<DuplicateMatchDto[]>("/customers/duplicates/check", params),
    enabled,
    staleTime: 10_000,
  })

export const useDuplicatePairs = () =>
  useQuery({ queryKey: customerKeys.pairs(), queryFn: () => getData<DuplicatePairDto[]>("/customers/duplicates") })

/** Audited on the server: every call records who looked at the full contact. */
export const revealContact = (id: string) => sendData<CustomerContactDto>("post", `/customers/${id}/contact`)

function useCustomerMutation<TInput>(fn: (input: TInput) => Promise<CustomerDetailDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export const useSaveCustomer = () =>
  useCustomerMutation(({ id, input }: { id?: string; input: CreateCustomerInput | UpdateCustomerInput }) =>
    id ? sendData<CustomerDetailDto>("patch", `/customers/${id}`, input) : sendData<CustomerDetailDto>("post", "/customers", input),
  )

export const useMergeCustomer = (id: string) =>
  useCustomerMutation((input: MergeCustomerInput) => sendData<CustomerDetailDto>("post", `/customers/${id}/merge`, input))

export const useSetCustomerPrice = (id: string) =>
  useCustomerMutation(({ variantId, price }: { variantId: string; price: string }) =>
    sendData<CustomerDetailDto>("put", `/customers/${id}/prices/${variantId}`, { price }),
  )

export const useRemoveCustomerPrice = (id: string) =>
  useCustomerMutation((variantId: string) => sendData<CustomerDetailDto>("delete", `/customers/${id}/prices/${variantId}`))
