import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CommissionDetailDto,
  CommissionPayoutInput,
  CommissionSummaryDto,
  CreateSalespersonInput,
  ExpenseDto,
  MyCommissionDto,
  SalesOrderDetailDto,
  SalespersonDto,
  SalespersonPickDto,
  UpdateSalespersonInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { financeKeys } from "../finance/api"
import { paymentKeys } from "../payments/api"
import { salesKeys } from "../sales/api"

export const commissionKeys = {
  all: ["commission"] as const,
  options: () => [...commissionKeys.all, "options"] as const,
  salespeople: (includeInactive: boolean) => [...commissionKeys.all, "salespeople", includeInactive] as const,
  summary: (params: object) => [...commissionKeys.all, "summary", params] as const,
  detail: (id: string, params: object) => [...commissionKeys.all, "detail", id, params] as const,
  mine: (params: object) => [...commissionKeys.all, "mine", params] as const,
  payouts: (params: object) => [...commissionKeys.all, "payouts", params] as const,
}

/** The checkout picker: active salespeople, names and staff IDs only. */
export const useSalespersonOptions = (enabled = true) =>
  useQuery({ queryKey: commissionKeys.options(), queryFn: () => getData<SalespersonPickDto[]>("/salespeople/options"), enabled })

export const useSalespeople = (includeInactive = true) =>
  useQuery({
    queryKey: commissionKeys.salespeople(includeInactive),
    queryFn: () => getData<SalespersonDto[]>("/salespeople", { includeInactive }),
  })

export const useCommissionSummary = (params: { from: string; to: string }) =>
  useQuery({ queryKey: commissionKeys.summary(params), queryFn: () => getData<CommissionSummaryDto>("/commission", params) })

export const useCommissionDetail = (id: string | null, params: { from: string; to: string }) =>
  useQuery({
    queryKey: commissionKeys.detail(id ?? "", params),
    queryFn: () => getData<CommissionDetailDto>(`/commission/salespeople/${id}`, params),
    enabled: Boolean(id),
  })

/** The signed-in user's own commission, through the salesperson linked to their login. */
export const useMyCommission = (params: { from: string; to: string }) =>
  useQuery({ queryKey: commissionKeys.mine(params), queryFn: () => getData<MyCommissionDto>("/commission/me", params) })

export const useCommissionPayouts = (params: { from: string; to: string }) =>
  useQuery({ queryKey: commissionKeys.payouts(params), queryFn: () => getData<ExpenseDto[]>("/commission/payouts", params) })

export function useSaveSalesperson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreateSalespersonInput | UpdateSalespersonInput }) =>
      id ? sendData<SalespersonDto>("patch", `/salespeople/${id}`, input) : sendData<SalespersonDto>("post", "/salespeople", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commissionKeys.all }),
  })
}

/** A payout is an expense paid from an account, so expenses and cash figures refresh too. */
export function useRecordPayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CommissionPayoutInput) => sendData<ExpenseDto>("post", "/commission/payouts", input),
    onSuccess: () => {
      for (const key of [commissionKeys.all, financeKeys.all, paymentKeys.all]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useSetOrderSalesperson(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (salespersonId: string | null) =>
      sendData<SalesOrderDetailDto>("put", `/sales/${orderId}/salesperson`, { salespersonId: salespersonId ?? "" }),
    onSuccess: () => {
      for (const key of [salesKeys.all, commissionKeys.all]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
