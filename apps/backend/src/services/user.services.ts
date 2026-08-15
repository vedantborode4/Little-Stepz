import { prisma } from "@repo/db/client";
import { UpdatePasswordData, UpdateProfileData } from "@repo/zod-schema/index";
import { comparePassword, hashPassword } from "../utils/auth/password";
import { ApiError } from "../utils/api";

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
};

export async function getMeService(userId: string) {
  // Filters deletedAt: an access token stays valid for its full lifetime, so a
  // just-deleted account could otherwise keep reading its own profile until the
  // token expired. Refresh tokens are destroyed on deletion, so this closes the
  // remaining window.
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

export async function updateMeService(userId: string, data: UpdateProfileData) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: userSelect,
    });
  } catch (err) {
    throw new ApiError(500, "Failed to update profile");
  }
}

/**
 * Order states where something is still owed in one direction or the other — the
 * item is in transit, a return is being assessed, or money is moving. Deleting an
 * account mid-flight would orphan a live delivery or a pending refund, so these
 * block the request until they settle.
 */
const ACTIVE_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "REFUND_INITIATED",
] as const;

const ACTIVE_PREORDER_STATUSES = ["PENDING_BOOKING", "BOOKED", "AWAITING_BALANCE"] as const;

/**
 * Deletes the signed-in user's account (Google Play / App Store requirement).
 *
 * Anonymise-and-soft-delete rather than a cascading hard delete, because order,
 * invoice and payment rows must survive for Indian tax and accounting retention —
 * see the /data-deletion policy page. What actually goes is every piece of personal
 * data hanging off the profile.
 *
 * The email is rewritten rather than kept, so it is released for a fresh signup and
 * the unique index does not block the user coming back. Same for the Google/Apple
 * links, which would otherwise keep the dead row joined to those identities.
 */
export async function deleteMyAccountService(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const [activeOrders, activePreOrders, affiliate] = await Promise.all([
    prisma.order.count({
      where: { userId, deletedAt: null, status: { in: ACTIVE_ORDER_STATUSES as unknown as any } },
    }),
    prisma.preOrder.count({
      where: {
        userId,
        deletedAt: null,
        status: { in: ACTIVE_PREORDER_STATUSES as unknown as any },
      },
    }),
    prisma.affiliate.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, pendingBalance: true },
    }),
  ]);

  if (activeOrders > 0) {
    throw new ApiError(
      409,
      "You have an order still in progress. We can delete your account once it is delivered, cancelled or refunded."
    );
  }

  if (activePreOrders > 0) {
    throw new ApiError(
      409,
      "You have a pre-order still in progress. We can delete your account once it is completed or cancelled."
    );
  }

  if (affiliate && Number(affiliate.pendingBalance) > 0) {
    throw new ApiError(
      409,
      "You have an unpaid affiliate balance. Please contact support@littlestepz.in so we can settle it before closing your account."
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Ephemeral, user-only data — nothing references these, so remove the rows.
    await tx.cartItem.deleteMany({ where: { userId } });
    await tx.wishlistItem.deleteMany({ where: { userId } });
    await tx.deviceToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    // Addresses are referenced by retained orders, so the row has to stay; soft
    // deleting removes it from the account without corrupting order history.
    await tx.address.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });

    await tx.review.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });

    if (affiliate) {
      await tx.affiliate.updateMany({
        where: { id: affiliate.id, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.littlestepz.in`,
        name: "Deleted user",
        phone: null,
        password: null,
        googleId: null,
        appleId: null,
        avatarUrl: null,
        emailVerified: false,
        referralCode: null,
        deletedAt: now,
      },
    });
  }, {
    // Ten sequential statements against a remote Neon instance comfortably exceed
    // Prisma's 5s interactive-transaction default, which aborts mid-way with
    // "Transaction not found". Matches the window used by the auth refresh path.
    maxWait: 5000,
    timeout: 15000,
  });
}

export async function updatePasswordService(userId: string, data: UpdatePasswordData) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.password) {
    throw new ApiError(400, "This account uses Google sign-in and has no password to change.");
  }

  const isValid = await comparePassword(data.oldPassword, user.password);
  if (!isValid) {
    throw new ApiError(400, "Old password is incorrect");
  }

  const newHashed = await hashPassword(data.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: newHashed },
  });
}
