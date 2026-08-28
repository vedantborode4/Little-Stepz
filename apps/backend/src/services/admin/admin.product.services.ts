import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { notifyRestockedPreOrders } from "../preorder.services";
import { deriveInStock } from "../../utils/stock";

const baseProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  longDescription: true,
  price: true,
  salePrice: true,
  costPrice: true,
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
      id: true, name: true, sku: true, sortOrder: true, isDefault: true,
      price: true, salePrice: true, isOnSale: true, stock: true,
      // Per-variant pre-order terms, so the admin editor round-trips them.
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
  deletedAt: true,
} as const;


export async function createProductService(data: {
  name: string;
  slug: string;
  description?: string;
  longDescription?: string;
  price: number;
  salePrice?: number;
  costPrice?: number;
  isOnSale?: boolean;
  priceDisplay?: "BOTH" | "REGULAR" | "SALE";
  quantity?: number;
  inStock?: boolean;
  categoryId: string;
  specifications?: { label: string; value: string }[];
  preOrderEnabled?: boolean;
  bookingAmount?: number;
  preOrderLimit?: number;
  preOrderNote?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  noindex?: boolean;
  brand?: string;
  gtin?: string;
  mpn?: string;
  condition?: string;
}) {
  if (!data.slug?.trim()) {
    throw new ApiError(400, "Slug is required");
  }

  const existing = await prisma.product.findFirst({
    where: {
      slug: data.slug,
    },
  });

  if (existing) {
    throw new ApiError(409, "Slug already in use");
  }

  // Availability is derived from quantity, never taken from the form's checkbox.
  // `data.inStock ?? …` honoured the checkbox whenever it was sent — and the admin
  // form always sends it, defaulting to true — so a product created with
  // `quantity: 0` was born `inStock: true` and stayed that way. The storefront then
  // advertised it as available with Add to Cart enabled, and the add failed
  // server-side with STOCK_INSUFFICIENT. This is the same rule updateProductService
  // already applies; it was simply missing here.
  //
  // A product cannot have variants at creation time, so quantity is the whole story.
  const quantity = data.quantity ?? 0;

  const product = await prisma.product.create({
    data: {
      ...data,
      quantity,
      inStock: quantity > 0,
    },
    select: baseProductSelect,
  });

  return product;
}


export async function updateProductService(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string | null;
    longDescription: string | null;
    price: number;
    salePrice: number | null;
    costPrice: number | null;
    isOnSale: boolean;
    priceDisplay: "BOTH" | "REGULAR" | "SALE";
    quantity: number;
    inStock: boolean;
    categoryId: string;
    specifications: { label: string; value: string }[];
    preOrderEnabled: boolean;
    bookingAmount: number | null;
    preOrderLimit: number | null;
    preOrderNote: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    noindex: boolean;
    brand: string | null;
    gtin: string | null;
    mpn: string | null;
    condition: string | null;
  }>
) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (data.slug !== undefined) {
    if (!data.slug.trim()) {
      throw new ApiError(400, "Slug cannot be empty");
    }

    const existing = await prisma.product.findFirst({
      where: {
        slug: data.slug,
        NOT: { id },
      },
    });

    if (existing) {
      throw new ApiError(409, "Slug already in use");
    }
  }

  // Read-derive-write in ONE transaction. These were three separate queries, so a
  // concurrent order (or variant edit) landing between the derivation and the write
  // was overwritten by an already-stale `inStock` — leaving a sold-out product
  // advertised as available, or a restocked one unbuyable.
  const updated = await prisma.$transaction(async (tx) => {
    const activeVariantsCount = await tx.variant.count({
      where: {
        productId: id,
        deletedAt: null,
      },
    });

    const updateData: typeof data & { inStock?: boolean } = { ...data };

    if (activeVariantsCount > 0) {
      // Variant product: availability is derived from the variants, never the
      // form's inStock/quantity input — otherwise the flag drifts out of sync.
      // Uses the same shared derivation as the variant services.
      updateData.inStock = await deriveInStock(tx, id);
    } else if (data.quantity !== undefined) {
      updateData.inStock = data.quantity > 0;
    }

    return tx.product.update({
      where: { id },
      data: updateData,
      select: baseProductSelect,
    });
  });

  // Restock event: product went from unavailable -> available. Notify product-level pre-orders.
  if (product.quantity <= 0 && updated.quantity > 0) {
    void notifyRestockedPreOrders(id, null);
  }

  return updated;
}


export async function deleteProductService(id: string) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  await prisma.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function getProductByIdService(id: string) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: baseProductSelect,
  });

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return product;
}
