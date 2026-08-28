import { prisma, Prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { withPublicSalePricing } from "../utils/pricing";

type ProductSortField = "createdAt" | "price" | "name" | "updatedAt";
type SortOrder = "asc" | "desc";

const allowedSortFields: ProductSortField[] = [
  "createdAt",
  "price",
  "name",
  "updatedAt",
];

// "price" from a client means the price the customer actually pays, so it sorts on the
// effectivePrice column (salePrice when on sale, else price) — never the struck-through
// regular price. That column is maintained by a Postgres trigger; see its migration.
const sortColumn: Record<ProductSortField, string> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  name: "name",
  price: "effectivePrice",
};

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
  longDescription: true,
  price: true,
  salePrice: true,
  isOnSale: true,
  priceDisplay: true,
  quantity: true,
  inStock: true,
  specifications: true,
  preOrderEnabled: true,
  bookingAmount: true,
  preOrderLimit: true,
  preOrderCount: true,
  preOrderNote: true,
  // SEO overrides + merchant identity — drive metadata, sitemap and Product JSON-LD.
  metaTitle: true,
  metaDescription: true,
  ogImage: true,
  noindex: true,
  brand: true,
  gtin: true,
  mpn: true,
  condition: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    where: { variantId: null, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, url: true, alt: true, sortOrder: true },
  },
  options: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, sortOrder: true,
      values: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, value: true, swatchHex: true, sortOrder: true },
      },
    },
  },
  variants: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, price: true, salePrice: true, isOnSale: true, stock: true,
      // Per-variant pre-order terms, so the storefront can show the right booking
      // amount per chip and hide variants that are opted out.
      preOrderEnabled: true, bookingAmount: true, preOrderLimit: true, preOrderCount: true,
      optionValues: { select: { optionValueId: true } },
      images: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, sortOrder: true },
      },
    },
  },
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
  preOrder,
}: {
  page?: number;
  limit?: number;
  sort?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: string;
  preOrder?: boolean;
}) {
  const skip = (page - 1) * limit;

  // "bestselling" ranks by how many times a product has been ordered (order-item rows),
  // falling back to newest. Everything else uses the standard field sort.
  //
  // Every sort ends with `id` as a tiebreaker: without one, rows with equal values come
  // back in an arbitrary order per query, so paging through them with skip/take repeats
  // some products and silently drops others.
  const isBestSelling = sort.startsWith("bestselling");
  const orderBy: any = isBestSelling
    ? [{ orderItems: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }]
    : (() => {
        const { field, order } = parseSort(sort);
        return [{ [sortColumn[field]]: order }, { id: "asc" }];
      })();

  const where: any = {
    deletedAt: null,
    // Products of a deactivated category are hidden from the storefront.
    category: { isActive: true },
  };

  if (preOrder !== undefined) {
    where.preOrderEnabled = preOrder;
    // A product is only "actively" on pre-order once it's genuinely out of stock.
    // Derive availability from the variants themselves (a variant product is in
    // stock if ANY active variant has stock) rather than the denormalized
    // `inStock` flag, which can drift out of sync.
    if (preOrder) {
      where.AND = [
        // No active variant currently has stock (trivially true for products
        // that have no variants at all).
        { variants: { none: { deletedAt: null, stock: { gt: 0 } } } },
        // Either it's a variant product (variants exist, all sold out) or a
        // simple product whose own quantity has run out.
        {
          OR: [
            { variants: { some: { deletedAt: null } } },
            { quantity: { lte: 0 } },
          ],
        },
      ];
    }
  }

  if (inStock !== undefined) where.inStock = inStock;
  if (categoryId) where.categoryId = categoryId;

  // Range filters match on what the customer actually pays, so a product discounted
  // into the range isn't hidden by its higher regular price (and vice versa).
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.effectivePrice = {};
    if (minPrice !== undefined) where.effectivePrice.gte = minPrice;
    if (maxPrice !== undefined) where.effectivePrice.lte = maxPrice;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: baseProductSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(withPublicSalePricing),
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
      category: { isActive: true },
    },
    select: baseProductSelect,
  });

  if (!product) throw new ApiError(404, "Product not found");
  return withPublicSalePricing(product);
}

// ── Search helpers ───────────────────────────────────────────────────────────

/** Split a query into up to 10 lowercase word tokens. */
function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** A token matches if it appears in any searchable field (name, descriptions, slug, category). */
function tokenFieldOr(token: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { name: { contains: token, mode: "insensitive" } },
      { description: { contains: token, mode: "insensitive" } },
      { longDescription: { contains: token, mode: "insensitive" } },
      { slug: { contains: token, mode: "insensitive" } },
      { category: { name: { contains: token, mode: "insensitive" } } },
    ],
  };
}

