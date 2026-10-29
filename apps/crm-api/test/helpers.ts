import { randomUUID } from "crypto";
import request from "supertest";
import { prisma, type Role } from "@repo/crm-db/client";
import { createApp } from "../src/app";
import { hashPassword } from "../src/core/password";

export const app = createApp();
export const api = () => request(app);

export const TEST_PASSWORD = "Test-pass-123";

export async function createUser(role: Role, overrides: { mustChangePassword?: boolean; isActive?: boolean } = {}) {
  return prisma.user.create({
    data: {
      name: `${role} ${randomUUID().slice(0, 6)}`,
      email: `${role.toLowerCase()}-${randomUUID()}@test.local`,
      role,
      passwordHash: await hashPassword(TEST_PASSWORD),
      mustChangePassword: overrides.mustChangePassword ?? false,
      isActive: overrides.isActive ?? true,
    },
  });
}

export interface TestSession {
  userId: string;
  token: string;
  refreshCookie: string;
  auth: { Authorization: string };
}

export function refreshCookieFrom(res: request.Response): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith("crm_rt="));
  if (!cookie) throw new Error("No refresh cookie in response");
  return cookie.split(";")[0]!;
}

export async function signIn(email: string, password = TEST_PASSWORD): Promise<TestSession> {
  const res = await api().post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    userId: res.body.data.user.id,
    token: res.body.data.accessToken,
    refreshCookie: refreshCookieFrom(res),
    auth: { Authorization: `Bearer ${res.body.data.accessToken}` },
  };
}

export async function sessionAs(role: Role): Promise<TestSession> {
  const user = await createUser(role);
  return signIn(user.email);
}
