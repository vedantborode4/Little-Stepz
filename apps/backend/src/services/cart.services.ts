import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import type {
  AddCartItemBody,
  UpdateCartItemBody,
  RemoveCartItemBody,
} from "@repo/zod-schema/index";

type CartIdentifier = { type: "user" | "session"; id: string };

const MAX_ITEMS_PER_CART = 50;
const MAX_QUANTITY_PER_ITEM = 10;

const isPrismaUniqueViolation = (err: any): boolean => {
  return err.code === "P2002";
};

const getBaseWhere = (identifier: CartIdentifier) => ({
  ...(identifier.type === "user"
    ? { userId: identifier.id, sessionId: null }
    : { sessionId: identifier.id, userId: null }),
  deletedAt: null,
});

export async function getCartService(identifier: CartIdentifier) {
  const items = await prisma.cartItem.findMany({
    where: getBaseWhere(identifier),
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: { take: 1, select: { url: true } },
          deletedAt: true,
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          price: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const validItems = items.filter(
    (item) =>
      !item.product.deletedAt &&
      (!item.variantId || !item.variant?.deletedAt)
  );

  let subtotal = 0;
  const enhancedItems = validItems.map((item) => {
    const price = item.variant?.price ?? item.product.price;
    subtotal += item.quantity * Number(price);
    return {
      ...item,
      subtotal: item.quantity * Number(price),
    };
  });

  return {
    items: enhancedItems,
    subtotal,
    totalItems: validItems.length,
  };
}

async function addOrUpdateCartItem(
  tx: any,
  identifier: CartIdentifier,
  productId: string,
  variantId: string | undefined,
  quantity: number,
  isAdd: boolean = true,
  clampOnExceed: boolean = false
) {
  const product = await tx.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: {
      variants: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  if (!product) throw new ApiError(404, "Product not found");

  const activeVariantsCount = product.variants.length;
  if (!variantId && activeVariantsCount > 0)
    throw new ApiError(400, "Variant required for this product");

  let stock = product.quantity;

  if (variantId) {
    const variant = await tx.variant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
    });
    if (!variant) throw new ApiError(404, "Variant not found");
    stock = variant.stock;
  }

  if (stock === 0) throw new ApiError(400, "Out of stock");

  const uniqueKey = {
    userId: identifier.type === "user" ? identifier.id : null,
    sessionId: identifier.type === "session" ? identifier.id : null,
    productId,
    variantId,
  };

  const existing = await tx.cartItem.findFirst({
    where: { ...uniqueKey, deletedAt: null },
  });

  let newQuantity = existing && isAdd ? existing.quantity + quantity : quantity;

  if (newQuantity <= 0) throw new ApiError(400, "Invalid quantity");

  const maxQuantity = Math.min(MAX_QUANTITY_PER_ITEM, stock);
  if (newQuantity > maxQuantity) {
    if (clampOnExceed) {
      newQuantity = maxQuantity;
    } else {
      throw new ApiError(400, `Quantity exceeds limit (${maxQuantity})`);
    }
  }

  if (!existing) {
    const currentCount = await tx.cartItem.count({
      where: {
        deletedAt: null,
        ...(identifier.type === "user"
          ? { userId: identifier.id }
          : { sessionId: identifier.id }),
      },
    });

    if (currentCount >= MAX_ITEMS_PER_CART)
      throw new ApiError(400, "Cart is full");
  }

  if (existing) {
    await tx.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });
  } else {
    await tx.cartItem.create({
      data: {
        ...uniqueKey,
        quantity: newQuantity,
      },
    });
  }
}

export async function addCartItemService(
  identifier: CartIdentifier,
  data: AddCartItemBody
) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      await prisma.$transaction(async (tx) => {
        await addOrUpdateCartItem(
          tx,
          identifier,
          data.productId,
          data.variantId,
          data.quantity,
          true,
          false
        );
      });
      return;
    } catch (err: any) {
      if (isPrismaUniqueViolation(err)) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new ApiError(
            500,
            "Failed to add item due to concurrency issue"
          );
        }
        await new Promise((r) =>
          setTimeout(r, Math.random() * 100 + 50)
        );
      } else {
        throw err;
      }
    }
  }
}

export async function updateCartItemService(
  identifier: CartIdentifier,
  data: UpdateCartItemBody
) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirstOrThrow({
      where: { id: data.productId, deletedAt: null },
    });

    let stock = product.quantity;

    if (data.variantId) {
      const variant = await tx.variant.findFirstOrThrow({
        where: {
          id: data.variantId,
          productId: data.productId,
          deletedAt: null,
        },
      });
      stock = variant.stock;
    }

    const uniqueKey = {
      userId: identifier.type === "user" ? identifier.id : null,
      sessionId: identifier.type === "session" ? identifier.id : null,
      productId: data.productId,
      variantId: data.variantId,
    };

    const existing = await tx.cartItem.findFirst({
      where: { ...uniqueKey, deletedAt: null },
    });

    if (!existing) throw new ApiError(404, "Cart item not found");

    if (data.quantity === 0) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      return;
    }

    const maxQuantity = Math.min(MAX_QUANTITY_PER_ITEM, stock);
    const newQuantity = Math.min(data.quantity, maxQuantity);

    await tx.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });
  });
}

export async function removeCartItemService(
  identifier: CartIdentifier,
  data: RemoveCartItemBody
) {
  await prisma.cartItem.updateMany({
    where: {
      userId: identifier.type === "user" ? identifier.id : null,
      sessionId: identifier.type === "session" ? identifier.id : null,
      productId: data.productId,
      variantId: data.variantId,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
}

export async function clearCartService(identifier: CartIdentifier) {
  await prisma.cartItem.updateMany({
    where: getBaseWhere(identifier),
    data: { deletedAt: new Date() },
  });
}

export async function syncCartService(userId: string, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    const guestItems = await tx.cartItem.findMany({
      where: { sessionId, deletedAt: null },
      include: {
        product: true,
        variant: true,
      },
    });

    const validGuestItems = guestItems.filter(
      (item) =>
        !item.product.deletedAt &&
        (!item.variantId || !item.variant?.deletedAt)
    );

    const userIdentifier: CartIdentifier = { type: "user", id: userId };

    for (const item of validGuestItems) {
      try {
        await addOrUpdateCartItem(
          tx,
          userIdentifier,
          item.productId,
          item.variantId ?? undefined, // ✅ FIX HERE
          item.quantity,
          true,
          true
        );
      } catch (err: any) {
        console.error(
          `Failed to sync cart item ${item.id}: ${err.message}`
        );
      }
    }

    await tx.cartItem.updateMany({
      where: { sessionId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  });
}