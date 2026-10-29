import { randomUUID } from "crypto";
import { prisma, type Role } from "@repo/crm-db/client";
import { ROLE_PERMISSIONS, type ChangePasswordInput, type LoginInput, type SessionUserDto } from "@repo/crm-schema";
import { env } from "../../config/env";
import { recordAudit } from "../../core/audit";
import { hashToken, newOpaqueToken, signAccessToken } from "../../core/auth";
import { withTransaction } from "../../core/db";
import { ApiError, type RequestContext } from "../../core/http";
import { hashPassword, TIMING_DUMMY_HASH, verifyPassword } from "../../core/password";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/**
 * Two tabs can refresh with the same cookie at once; the loser presents a token
 * that was rotated a moment ago. Inside this window that is treated as a race,
 * not theft: it gets an access token, but no new refresh token.
 */
const ROTATION_GRACE_MS = 30_000;

const invalidCredentials = () => new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
const invalidRefresh = () => new ApiError(401, "SESSION_EXPIRED", "Your session has ended. Please sign in again.");

export type SessionUser = SessionUserDto;

export interface Session {
  user: SessionUser;
  accessToken: string;
  /** Present only when a new refresh token was issued and the cookie must be set. */
  refreshToken?: { token: string; expiresAt: Date };
}

function toSessionUser(user: { id: string; name: string; email: string; role: Role; mustChangePassword: boolean }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    permissions: ROLE_PERMISSIONS[user.role],
  };
}

function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function login(input: LoginInput, ctx: RequestContext): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? TIMING_DUMMY_HASH);

  if (!user || !user.isActive) throw invalidCredentials();

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, "ACCOUNT_LOCKED", `Too many failed attempts. Try again after ${LOCK_MINUTES} minutes.`);
  }

  if (!passwordOk) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await withTransaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failures,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await recordAudit(
        tx,
        { ...ctx, userId: null },
        {
          action: "auth.login_failed",
          entity: "User",
          entityId: user.id,
          metadata: { failures, locked: lock },
        },
      );
    });
    throw invalidCredentials();
  }

  const token = newOpaqueToken();
  const expiresAt = refreshExpiry();
  await withTransaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await tx.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), familyId: randomUUID(), expiresAt, ip: ctx.ip, userAgent: ctx.userAgent },
    });
    await recordAudit(tx, { ...ctx, userId: user.id }, { action: "auth.login", entity: "User", entityId: user.id });
  });

  return { user: toSessionUser(user), accessToken: signAccessToken(user.id, user.role), refreshToken: { token, expiresAt } };
}

export async function refresh(presented: string | undefined, ctx: RequestContext): Promise<Session> {
  if (!presented) throw invalidRefresh();

  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) }, include: { user: true } });
  if (!row) throw invalidRefresh();

  if (row.revokedAt) {
    const withinGrace = row.replacedById && Date.now() - row.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace && row.user.isActive) {
      return { user: toSessionUser(row.user), accessToken: signAccessToken(row.user.id, row.user.role) };
    }
    if (row.replacedById) await revokeFamilyForReuse(row.familyId, row.userId, ctx);
    throw invalidRefresh();
  }

  if (row.expiresAt <= new Date() || !row.user.isActive) throw invalidRefresh();

  const token = newOpaqueToken();
  const expiresAt = refreshExpiry();
  await withTransaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: { userId: row.userId, tokenHash: hashToken(token), familyId: row.familyId, expiresAt, ip: ctx.ip, userAgent: ctx.userAgent },
    });
    // Guarded on revokedAt so two concurrent rotations cannot both succeed.
    const rotated = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
    if (rotated.count !== 1) throw invalidRefresh();
  });

  return {
    user: toSessionUser(row.user),
    accessToken: signAccessToken(row.user.id, row.user.role),
    refreshToken: { token, expiresAt },
  };
}

async function revokeFamilyForReuse(familyId: string, userId: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await tx.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(
      tx,
      { ...ctx, userId },
      {
        action: "auth.refresh_reuse_detected",
        entity: "User",
        entityId: userId,
        metadata: { familyId },
      },
    );
  });
}

export async function logout(presented: string | undefined, ctx: RequestContext) {
  if (!presented) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(presented) } });
  if (!row) return;
  await withTransaction(async (tx) => {
    await tx.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(tx, { ...ctx, userId: row.userId }, { action: "auth.logout", entity: "User", entityId: row.userId });
  });
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toSessionUser(user);
}

/** Signs out every other session; the session making the change stays signed in. */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  currentRefreshToken: string | undefined,
  ctx: RequestContext,
): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Current password is incorrect", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }

  const passwordHash = await hashPassword(input.newPassword);
  const current = currentRefreshToken
    ? await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(currentRefreshToken) }, select: { familyId: true } })
    : null;

  const updated = await withTransaction(async (tx) => {
    const saved = await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(current ? { familyId: { not: current.familyId } } : {}) },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, ctx, { action: "auth.password_changed", entity: "User", entityId: userId });
    return saved;
  });
  return toSessionUser(updated);
}
