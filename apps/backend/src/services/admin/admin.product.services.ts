import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { notifyRestockedPreOrders } from "../preorder.services";
import { deriveInStock } from "../../utils/inventory";

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

  const product = await prisma.product.create({
    data: {
      ...data,
      quantity: data.quantity ?? 0,
      inStock: data.inStock ?? (data.quantity ?? 0) > 0,
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

  const activeVariantsCount = await prisma.variant.count({
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
    updateData.inStock = await deriveInStock(prisma, id);
  } else if (data.quantity !== undefined) {
    updateData.inStock = data.quantity > 0;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
    select: baseProductSelect,
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
