import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CashDayDto,
  CashSessionDto,
  CloseCashDayInput,
  CreateExpenseInput,
  ExpenseCategoryDto,
  ExpenseCategoryInput,
  ExpenseDto,
  OpenCashDayInput,
  Paginated,
  UpdateExpenseCategoryInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { paymentKeys } from "../payments/api"

export const financeKeys = {
  all: ["finance"] as const,
  expenses: (params: object) => [...financeKeys.all, "expenses", params] as const,
  expense: (id: string) => [...financeKeys.all, "expense", id] as const,
  categories: (includeInactive: boolean) => [...financeKeys.all, "categories", includeInactive] as const,
  day: (accountId: string, date: string) => [...financeKeys.all, "day", accountId, date] as const,
  sessions: (params: object) => [...financeKeys.all, "sessions", params] as const,
}

export const useExpenses = (params: object) =>
  useQuery({
    queryKey: financeKeys.expenses(params),
    queryFn: () => getData<Paginated<ExpenseDto>>("/expenses", params),
    placeholderData: keepPreviousData,
  })

export const useExpense = (id: string | null) =>
  useQuery({ queryKey: financeKeys.expense(id ?? ""), queryFn: () => getData<ExpenseDto>(`/expenses/${id}`), enabled: Boolean(id) })

export const useExpenseCategories = (includeInactive = false) =>
  useQuery({
    queryKey: financeKeys.categories(includeInactive),
    queryFn: () => getData<ExpenseCategoryDto[]>("/expenses/categories", { includeInactive }),
  })

export const useCashDay = (accountId: string, date: string) =>
  useQuery({
    queryKey: financeKeys.day(accountId, date),
    queryFn: () => getData<CashDayDto>("/cash/day", { accountId, date }),
    enabled: Boolean(accountId),
  })

export const useCashSessions = (params: object) =>
  useQuery({
    queryKey: financeKeys.sessions(params),
    queryFn: () => getData<Paginated<CashSessionDto>>("/cash/sessions", params),
    placeholderData: keepPreviousData,
  })

/** Expenses and cash days change account movements, so collections refresh too. */
function useFinanceMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}

export const useCreateExpense = () => useFinanceMutation((input: CreateExpenseInput) => sendData<ExpenseDto>("post", "/expenses", input))
export const useVoidExpense = (id: string) =>
  useFinanceMutation((reason: string) => sendData<ExpenseDto>("post", `/expenses/${id}/void`, { reason }))
export const useSaveExpenseCategory = () =>
  useFinanceMutation(({ id, input }: { id?: string; input: ExpenseCategoryInput | UpdateExpenseCategoryInput }) =>
    id
      ? sendData<ExpenseCategoryDto[]>("patch", `/expenses/categories/${id}`, input)
      : sendData<ExpenseCategoryDto[]>("post", "/expenses/categories", input),
  )
export const useOpenCashDay = () =>
  useFinanceMutation((input: OpenCashDayInput) => sendData<CashSessionDto>("post", "/cash/sessions", input))
export const useCloseCashDay = (id: string) =>
  useFinanceMutation((input: CloseCashDayInput) => sendData<CashSessionDto>("post", `/cash/sessions/${id}/close`, input))
export const useReopenCashDay = (id: string) =>
  useFinanceMutation((reason: string) => sendData<CashSessionDto>("post", `/cash/sessions/${id}/reopen`, { reason }))