type Scorable = {
  name: string;
  description: string | null;
  inStock: boolean | null;
  category: { name: string } | null;
};

/**
 * Relevance score — name matches rank highest (exact > prefix > contains), then
 * category, then description; every matched token adds weight and in-stock is boosted.
 * This is what makes results feel "best match first" instead of alphabetical.
 */
function relevanceScore(p: Scorable, qLower: string, tokens: string[]): number {
  const name = p.name.toLowerCase();
  const cat = (p.category?.name ?? "").toLowerCase();
  const desc = (p.description ?? "").toLowerCase();

  let score = 0;
  if (name === qLower) score += 120;
  else if (name.startsWith(qLower)) score += 70;
  else if (name.includes(qLower)) score += 45;

  if (cat.includes(qLower)) score += 14;

  for (const t of tokens) {
    if (name.startsWith(t)) score += 8;
    if (name.includes(t)) score += 12;
    if (cat.includes(t)) score += 6;
    if (desc.includes(t)) score += 3;
  }

  if (p.inStock) score += 6;
  return score;
}

// Light projection used to rank candidates without loading heavy fields
// (longDescription / variants / images) for the whole pool.
const searchCandidateSelect = {
  id: true,
  name: true,
  description: true,
  inStock: true,
  createdAt: true,
  category: { select: { name: true } },
} as const;

// Search products — multi-token matching + relevance ranking (two-phase: rank light, hydrate winners)
export async function searchProductsService(q: string, limit = 20) {
  const query = q.trim();
  if (!query) return { products: [] };

  const tokens = tokenize(query);
  const qLower = query.toLowerCase();
  const poolSize = Math.min(Math.max(limit * 4, 40), 100);

  // Strict: every token must appear somewhere.
  let candidates = await prisma.product.findMany({
    where: { deletedAt: null, category: { isActive: true }, AND: tokens.map(tokenFieldOr) },
    take: poolSize,
    select: searchCandidateSelect,
  });

  // Relaxed fallback: any token matches — rescues multi-word queries where one word is off.
  if (candidates.length === 0 && tokens.length > 1) {
    candidates = await prisma.product.findMany({
      where: { deletedAt: null, category: { isActive: true }, OR: tokens.map(tokenFieldOr) },
      take: poolSize,
      select: searchCandidateSelect,
    });
  }

  const topIds = candidates
    .map((p) => ({ id: p.id, score: relevanceScore(p, qLower, tokens), createdAt: p.createdAt }))
    .sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((x) => x.id);

  if (topIds.length === 0) return { products: [] };

  // Hydrate full product data only for the winners, then restore ranked order.
  const full = await prisma.product.findMany({
    where: { id: { in: topIds } },
    select: baseProductSelect,
  });
  const byId = new Map(full.map((p) => [p.id, p]));

  const products = topIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map(withPublicSalePricing);

  return { products };
}

// Search suggestions — same ranking, lightweight payload for the typeahead dropdown
export async function getSearchSuggestionsService(q: string) {
  const query = q.trim();
  if (!query) return { suggestions: [] };

  const tokens = tokenize(query);
  const qLower = query.toLowerCase();

  const candidates = await prisma.product.findMany({
    where: { deletedAt: null, category: { isActive: true }, AND: tokens.map(tokenFieldOr) },
    take: 30,
    select: {
      name: true,
      slug: true,
      inStock: true,
      description: true,
      createdAt: true,
      category: { select: { name: true } },
    },
  });

  const suggestions = candidates
    .map((p) => ({ p, score: relevanceScore(p, qLower, tokens) }))
    .sort((a, b) => b.score - a.score || b.p.createdAt.getTime() - a.p.createdAt.getTime())
    .slice(0, 8)
    .map((x) => ({ name: x.p.name, slug: x.p.slug, category: x.p.category?.name ?? null }));

  return { suggestions };
}

// Products by category slug
export async function getProductsByCategorySlugService(
  categorySlug: string,
  page = 1,
  limit = 20,
  sort = "createdAt:desc",
  minPrice?: number,
  maxPrice?: number
) {
  const category = await prisma.category.findFirst({
    where: { slug: categorySlug, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (!category) throw new ApiError(404, "Category not found");

  return getProductsService({
    page,
    limit,
    sort,
    categoryId: category.id,
    minPrice,
    maxPrice,
  });
}
