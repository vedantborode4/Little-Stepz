import { prisma, Prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import type { ViralReelBody } from "@repo/zod-schema/index";

const adminReelSelect = {
  id: true,
  reelUrl: true,
  coverImageUrl: true,
  caption: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  products: {
    where: { product: { deletedAt: null } },
    orderBy: { sortOrder: "asc" },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: { select: { isActive: true } },
          images: {
            where: { variantId: null, deletedAt: null },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ViralReelSelect;

type AdminReelRow = Prisma.ViralReelGetPayload<{ select: typeof adminReelSelect }>;

function toAdminReel({ products, ...reel }: AdminReelRow) {
  return {
    ...reel,
    products: products.map(({ product }) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      /** False when the product's category is switched off — the store skips it. */
      visible: product.category.isActive,
    })),
  };
}

async function assertProductsExist(tx: Prisma.TransactionClient, productIds: string[]) {
  const found = await tx.product.count({
    where: { id: { in: productIds }, deletedAt: null },
  });
  if (found !== productIds.length) {
    throw new ApiError(400, "One or more linked products no longer exist");
  }
}

function productLinks(productIds: string[]) {
  return productIds.map((productId, sortOrder) => ({ productId, sortOrder }));
}

async function findReelOrThrow(tx: Prisma.TransactionClient, id: string) {
  const reel = await tx.viralReel.findFirst({ where: { id, deletedAt: null }, select: { id: true, isActive: true } });
  if (!reel) throw new ApiError(404, "Reel not found");
  return reel;
}

export async function adminListViralReelsService() {
  const reels = await prisma.viralReel.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: adminReelSelect,
  });
  return { reels: reels.map(toAdminReel) };
}

export async function adminCreateViralReelService(adminUserId: string, data: ViralReelBody) {
  return prisma.$transaction(async (tx) => {
    await assertProductsExist(tx, data.productIds);

    const reel = await tx.viralReel.create({
      data: {
        reelUrl: data.reelUrl,
        coverImageUrl: data.coverImageUrl,
        caption: data.caption || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        createdBy: adminUserId,
        products: { create: productLinks(data.productIds) },
      },
      select: adminReelSelect,
    });
    return toAdminReel(reel);
  });
}

export async function adminUpdateViralReelService(adminUserId: string, id: string, data: ViralReelBody) {
  return prisma.$transaction(async (tx) => {
    await findReelOrThrow(tx, id);
    await assertProductsExist(tx, data.productIds);

    await tx.viralReelProduct.deleteMany({ where: { reelId: id } });
    const reel = await tx.viralReel.update({
      where: { id },
      data: {
        reelUrl: data.reelUrl,
        coverImageUrl: data.coverImageUrl,
        caption: data.caption || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        updatedBy: adminUserId,
        products: { create: productLinks(data.productIds) },
      },
      select: adminReelSelect,
    });
    return toAdminReel(reel);
  });
}

export async function adminToggleViralReelService(adminUserId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await findReelOrThrow(tx, id);
    const updated = await tx.viralReel.update({
      where: { id },
      data: { isActive: !existing.isActive, updatedBy: adminUserId },
      select: { id: true, isActive: true },
    });
    return updated;
  });
}

export async function adminDeleteViralReelService(adminUserId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await findReelOrThrow(tx, id);
    await tx.viralReel.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedBy: adminUserId },
    });
    return { deleted: true, id };
  });
}
