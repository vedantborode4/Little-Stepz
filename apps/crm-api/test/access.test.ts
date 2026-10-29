import { describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { updateUser } from "../src/modules/users/users.service";
import { api, createUser, sessionAs } from "./helpers";

const systemCtx = { userId: null, ip: null, userAgent: null, requestId: null };

describe("role gates", () => {
  it("requires a session for every protected route", async () => {
    const res = await api().get("/api/v1/settings/locations");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("keeps user management and settings changes admin-only", async () => {
    const cashier = await sessionAs("CASHIER");
    const ops = await sessionAs("OPS");

    expect((await api().get("/api/v1/users").set(cashier.auth)).status).toBe(403);
    expect((await api().get("/api/v1/audit").set(ops.auth)).status).toBe(403);
    expect(
      (await api().post("/api/v1/settings/locations").set(ops.auth).send({ code: "X1", name: "X", type: "STORE" })).status,
    ).toBe(403);

    // Reads that POS and stock screens depend on stay open.
    expect((await api().get("/api/v1/settings/locations").set(cashier.auth)).status).toBe(200);
    expect((await api().get("/api/v1/settings/receiving-accounts").set(ops.auth)).status).toBe(200);
  });
});

describe("user management", () => {
  it("creates a user who must set their own password", async () => {
    const admin = await sessionAs("ADMIN");
    const res = await api()
      .post("/api/v1/users")
      .set(admin.auth)
      .send({ name: "New Cashier", email: "New.Cashier@Test.local", role: "CASHIER", temporaryPassword: "Temp-pass-123" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: "new.cashier@test.local", mustChangePassword: true });
    expect(res.body.data.passwordHash).toBeUndefined();

    const dup = await api()
      .post("/api/v1/users")
      .set(admin.auth)
      .send({ name: "Dup", email: "new.cashier@test.local", role: "OPS", temporaryPassword: "Temp-pass-123" });
    expect(dup.status).toBe(409);
  });

  it("rejects weak temporary passwords", async () => {
    const admin = await sessionAs("ADMIN");
    const res = await api()
      .post("/api/v1/users")
      .set(admin.auth)
      .send({ name: "Weak", email: "weak@test.local", role: "OPS", temporaryPassword: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.temporaryPassword).toBeDefined();
  });

  it("stops an admin from demoting or deactivating themselves", async () => {
    const admin = await sessionAs("ADMIN");
    const res = await api().patch(`/api/v1/users/${admin.userId}`).set(admin.auth).send({ role: "CASHIER" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CANNOT_DEMOTE_SELF");
  });

  it("never leaves the CRM without an active admin", async () => {
    const onlyAdmin = await createUser("ADMIN");
    const others = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true, id: { not: onlyAdmin.id } } });
    await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: false } });

    try {
      await expect(updateUser(onlyAdmin.id, { isActive: false }, systemCtx)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: true } });
    }
  });

  it("signs a user out everywhere when their role changes", async () => {
    const admin = await sessionAs("ADMIN");
    const target = await sessionAs("OPS");

    await api().patch(`/api/v1/users/${target.userId}`).set(admin.auth).send({ role: "CASHIER" }).expect(200);
    const res = await api().post("/api/v1/auth/refresh").set("Cookie", target.refreshCookie);
    expect(res.status).toBe(401);
  });
});
