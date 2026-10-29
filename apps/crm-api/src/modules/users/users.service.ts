import { prisma, type Prisma, type Tx, type User } from "@repo/crm-db/client";
import type { CreateUserInput, ListQuery, ResetPasswordInput, UpdateUserInput, UserDto } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated, searchAcross } from "../../core/list";
import { hashPassword } from "../../core/password";

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lockedUntil: user.lockedUntil?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const SORTABLE = { name: "name", email: "email", role: "role", lastLoginAt: "lastLoginAt", createdAt: "createdAt" };

export async function listUsers(query: ListQuery) {
  const where: Prisma.UserWhereInput = { OR: searchAcross(query.q, ["name", "email"]) };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: buildOrderBy(query.sort, SORTABLE, "name:asc"), ...pageWindow(query) }),
    prisma.user.count({ where }),
  ]);
  return paginated(rows.map(toUserDto), total, query);
}

export async function createUser(input: CreateUserInput, ctx: RequestContext) {
  const passwordHash = await hashPassword(input.temporaryPassword);
  return withTransaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, role: input.role, passwordHash, mustChangePassword: true },
    });
    await recordAudit(tx, ctx, { action: "user.created", entity: "User", entityId: user.id, after: toUserDto(user) });
    return toUserDto(user);
  });
}

/**
 * Locks the active-admin rows before checking, so two concurrent demotions
 * cannot both pass and leave the CRM without an admin.
 */
async function assertAnotherActiveAdmin(tx: Tx, excludingUserId: string) {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;
  if (!admins.some((a) => a.id !== excludingUserId)) {
    throw new ApiError(409, "LAST_ADMIN", "At least one active admin is required");
  }
}

export async function updateUser(id: string, input: UpdateUserInput, ctx: RequestContext) {
  if (id === ctx.userId && (input.isActive === false || (input.role && input.role !== "ADMIN"))) {
    throw new ApiError(409, "CANNOT_DEMOTE_SELF", "You cannot deactivate or demote your own account");
  }

  return withTransaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id } });
    if (!before) throw notFound("User");

    const losesAdmin = before.role === "ADMIN" && before.isActive && (input.isActive === false || (input.role !== undefined && input.role !== "ADMIN"));
    if (losesAdmin) await assertAnotherActiveAdmin(tx, id);

    const after = await tx.user.update({ where: { id }, data: input });

    const accessChanged = before.role !== after.role || (before.isActive && !after.isActive);
    if (accessChanged) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await recordAudit(tx, ctx, { action: "user.updated", entity: "User", entityId: id, before: toUserDto(before), after: toUserDto(after) });
    return toUserDto(after);
  });
}

/** Issues a temporary password, unlocks the account and signs out all its sessions. */
export async function resetPassword(id: string, input: ResetPasswordInput, ctx: RequestContext) {
  const passwordHash = await hashPassword(input.temporaryPassword);
  return withTransaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound("User");

    const user = await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(tx, ctx, { action: "user.password_reset", entity: "User", entityId: id });
    return toUserDto(user);
  });
}
