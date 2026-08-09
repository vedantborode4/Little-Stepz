import { useInfiniteQuery } from "@tanstack/react-query";
import { ProductService, type GetProductsParams } from "../lib/services/product.service";
import { qk } from "../lib/api/query-client";

const LIMIT = 12;

export function useProducts(params: Omit<GetProductsParams, "page" | "limit">) {
  return useInfiniteQuery({
    queryKey: qk.products(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      ProductService.getProducts({ ...params, page: pageParam, limit: LIMIT }),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
}

export function useCategoryProducts(slug: string, sort?: string) {
  return useInfiniteQuery({
    queryKey: qk.productsByCategory(slug, { sort }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      ProductService.getByCategorySlug(slug, pageParam, LIMIT, sort),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
}
