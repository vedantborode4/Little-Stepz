import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdjustmentInput,
  BucketMoveInput,
  LandedCostEntryDto,
  LedgerRowDto,
  OpeningStockInput,
  Paginated,
  ReverseStockDocumentInput,
  SetLandedCostInput,
  SetLandedCostPreviewDto,
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

/** What a landed cost would change; the API works it out and saves nothing. */
export const useLandedCostPreview = (variantId: string, unitCost: string | null) =>
  useQuery({
    queryKey: [...inventoryKeys.all, "landed-cost-preview", variantId, unitCost] as const,
    queryFn: () => sendData<SetLandedCostPreviewDto>("post", `/inventory/variants/${variantId}/landed-cost/preview`, { unitCost }),
    enabled: unitCost !== null,
    retry: false,
    gcTime: 0,
  })

/** A new cost re-values stock and can re-cost past sales, profit and commission, so every cached screen refreshes. */
export function useSetLandedCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: SetLandedCostInput }) =>
      sendData<LandedCostEntryDto>("post", `/inventory/variants/${variantId}/landed-cost`, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
