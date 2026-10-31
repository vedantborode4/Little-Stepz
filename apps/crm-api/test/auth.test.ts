import { describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, createUser, refreshCookieFrom, signIn, TEST_PASSWORD } from "./helpers";

describe("sign-in", () => {
  it("returns an access token, sets an httpOnly refresh cookie and resolves /me", async () => {
    const user = await createUser("ADMIN");
    const res = await api().post("/api/v1/auth/login").send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, role: "ADMIN" });
    expect(res.body.data.user.permissions).toContain("users.manage");
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("crm_rt="));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const me = await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${res.body.data.accessToken}`);
    expect(me.body.data.user.id).toBe(user.id);
  });

  it("rejects a wrong password with a generic error and locks after 5 failures", async () => {
    const user = await createUser("CASHIER");
    for (let i = 0; i < 5; i++) {
      const res = await api().post("/api/v1/auth/login").send({ email: user.email, password: "Wrong-pass-1" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    }
    const locked = await api().post("/api/v1/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("does not reveal whether an unknown or inactive email exists", async () => {
    const inactive = await createUser("OPS", { isActive: false });
    const unknown = await api().post("/api/v1/auth/login").send({ email: "nobody@test.local", password: TEST_PASSWORD });
    const disabled = await api().post("/api/v1/auth/login").send({ email: inactive.email, password: TEST_PASSWORD });
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(disabled.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("refresh tokens", () => {
  it("rotates the refresh token on every refresh", async () => {
    const user = await createUser("ADMIN");
    const session = await signIn(user.email);

    const res = await api().post("/api/v1/auth/refresh").set("Cookie", session.refreshCookie);
    expect(res.status).toBe(200);
    expect(refreshCookieFrom(res)).not.toBe(session.refreshCookie);
  });

  it("revokes the whole session family when a rotated token is replayed", async () => {
    const user = await createUser("ADMIN");
    const session = await signIn(user.email);
    const rotated = await api().post("/api/v1/auth/refresh").set("Cookie", session.refreshCookie);
    const newCookie = refreshCookieFrom(rotated);

    // Move the rotation outside the concurrent-tab grace window.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, replacedById: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await api().post("/api/v1/auth/refresh").set("Cookie", session.refreshCookie);
    expect(replay.status).toBe(401);

    const afterTheft = await api().post("/api/v1/auth/refresh").set("Cookie", newCookie);
    expect(afterTheft.status).toBe(401);

    const audit = await prisma.auditLog.findFirst({ where: { entityId: user.id, action: "auth.refresh_reuse_detected" } });
    expect(audit).not.toBeNull();
  });

  it("ends the session on logout", async () => {
    const user = await createUser("ADMIN");
    const session = await signIn(user.email);
    await api().post("/api/v1/auth/logout").set("Cookie", session.refreshCookie).expect(200);
    const res = await api().post("/api/v1/auth/refresh").set("Cookie", session.refreshCookie);
    expect(res.status).toBe(401);
  });
});

describe("account state", () => {
  it("forces a password change before any other route", async () => {
    const user = await createUser("CASHIER", { mustChangePassword: true });
    const session = await signIn(user.email);

    const blocked = await api().get("/api/v1/settings/locations").set(session.auth);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changed = await api()
      .post("/api/v1/auth/change-password")
      .set(session.auth)
      .set("Cookie", session.refreshCookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "Brand-new-pass-9" });
    expect(changed.status).toBe(200);

    await api().get("/api/v1/settings/locations").set(session.auth).expect(200);
  });

  it("rejects a deactivated user's still-valid access token immediately", async () => {
    const user = await createUser("OPS");
    const session = await signIn(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await api().get("/api/v1/settings/locations").set(session.auth);
    expect(res.status).toBe(401);
  });
});
