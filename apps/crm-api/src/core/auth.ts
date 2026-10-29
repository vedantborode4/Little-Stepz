import { createHash, randomBytes } from "crypto";
import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma, type Role } from "@repo/crm-db/client";
import { hasPermission, type Permission } from "@repo/crm-schema";
import { env } from "../config/env";
import { ApiError, forbidden } from "./http";

interface AccessTokenClaims {
  sub: string;
  role: Role;
}

export function signAccessToken(userId: string, role: Role): string {
  const claims: AccessTokenClaims = { sub: userId, role };
  return jwt.sign(claims, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new ApiError(401, "TOKEN_EXPIRED", "Session expired");
    throw new ApiError(401, "TOKEN_INVALID", "Invalid session");
  }
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newOpaqueToken = () => randomBytes(48).toString("base64url");

/**
 * Bearer-only on purpose: the refresh cookie is scoped to /auth, and access tokens
 * never ride in cookies, so state-changing requests are not CSRF-able.
 *
 * The user row is re-read on every request so deactivation and role changes take
 * effect immediately instead of when the access token expires.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");

  const claims = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, role: true, isActive: true, mustChangePassword: true },
  });
  if (!user || !user.isActive) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");

  req.user = { id: user.id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
  next();
}

/** Accounts with an admin-issued temporary password may only change it. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Set a new password to continue");
  }
  next();
}

export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = currentUser(req);
    if (!permissions.every((p) => hasPermission(user.role, p))) throw forbidden();
    next();
  };

export function currentUser(req: Request): NonNullable<Request["user"]> {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
  return req.user;
}

export const can = (req: Request, permission: Permission) =>
  req.user ? hasPermission(req.user.role, permission) : false;
