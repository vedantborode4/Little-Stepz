import { api } from "../api/client";
import type { PaginatedProducts, Product } from "../../types/product";

const SORT_MAP: Record<string, string> = {
  price_asc: "price:asc",
  price_desc: "price:desc",
  newest: "createdAt:desc",
  oldest: "createdAt:asc",
  name_asc: "name:asc",
  name_desc: "name:desc",
};

export interface GetProductsParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: string;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  preOrder?: boolean;
}

export const ProductService = {
  getProducts: async (params?: GetProductsParams): Promise<PaginatedProducts> => {
    if (params?.search) {
      const res = await api.get("/products/search", {
        params: { q: params.search, limit: params.limit || 12 },
      });
      const products = res.data.data.products as Product[];
      return {
        data: products,
        meta: { total: products.length, page: 1, limit: products.length, totalPages: 1 },
      };
    }

    const backendParams: Record<string, any> = {
      page: params?.page,
      limit: params?.limit,
    };
    if (params?.sort) backendParams.sort = SORT_MAP[params.sort] ?? params.sort;
    if (params?.priceMin !== undefined) backendParams.minPrice = params.priceMin;
    if (params?.priceMax !== undefined) backendParams.maxPrice = params.priceMax;
    if (params?.category) backendParams.category = params.category;
    if (params?.inStockOnly) backendParams.inStock = true;
    if (params?.preOrder) backendParams.preOrder = true;

    const res = await api.get("/products", { params: backendParams });
    return {
      data: res.data.data.products,
      meta: {
        total: res.data.data.total,
        page: res.data.data.page,
        limit: res.data.data.limit,
        totalPages: res.data.data.pages,
      },
    };
  },

  getByCategorySlug: async (
    slug: string,
    page = 1,
    limit = 12,
    sort?: string
  ): Promise<PaginatedProducts> => {
    const res = await api.get(`/products/category/${slug}`, {
      params: { page, limit, sort: sort ? SORT_MAP[sort] ?? sort : undefined },
    });
    return {
      data: res.data.data.products,
      meta: {
        total: res.data.data.total,
        page: res.data.data.page,
        limit: res.data.data.limit,
        totalPages: res.data.data.pages,
      },
    };
  },

  getBySlug: async (slug: string): Promise<Product> => {
    const res = await api.get(`/products/${slug}`);
    return res.data.data;
  },
};

export interface SearchSuggestion {
  name: string;
  slug: string;
  category: string | null;
}

export const SearchService = {
  // Backend returns product suggestions as objects { name, slug, category }.
  getSuggestions: async (query: string): Promise<SearchSuggestion[]> => {
    if (!query) return [];
    const { data } = await api.get("/products/search/suggestions", {
      params: { q: query },
    });
    return (data?.data?.suggestions ?? []) as SearchSuggestion[];
  },
};
