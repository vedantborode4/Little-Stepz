import { Request, Response } from "express";
import { asyncHandler, ApiError, ApiResponse } from "../utils/api";
import {
  getProductsService,
  getProductBySlugService,
  searchProductsService,
  getSearchSuggestionsService,
  getProductsByCategorySlugService,
} from "../services/product.services";

import {
  searchQuerySchema,
  slugSchema,
  paginationSchema,
} from "@repo/zod-schema/index";

import { sanitizeString } from "../utils/sanitize";

// GET /products
async function getProducts(req: Request, res: Response) {
  const { page = 1, limit = 20 } = paginationSchema.parse(req.query);

  const safeLimit = Math.min(limit, 100);
  const sort = sanitizeString((req.query.sort as string) || "createdAt:desc");
  const inStock = req.query.inStock ? req.query.inStock === "true" : undefined;

  let minPrice: number | undefined;
  if (req.query.minPrice !== undefined) {
    const parsed = Number(req.query.minPrice);
    if (isNaN(parsed)) throw new ApiError(400, "Invalid minPrice");
    minPrice = parsed;
  }

  let maxPrice: number | undefined;
  if (req.query.maxPrice !== undefined) {
    const parsed = Number(req.query.maxPrice);
    if (isNaN(parsed)) throw new ApiError(400, "Invalid maxPrice");
    maxPrice = parsed;
  }

  const result = await getProductsService({
    page,
    limit: safeLimit,
    sort,
    inStock,
    minPrice,
    maxPrice,
  });

  return new ApiResponse(200, result, "Products fetched").send(res);
}

// GET /products/:slug
async function getProductBySlug(req: Request, res: Response) {
  const slug = slugSchema.parse(req.params.slug);
  const result = await getProductBySlugService(slug);
  return new ApiResponse(200, result, "Product fetched").send(res);
}

// GET /products/search
async function searchProducts(req: Request, res: Response) {
  const { q } = searchQuerySchema.parse(req.query);
  const limit = Number(req.query.limit) || 20;

  const result = await searchProductsService(sanitizeString(q), limit);
  return new ApiResponse(200, result, "Search results").send(res);
}

// GET /products/search/suggestions
async function getSearchSuggestions(req: Request, res: Response) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success || !parsed.data.q) {
    return new ApiResponse(200, { suggestions: [] }).send(res);
  }

  const result = await getSearchSuggestionsService(
    sanitizeString(parsed.data.q)
  );

  return new ApiResponse(200, result, "Suggestions").send(res);
}

// GET /products/category/:categorySlug
async function getProductsByCategorySlug(req: Request, res: Response) {
  const categorySlug = slugSchema.parse(req.params.categorySlug);
  const { page, limit } = paginationSchema.parse(req.query);
  const sort = sanitizeString((req.query.sort as string) || "createdAt:desc");

  const result = await getProductsByCategorySlugService(
    categorySlug,
    page,
    limit,
    sort
  );

  return new ApiResponse(200, result, "Category products fetched").send(res);
}

export const getProductsController = asyncHandler(getProducts);
export const getProductBySlugController = asyncHandler(getProductBySlug);
export const searchProductsController = asyncHandler(searchProducts);
export const getSearchSuggestionsController = asyncHandler(getSearchSuggestions);
export const getProductsByCategorySlugController = asyncHandler(getProductsByCategorySlug);
