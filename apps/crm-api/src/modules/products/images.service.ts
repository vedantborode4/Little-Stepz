import { prisma, type ProductImage, type ProductImageSource, type Tx } from "@repo/crm-db/client";
import {
  MAX_PRODUCT_IMAGES,
  type ProductImageDto,
  type ProductImageLinkInput,
  type ProductImageOrderInput,
  type ProductImageUpdateInput,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { deleteUploadedImage, imageMimeOf, uploadImage } from "../../core/cloudinary";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";

export const toProductImageDto = (i: ProductImage): ProductImageDto => ({
  id: i.id,
  url: i.url,
  variantId: i.variantId,
  source: i.source,
  position: i.position,
});

const gallery = async (db: Tx | typeof prisma, productId: string) =>
  (await db.productImage.findMany({ where: { productId }, orderBy: { position: "asc" } })).map(toProductImageDto);

export const listProductImages = (productId: string) => gallery(prisma, productId);

/** Row-locks the product so concurrent photo changes can't hand out the same position. */
async function lockProduct(tx: Tx, productId: string) {
  const [product] = await tx.$queryRaw<{ id: string; code: string }[]>`SELECT id, code FROM "Product" WHERE id = ${productId} FOR UPDATE`;
  if (!product) throw notFound("Product");
  return product;
}

async function assertVariantOf(tx: Tx | typeof prisma, productId: string, variantId: string | null | undefined) {
  if (!variantId) return;
  const variant = await tx.variant.findUnique({ where: { id: variantId }, select: { productId: true } });
  if (variant?.productId !== productId) {
    throw new ApiError(400, "INVALID_VARIANT", "That variant isn't part of this product", {
      fieldErrors: { variantId: ["Choose a variant of this product"] },
    });
  }
}

/** The first photo is the main one; lists, POS and stock read it from Product.imageUrl. */
async function syncMainImage(tx: Tx, productId: string) {
  const first = await tx.productImage.findFirst({ where: { productId }, orderBy: { position: "asc" }, select: { url: true } });
  await tx.product.update({ where: { id: productId }, data: { imageUrl: first?.url ?? null } });
}

async function assertRoom(db: Tx | typeof prisma, productId: string) {
  if ((await db.productImage.count({ where: { productId } })) >= MAX_PRODUCT_IMAGES) {
    throw new ApiError(409, "TOO_MANY_PHOTOS", `A product can have up to ${MAX_PRODUCT_IMAGES} photos. Remove one first.`);
  }
}

async function addImage(
  productId: string,
  image: { url: string; publicId: string | null; source: ProductImageSource; variantId: string | null },
  ctx: RequestContext,
) {
  return withTransaction(async (tx) => {
    await lockProduct(tx, productId);
    await assertVariantOf(tx, productId, image.variantId);
    await assertRoom(tx, productId);
    const position = await tx.productImage.count({ where: { productId } });
    const created = await tx.productImage.create({ data: { ...image, productId, position, createdById: ctx.userId } });
    if (position === 0) await syncMainImage(tx, productId);
    await recordAudit(tx, ctx, {
      action: "product.photo_added",
      entity: "Product",
      entityId: productId,
      after: { url: created.url, source: created.source, variantId: created.variantId },
    });
    return gallery(tx, productId);
  });
}

export async function uploadProductImage(productId: string, file: Buffer, variantId: string | null | undefined, ctx: RequestContext) {
  const mime = imageMimeOf(file);
  if (!mime) throw new ApiError(400, "IMAGE_INVALID", "Upload a JPG, PNG or WebP photo");
  // Checked before uploading so a doomed request never leaves a file behind.
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { code: true } });
  if (!product) throw notFound("Product");
  await assertVariantOf(prisma, productId, variantId);
  await assertRoom(prisma, productId);

  const uploaded = await uploadImage(file, mime, `products/${product.code}`);
  try {
    return await addImage(productId, { ...uploaded, source: "UPLOAD", variantId: variantId ?? null }, ctx);
  } catch (err) {
    await deleteUploadedImage(uploaded.publicId);
    throw err;
  }
}

export const linkProductImage = (productId: string, input: ProductImageLinkInput, ctx: RequestContext) =>
  addImage(productId, { url: input.url, publicId: null, source: "LINK", variantId: input.variantId ?? null }, ctx);

async function findImage(tx: Tx, productId: string, imageId: string) {
  const image = await tx.productImage.findUnique({ where: { id: imageId } });
  if (image?.productId !== productId) throw notFound("Photo");
  return image;
}

export async function updateProductImage(productId: string, imageId: string, input: ProductImageUpdateInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await lockProduct(tx, productId);
    const before = await findImage(tx, productId, imageId);
    await assertVariantOf(tx, productId, input.variantId);
    await tx.productImage.update({ where: { id: imageId }, data: { variantId: input.variantId ?? null } });
    await recordAudit(tx, ctx, {
      action: "product.photo_updated",
      entity: "Product",
      entityId: productId,
      before: { url: before.url, variantId: before.variantId },
      after: { url: before.url, variantId: input.variantId ?? null },
    });
    return gallery(tx, productId);
  });
}

export async function reorderProductImages(productId: string, input: ProductImageOrderInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await lockProduct(tx, productId);
    const current = await tx.productImage.findMany({ where: { productId }, orderBy: { position: "asc" }, select: { id: true } });
    const ids = new Set(input.imageIds);
    if (ids.size !== input.imageIds.length || ids.size !== current.length || current.some((i) => !ids.has(i.id))) {
      throw new ApiError(409, "PHOTOS_CHANGED", "The photos changed while you were arranging them. Reload and try again.");
    }
    for (const [position, id] of input.imageIds.entries()) await tx.productImage.update({ where: { id }, data: { position } });
    await syncMainImage(tx, productId);
    await recordAudit(tx, ctx, {
      action: "product.photos_reordered",
      entity: "Product",
      entityId: productId,
      before: { order: current.map((i) => i.id) },
      after: { order: input.imageIds },
    });
    return gallery(tx, productId);
  });
}

export async function removeProductImage(productId: string, imageId: string, ctx: RequestContext) {
  const { result, removed } = await withTransaction(async (tx) => {
    await lockProduct(tx, productId);
    const image = await findImage(tx, productId, imageId);
    await tx.productImage.delete({ where: { id: imageId } });
    await tx.productImage.updateMany({ where: { productId, position: { gt: image.position } }, data: { position: { decrement: 1 } } });
    await syncMainImage(tx, productId);
    await recordAudit(tx, ctx, {
      action: "product.photo_removed",
      entity: "Product",
      entityId: productId,
      before: { url: image.url, source: image.source, variantId: image.variantId },
    });
    return { result: await gallery(tx, productId), removed: image };
  });
  // Linked photos (website, supplier) belong to someone else and are only unlinked.
  if (removed.source === "UPLOAD" && removed.publicId) await deleteUploadedImage(removed.publicId);
  return result;
}
