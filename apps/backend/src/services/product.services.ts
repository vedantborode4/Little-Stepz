import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";

type ProductSortField = "createdAt" | "price" | "name" | "updatedAt";
type SortOrder = "asc" | "desc";

const allowedSortFields: ProductSortField[] = [
  "createdAt",
  "price",
  "name",
  "updatedAt",
];

function parseSort(sort: string): { field: ProductSortField; order: SortOrder } {
  const [rawField, rawOrder] = sort.split(":");

  const field = allowedSortFields.includes(rawField as ProductSortField)
    ? (rawField as ProductSortField)
    : "createdAt";

  const order: SortOrder = rawOrder === "asc" ? "asc" : "desc";

  return { field, order };
}

const baseProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  quantity: true,
  inStock: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    orderBy: { sortOrder: "asc" },
    select: { id: true, url: true, alt: true, sortOrder: true },
  },
  variants: { select: { id: true, name: true, price: true, stock: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// GET all products
export async function getProductsService({
  page = 1,
  limit = 20,
  sort = "createdAt:desc",
  inStock,
  minPrice,
  maxPrice,
  categoryId,
}: {
  page?: number;
  limit?: number;
  sort?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: string;
}) {
  const skip = (page - 1) * limit;
  const { field, order } = parseSort(sort);

  const where: any = {
    deletedAt: null
  };

  if (inStock !== undefined) where.inStock = inStock;
  if (categoryId) where.categoryId = categoryId;

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [field]: order },
      select: baseProductSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// GET single product by slug
export async function getProductBySlugService(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      deletedAt: null, 
    },
    select: baseProductSelect,
  });

  if (!product) throw new ApiError(404, "Product not found");
  return product;
}

// Search products
export async function searchProductsService(q: string, limit = 20) {
  if (!q.trim()) return { products: [] };

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    select: baseProductSelect,
  });

  return { products };
}

// Search suggestions
export async function getSearchSuggestionsService(q: string) {
  if (q.length < 1) return { suggestions: [] };

  const suggestions = await prisma.product.findMany({
    where: {
      deletedAt: null, 
      name: { startsWith: q, mode: "insensitive" },
    },
    take: 8,
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  return { suggestions };
}

// Products by category slug
export async function getProductsByCategorySlugService(
  categorySlug: string,
  page = 1,
  limit = 20,
  sort = "createdAt:desc"
) {
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });

  if (!category) throw new ApiError(404, "Category not found");

  return getProductsService({
    page,
    limit,
    sort,
    categoryId: category.id,
  });
}