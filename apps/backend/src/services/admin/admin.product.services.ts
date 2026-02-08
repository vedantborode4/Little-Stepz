import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";

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
  variants: {
    select: { id: true, name: true, price: true, stock: true },
  },
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;


export async function createProductService(data: {
  name: string;
  slug: string;
  description?: string;
  price: number;
  quantity?: number;
  inStock?: boolean;
  categoryId: string;
}) {
  if (!data.slug?.trim()) {
    throw new ApiError(400, "Slug is required");
  }

  const existing = await prisma.product.findFirst({
    where: {
      slug: data.slug,
      deletedAt: null,
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
    price: number;
    quantity: number;
    inStock: boolean;
    categoryId: string;
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

  if (data.slug && data.slug !== product.slug) {
    const existing = await prisma.product.findFirst({
      where: {
        slug: data.slug,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ApiError(409, "Slug already in use");
    }
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    select: baseProductSelect,
  });

  // Recompute inStock if quantity changes and product has no variants
  if (
    data.quantity !== undefined &&
    (await prisma.variant.count({ where: { productId: id } })) === 0
  ) {
    await prisma.product.update({
      where: { id },
      data: { inStock: updated.quantity > 0 },
    });
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
