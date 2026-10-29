import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BulkPriceApplyInput,
  BulkPricePreviewInput,
  BulkPricePreviewRowDto,
  CreateProductInput,
  CreateSupplierInput,
  MappingRowDto,
  NamedEntityDto,
  NamedEntityInput,
  Paginated,
  PriceChangeDto,
  PriceTiersInput,
  ProductDetailDto,
  ProductListItemDto,
  SetMappingInput,
  SupplierDto,
  UpdateNamedEntityInput,
  UpdateProductInput,
  UpdateVariantInput,
  VariantInput,
} from "@repo/crm-schema"
import { getData, sendData } from "@/lib/api-client"

export type NamedKind = "categories" | "brands"

export const catalogKeys = {
  all: ["catalog"] as const,
  named: (kind: NamedKind, includeInactive: boolean) => [...catalogKeys.all, kind, { includeInactive }] as const,
  suppliers: (params: object) => [...catalogKeys.all, "suppliers", params] as const,
  products: (params: object) => [...catalogKeys.all, "products", params] as const,
  product: (id: string) => [...catalogKeys.all, "product", id] as const,
  priceHistory: (variantId: string) => [...catalogKeys.all, "price-history", variantId] as const,
  mapping: (params: object) => [...catalogKeys.all, "mapping", params] as const,
}

/** Any catalog write can change lists, details and lookups, so they refresh together. */
function useCatalogMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.all }) })
}

// ─── Categories, brands, suppliers ───────────────────────────────────────────

export const useNamedList = (kind: NamedKind, includeInactive = false, enabled = true) =>
  useQuery({
    queryKey: catalogKeys.named(kind, includeInactive),
    queryFn: () => getData<NamedEntityDto[]>(`/${kind}`, { includeInactive }),
    enabled,
  })

export const useSaveNamed = (kind: NamedKind) =>
  useCatalogMutation(({ id, input }: { id?: string; input: NamedEntityInput | UpdateNamedEntityInput }) =>
    id ? sendData<NamedEntityDto>("patch", `/${kind}/${id}`, input) : sendData<NamedEntityDto>("post", `/${kind}`, input),
  )

export const useSuppliers = (params: object = { limit: 100 }, enabled = true) =>
  useQuery({
    queryKey: catalogKeys.suppliers(params),
    queryFn: () => getData<Paginated<SupplierDto>>("/suppliers", params),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useCreateSupplier = () =>
  useCatalogMutation((input: CreateSupplierInput) => sendData<SupplierDto>("post", "/suppliers", input))

// ─── Products & variants ─────────────────────────────────────────────────────

export const useProducts = (params: object) =>
  useQuery({
    queryKey: catalogKeys.products(params),
    queryFn: () => getData<Paginated<ProductListItemDto>>("/products", params),
    placeholderData: keepPreviousData,
  })

export const useProduct = (id: string | null) =>
  useQuery({ queryKey: catalogKeys.product(id ?? ""), queryFn: () => getData<ProductDetailDto>(`/products/${id}`), enabled: !!id })

export const useCreateProduct = () =>
  useCatalogMutation((input: CreateProductInput) => sendData<ProductDetailDto>("post", "/products", input))

export const useUpdateProduct = (id: string) =>
  useCatalogMutation((input: UpdateProductInput) => sendData<ProductDetailDto>("patch", `/products/${id}`, input))

export const useAddVariant = (productId: string) =>
  useCatalogMutation((input: VariantInput) => sendData<ProductDetailDto>("post", `/products/${productId}/variants`, input))

export const useUpdateVariant = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpdateVariantInput }) =>
    sendData<ProductDetailDto>("patch", `/variants/${id}`, input),
  )

export const useSetPriceTiers = () =>
  useCatalogMutation(({ id, input }: { id: string; input: PriceTiersInput }) =>
    sendData<ProductDetailDto>("put", `/variants/${id}/tiers`, input),
  )

export const usePriceHistory = (variantId: string) =>
  useQuery({
    queryKey: catalogKeys.priceHistory(variantId),
    queryFn: () => getData<PriceChangeDto[]>(`/variants/${variantId}/price-history`),
  })

// ─── Bulk pricing & website mapping ──────────────────────────────────────────

export const previewBulkPrice = (input: BulkPricePreviewInput) => sendData<BulkPricePreviewRowDto[]>("post", "/pricing/bulk/preview", input)

export const useApplyBulkPrice = () =>
  useCatalogMutation((input: BulkPriceApplyInput) => sendData<{ batchId: string; updated: number }>("post", "/pricing/bulk/apply", input))

export const useMappings = (params: object) =>
  useQuery({
    queryKey: catalogKeys.mapping(params),
    queryFn: () => getData<Paginated<MappingRowDto>>("/website-mapping", params),
    placeholderData: keepPreviousData,
  })

export const useSetMapping = () =>
  useCatalogMutation(({ variantId, input }: { variantId: string; input: SetMappingInput }) =>
    sendData<MappingRowDto>("put", `/variants/${variantId}/mapping`, input),
  )
