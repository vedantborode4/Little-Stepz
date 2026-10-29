import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { updateLocation } from "../src/modules/settings/settings.service";
import { api, sessionAs } from "./helpers";

const systemCtx = { userId: null, ip: null, userAgent: null, requestId: null };
const uid = () => randomUUID().slice(0, 6).toUpperCase();

describe("settings", () => {
  it("saves the business profile and validates GSTIN and PIN", async () => {
    const admin = await sessionAs("ADMIN");
    const valid = {
      legalName: "Little Stepz Test",
      tradeName: "Little Stepz",
      gstin: "36abcde1234f1z5",
      stateCode: "36",
      addressLine: "Test address",
      city: "Hyderabad",
      pincode: "500001",
    };
    const res = await api().put("/api/v1/settings/business-profile").set(admin.auth).send(valid);
    expect(res.status).toBe(200);
    expect(res.body.data.gstin).toBe("36ABCDE1234F1Z5");

    const bad = await api()
      .put("/api/v1/settings/business-profile")
      .set(admin.auth)
      .send({ ...valid, gstin: "123", pincode: "50001" });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details.fieldErrors)).toEqual(expect.arrayContaining(["gstin", "pincode"]));
  });

  it("stores fee percentages exactly and rejects more than 2 decimals", async () => {
    const admin = await sessionAs("ADMIN");
    const ok = await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Gateway ${uid()}`, method: "GATEWAY", feePercent: "2.5" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.feePercent).toBe("2.50");

    const bad = await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Gateway ${uid()}`, method: "GATEWAY", feePercent: "1.234" });
    expect(bad.status).toBe(400);
  });

  it("keeps location codes unique and at least one location active", async () => {
    const admin = await sessionAs("ADMIN");
    const code = `S${uid()}`;
    const created = await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: code.toLowerCase(), name: "Store", type: "STORE" });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe(code);

    const dup = await api().post("/api/v1/settings/locations").set(admin.auth).send({ code, name: "Store 2", type: "STORE" });
    expect(dup.status).toBe(409);

    const others = await prisma.location.findMany({ where: { isActive: true, id: { not: created.body.data.id } } });
    await prisma.location.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: false } });
    try {
      await expect(updateLocation(created.body.data.id, { isActive: false }, systemCtx)).rejects.toMatchObject({ code: "LAST_LOCATION" });
    } finally {
      await prisma.location.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: true } });
    }
  });
});

describe("audit trail", () => {
  it("records who changed what, with before and after values", async () => {
    const admin = await sessionAs("ADMIN");
    const created = await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `G${uid()}`, name: "Godown 2", type: "WAREHOUSE" });
    const id = created.body.data.id;
    await api().patch(`/api/v1/settings/locations/${id}`).set(admin.auth).send({ name: "Back Godown" }).expect(200);

    const res = await api().get(`/api/v1/audit?entity=Location&entityId=${id}`).set(admin.auth);
    expect(res.body.data.total).toBe(2);
    const [update] = res.body.data.items;
    expect(update).toMatchObject({ action: "location.updated", userId: admin.userId });
    expect(update.before.name).toBe("Godown 2");
    expect(update.after.name).toBe("Back Godown");
  });

  it("cannot be edited, deleted or truncated", async () => {
    const row = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.$executeRaw`UPDATE "AuditLog" SET action = 'tampered' WHERE id = ${row.id}`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM "AuditLog" WHERE id = ${row.id}`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`TRUNCATE "AuditLog"`).rejects.toThrow(/append-only/);
  });

  it("never stores password hashes", async () => {
    const leaks = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "AuditLog" WHERE before::text ILIKE '%passwordHash%' OR after::text ILIKE '%passwordHash%'`;
    expect(Number(leaks[0]!.n)).toBe(0);
  });

  it("exports as CSV with a BOM", async () => {
    const admin = await sessionAs("ADMIN");
    const res = await api().get("/api/v1/audit?entity=Location&format=csv").set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text.startsWith("﻿When (UTC)")).toBe(true);
  });
});

describe("exports", () => {
  it("neutralises spreadsheet formulas in text cells", async () => {
    const admin = await sessionAs("ADMIN");
    await api()
      .post("/api/v1/users")
      .set(admin.auth)
      .send({ name: "=HYPERLINK(1)", email: `formula-${uid()}@test.local`.toLowerCase(), role: "OPS", temporaryPassword: "Temp-pass-123" })
      .expect(201);

    const res = await api().get("/api/v1/users?format=csv&q=HYPERLINK").set(admin.auth);
    expect(res.text).toContain("'=HYPERLINK(1)");
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});
