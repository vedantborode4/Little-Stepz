import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CreateSupplierInput,
  LandedCostInput,
  LandedCostPreviewDto,
  LateChargeInput,
  Paginated,
  PurchaseDetailDto,
  PurchaseDraftInput,
  PurchaseListItemDto,
  PurchaseReturnInput,
  ReceivePurchaseInput,
  CreateSupplierEntryInput,
  SupplierDto,
  SupplierLedgerDto,
  SupplierLedgerEntryDto,
  UpdateSupplierInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { financeKeys } from "../finance/api"
import { inventoryKeys } from "../inventory/api"
import { catalogKeys } from "../products/api"

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: (params: object) => [...purchaseKeys.all, "list", params] as const,
  detail: (id: string) => [...purchaseKeys.all, "detail", id] as const,
  lastRate: (currency: string) => [...purchaseKeys.all, "last-rate", currency] as const,
}

export const usePurchases = (params: object) =>
  useQuery({
    queryKey: purchaseKeys.list(params),
    queryFn: () => getData<Paginated<PurchaseListItemDto>>("/purchases", params),
    placeholderData: keepPreviousData,
  })

export const usePurchase = (id: string) =>
  useQuery({ queryKey: purchaseKeys.detail(id), queryFn: () => getData<PurchaseDetailDto>(`/purchases/${id}`) })

export const useLastRate = (currency: string) =>
  useQuery({
    queryKey: purchaseKeys.lastRate(currency),
    queryFn: () => getData<{ rate: string; code: string; invoiceDate: string } | null>("/purchases/last-rate", { currency }),
    enabled: currency !== "INR",
  })

export const previewLandedCost = (input: LandedCostInput) => sendData<LandedCostPreviewDto>("post", "/purchases/preview", input)

/** Receiving, returns and late charges move stock and value, so inventory and catalog caches refresh too. */
function usePurchaseMutation<TInput>(fn: (input: TInput) => Promise<PurchaseDetailDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseKeys.all })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
      queryClient.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export const useSaveDraft = () =>
  usePurchaseMutation(({ id, input }: { id?: string; input: PurchaseDraftInput }) =>
    id ? sendData<PurchaseDetailDto>("put", `/purchases/${id}`, input) : sendData<PurchaseDetailDto>("post", "/purchases", input),
  )
export const useReceivePurchase = (id: string) =>
  usePurchaseMutation((input: ReceivePurchaseInput) => sendData<PurchaseDetailDto>("post", `/purchases/${id}/receive`, input))
export const useCancelPurchase = (id: string) => usePurchaseMutation(() => sendData<PurchaseDetailDto>("post", `/purchases/${id}/cancel`))
export const useLateCharge = (id: string) =>
  usePurchaseMutation((input: LateChargeInput) => sendData<PurchaseDetailDto>("post", `/purchases/${id}/late-charges`, input))
export const useReturnToSupplier = (id: string) =>
  usePurchaseMutation((input: PurchaseReturnInput) => sendData<PurchaseDetailDto>("post", `/purchases/${id}/returns`, input))

export const useSaveSupplier = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreateSupplierInput | UpdateSupplierInput }) =>
      id ? sendData<SupplierDto>("patch", `/suppliers/${id}`, input) : sendData<SupplierDto>("post", "/suppliers", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

// ─── Supplier ledger ─────────────────────────────────────────────────────────

const supplierKeys = {
  detail: (id: string) => [...catalogKeys.all, "supplier", id] as const,
  ledger: (id: string, params: object) => [...catalogKeys.all, "supplier-ledger", id, params] as const,
  entry: (id: string) => [...catalogKeys.all, "supplier-entry", id] as const,
}

export const useSupplier = (id: string) =>
  useQuery({ queryKey: supplierKeys.detail(id), queryFn: () => getData<SupplierDto>(`/suppliers/${id}`) })

export const useSupplierLedger = (id: string, params: object, enabled = true) =>
  useQuery({
    queryKey: supplierKeys.ledger(id, params),
    queryFn: () => getData<SupplierLedgerDto>(`/suppliers/${id}/ledger`, params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useSupplierEntry = (id: string) =>
  useQuery({ queryKey: supplierKeys.entry(id), queryFn: () => getData<SupplierLedgerEntryDto>(`/suppliers/ledger-entries/${id}`) })

/** Payments and refunds move money through an account, so the cash day refreshes too. */
function useSupplierLedgerMutation<TInput>(fn: (input: TInput) => Promise<SupplierLedgerEntryDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export const useRecordSupplierEntry = (supplierId: string) =>
  useSupplierLedgerMutation((input: CreateSupplierEntryInput) =>
    sendData<SupplierLedgerEntryDto>("post", `/suppliers/${supplierId}/ledger`, input),
  )

export const useVoidSupplierEntry = (id: string) =>
  useSupplierLedgerMutation((reason: string) =>
    sendData<SupplierLedgerEntryDto>("post", `/suppliers/ledger-entries/${id}/void`, { reason }),
  )
