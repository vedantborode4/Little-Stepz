import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AccountTransferDto,
  AccountTransferInput,
  ApplyCreditInput,
  CollectionsDto,
  CustomerCreditDto,
  OutstandingRowDto,
  OutstandingSummaryDto,
  Paginated,
  PaymentDetailDto,
  PaymentListItemDto,
  ReceivePaymentInput,
  RefundCreditInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { customerKeys } from "../customers/api"
import { salesKeys } from "../sales/api"

export const paymentKeys = {
  all: ["payments"] as const,
  list: (params: object) => [...paymentKeys.all, "list", params] as const,
  detail: (id: string) => [...paymentKeys.all, "detail", id] as const,
  collections: (params: object) => [...paymentKeys.all, "collections", params] as const,
  outstanding: (params: object) => [...paymentKeys.all, "outstanding", params] as const,
  outstandingSummary: (params: object) => [...paymentKeys.all, "outstanding-summary", params] as const,
  transfers: (params: object) => [...paymentKeys.all, "transfers", params] as const,
  credit: (customerId: string) => [...paymentKeys.all, "credit", customerId] as const,
}

export const usePayments = (params: object) =>
  useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: () => getData<Paginated<PaymentListItemDto>>("/payments", params),
    placeholderData: keepPreviousData,
  })

export const usePayment = (id: string | null) =>
  useQuery({ queryKey: paymentKeys.detail(id ?? ""), queryFn: () => getData<PaymentDetailDto>(`/payments/${id}`), enabled: Boolean(id) })

export const useCollections = (params: { from: string; to: string }) =>
  useQuery({ queryKey: paymentKeys.collections(params), queryFn: () => getData<CollectionsDto>("/payments/collections", params) })

export const useOutstanding = (params: object, enabled = true) =>
  useQuery({
    queryKey: paymentKeys.outstanding(params),
    queryFn: () => getData<Paginated<OutstandingRowDto>>("/payments/outstanding", params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useOutstandingSummary = (params: { customerId?: string }) =>
  useQuery({
    queryKey: paymentKeys.outstandingSummary(params),
    queryFn: () => getData<OutstandingSummaryDto>("/payments/outstanding/summary", params),
  })

export const useTransfers = (params: object) =>
  useQuery({
    queryKey: paymentKeys.transfers(params),
    queryFn: () => getData<Paginated<AccountTransferDto>>("/payments/transfers", params),
    placeholderData: keepPreviousData,
  })

export const useCustomerCredit = (customerId: string | null | undefined) =>
  useQuery({
    queryKey: paymentKeys.credit(customerId ?? ""),
    queryFn: () => getData<CustomerCreditDto>(`/payments/credit/${customerId}`),
    enabled: Boolean(customerId),
  })

/** Money changes order balances and customer totals, so those caches refresh too. */
function usePaymentMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [paymentKeys.all, salesKeys.all, customerKeys.all]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export const useReceivePayment = () =>
  usePaymentMutation((input: ReceivePaymentInput) => sendData<PaymentDetailDto>("post", "/payments", input))
export const useVoidPayment = (id: string) =>
  usePaymentMutation((reason: string) => sendData<PaymentDetailDto>("post", `/payments/${id}/void`, { reason }))
export const useApplyCredit = (customerId: string) =>
  usePaymentMutation((input: ApplyCreditInput) => sendData<CustomerCreditDto>("post", `/payments/credit/${customerId}/apply`, input))
export const useRefundCredit = (customerId: string) =>
  usePaymentMutation((input: RefundCreditInput) => sendData<CustomerCreditDto>("post", `/payments/credit/${customerId}/refund`, input))
export const useCreateTransfer = () =>
  usePaymentMutation((input: AccountTransferInput) => sendData<AccountTransferDto>("post", "/payments/transfers", input))
export const useReverseTransfer = (id: string) =>
  usePaymentMutation((reason: string) => sendData<AccountTransferDto>("post", `/payments/transfers/${id}/reverse`, { reason }))
