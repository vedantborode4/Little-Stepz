import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdjustmentInput,
  BucketMoveInput,
  LedgerRowDto,
  OpeningStockInput,
  Paginated,
  ReverseStockDocumentInput,
  StockDocumentDto,
  StockRowDto,
  StockSummaryDto,
  TransferInput,
  VariantSearchResultDto,
  VariantStockCardDto,
  WriteOffInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"
import { catalogKeys } from "../products/api"

export const inventoryKeys = {
  all: ["inventory"] as const,
  stock: (params: object) => [...inventoryKeys.all, "stock", params] as const,
  summary: () => [...inventoryKeys.all, "summary"] as const,
  ledger: (params: object) => [...inventoryKeys.all, "ledger", params] as const,
  document: (id: string) => [...inventoryKeys.all, "document", id] as const,
  card: (variantId: string) => [...inventoryKeys.all, "card", variantId] as const,
}

export const useStock = (params: object) =>
  useQuery({
    queryKey: inventoryKeys.stock(params),
    queryFn: () => getData<Paginated<StockRowDto>>("/inventory/stock", params),
    placeholderData: keepPreviousData,
  })

export const useStockSummary = () =>
  useQuery({ queryKey: inventoryKeys.summary(), queryFn: () => getData<StockSummaryDto>("/inventory/summary") })

export const useLedger = (params: object) =>
  useQuery({
    queryKey: inventoryKeys.ledger(params),
    queryFn: () => getData<Paginated<LedgerRowDto>>("/inventory/ledger", params),
    placeholderData: keepPreviousData,
  })

export const useStockDocument = (id: string) =>
  useQuery({ queryKey: inventoryKeys.document(id), queryFn: () => getData<StockDocumentDto>(`/inventory/documents/${id}`) })

export const useVariantStockCard = (variantId: string) =>
  useQuery({ queryKey: inventoryKeys.card(variantId), queryFn: () => getData<VariantStockCardDto>(`/inventory/variants/${variantId}`) })

export const searchVariants = (q: string) => getData<VariantSearchResultDto[]>("/variants/search", { q })

/** Stock changes also change product stock columns, so both caches refresh. */
function useStockMutation<TInput>(fn: (input: TInput) => Promise<StockDocumentDto>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
      queryClient.invalidateQueries({ queryKey: catalogKeys.all })
    },
  })
}

export type MovementKind = "opening" | "transfer" | "status" | "write-off" | "adjustment"

export type MovementInput = {
  opening: OpeningStockInput
  transfer: TransferInput
  status: BucketMoveInput
  "write-off": WriteOffInput
  adjustment: AdjustmentInput
}

const MOVEMENT_ENDPOINTS: Record<MovementKind, string> = {
  opening: "/inventory/opening",
  transfer: "/inventory/transfers",
  status: "/inventory/status-changes",
  "write-off": "/inventory/write-offs",
  adjustment: "/inventory/adjustments",
}

export const usePostMovement = (kind: MovementKind) =>
  useStockMutation((input: MovementInput[MovementKind]) => sendData<StockDocumentDto>("post", MOVEMENT_ENDPOINTS[kind], input))

export const useReverseDocument = () =>
  useStockMutation(({ id, input }: { id: string; input: ReverseStockDocumentInput }) =>
    sendData<StockDocumentDto>("post", `/inventory/documents/${id}/reverse`, input),
  )
