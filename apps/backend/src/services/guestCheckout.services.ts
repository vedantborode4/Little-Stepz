import { Prisma, prisma } from "@repo/db/client";
import type { GuestCheckoutStartInput, GuestCheckoutVerifyInput } from "@repo/zod-schema/index";
import { ApiError } from "../utils/api";
import { generateGuestAccessToken } from "../utils/auth/access-token";
import { PhoneErrorCode } from "../utils/phoneErrors";
import { requestPhoneOtpService, verifyPhoneOtpService } from "./phoneVerification.services";

/** A registered customer must sign in rather than check out as a guest with their email. */
export const ACCOUNT_EXISTS = "ACCOUNT_EXISTS";

/**
 * The password-less account behind a guest checkout, found or created by email.
 * An email that belongs to a real account (password, Google or Apple, or staff) is refused,
 * so a guest can never place orders into — or learn anything from — someone's account.
 */
async function findOrCreateGuestAccount(input: GuestCheckoutStartInput): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, isGuest: true, deletedAt: true },
  });
  if (existing) {
    if (!existing.isGuest || existing.deletedAt) throw new ApiError(409, ACCOUNT_EXISTS);
    await prisma.user.update({ where: { id: existing.id }, data: { name: input.name, phone: input.phone } });
    return existing.id;
  }

  try {
    const created = await prisma.user.create({
      data: { email: input.email, name: input.name, phone: input.phone, isGuest: true },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Two starts for the same email at once: the unique constraint is the real guard.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, isGuest: true, deletedAt: true },
      });
      if (raced?.isGuest && !raced.deletedAt) return raced.id;
      throw new ApiError(409, ACCOUNT_EXISTS);
    }
    throw err;
  }
}

/**
 * Step 1: contact details in, SMS code out. A code is always sent, even for a number this
 * guest account verified before: the earlier guest may not have been this person.
 */
export async function startGuestCheckoutService(
  input: GuestCheckoutStartInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const userId = await findOrCreateGuestAccount(input);
  const result = await requestPhoneOtpService(userId, input.phone, meta, new Date(Date.now() + 60_000));
  return { expiresInSeconds: result.expiresInSeconds, resendAfterSeconds: result.resendAfterSeconds };
}

/** Step 2: the code proves the phone; the shopper gets a short-lived guest session. */
export async function verifyGuestCheckoutService(input: GuestCheckoutVerifyInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, phone: true, isGuest: true, deletedAt: true },
  });
  if (!user || !user.isGuest || user.deletedAt) throw new ApiError(400, PhoneErrorCode.OTP_INVALID);

  // The session start is compared with rows the database timestamps itself (addresses,
  // orders), so it is read from the database's clock — before the code is checked, with no
  // allowance either way: a margin would let this session see an earlier one's rows.
  const [clock] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  const since = clock!.now;
  await verifyPhoneOtpService(user.id, input.phone, input.code);
  // A re-verification is stamped by the API's clock; restamp it with the database's so it
  // reliably falls inside this session.
  await prisma.$executeRaw`UPDATE "VerifiedPhone" SET "verifiedAt" = now() WHERE "userId" = ${user.id} AND phone = ${input.phone}`;

  return {
    accessToken: generateGuestAccessToken(user.id, since),
    user: { name: user.name, email: user.email, phone: input.phone },
  };
}
