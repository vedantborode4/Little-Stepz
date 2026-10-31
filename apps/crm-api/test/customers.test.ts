import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { normalizeMobile } from "@repo/crm-schema";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ops: TestSession;
let categoryId: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
/** A random, valid Indian mobile so re-runs never collide. */
const mobile = () => `9${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;

beforeAll(async () => {
  [admin, cashier, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("OPS")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Cust ${uid()}` })
  ).body.data.id;
});

async function createCustomer(body: Record<string, unknown>, session = admin) {
  return api()
    .post("/api/v1/customers")
    .set(session.auth)
    .send({ name: `Customer ${uid()}`, ...body });
}

async function variant() {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({
      name: `Item ${uid()}`,
      categoryId,
      gstRate: "18",
      variants: [{ sku: `CP-${uid()}`, regularPrice: "1000", wholesalePrice: "700" }],
    });
  return res.body.data.variants[0].id as string;
}

describe("mobile normalisation", () => {
  it("treats the common ways of writing an Indian mobile as one number", () => {
    for (const raw of ["98765 43210", "098765-43210", "+91 98765 43210", "919876543210", "(98765) 43210"]) {
      expect(normalizeMobile(raw)).toBe("+919876543210");
    }
  });

  it("keeps international numbers that carry a country code and rejects junk", () => {
    expect(normalizeMobile("+86 138 0013 8000")).toBe("+8613800138000");
    expect(normalizeMobile("12345")).toBeNull();
    expect(normalizeMobile("5876543210")).toBeNull();
    expect(normalizeMobile("+91 12345 67890")).toBeNull();
    expect(normalizeMobile("abc")).toBeNull();
  });
});

describe("customer profiles", () => {
  it("creates a customer with a CUS code and stores the mobile in E.164", async () => {
    const m = mobile();
    const res = await createCustomer({ mobile: `0${m}`, pincode: "500081", city: "Hyderabad", type: "WHOLESALE", creditDays: 30 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: expect.stringMatching(/^CUS-\d{5}$/), type: "WHOLESALE", creditDays: 30 });
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(row.mobile).toBe(`+91${m}`);
  });

  it("blocks a second customer with the same mobile, however it is written", async () => {
    const m = mobile();
    const first = await createCustomer({ mobile: m });
    const second = await createCustomer({ mobile: `+91 ${m.slice(0, 5)} ${m.slice(5)}` });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("MOBILE_TAKEN");
    expect(second.body.error.details.fieldErrors.mobile[0]).toContain(first.body.data.code);

    const other = await createCustomer({ mobile: mobile() });
    const edit = await api().patch(`/api/v1/customers/${other.body.data.id}`).set(admin.auth).send({ mobile: m });
    expect(edit.status).toBe(409);
  });

  it("refuses a phone that isn't E.164 at the database, so nothing can bypass normalisation", async () => {
    await expect(prisma.customer.create({ data: { code: `RAW-${uid()}`, name: "Raw", nameKey: "raw", mobile: mobile() } })).rejects.toThrow(
      /Customer_phones_e164/,
    );
  });

  it("rejects an invalid mobile with a field error", async () => {
    const res = await createCustomer({ mobile: "12345" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.mobile).toBeDefined();
  });

  it("lets cashiers create customers but not operations staff", async () => {
    expect((await createCustomer({ mobile: mobile() }, cashier)).status).toBe(201);
    expect((await createCustomer({ mobile: mobile() }, ops)).status).toBe(403);
    expect((await api().get("/api/v1/customers").set(ops.auth)).status).toBe(200);
  });
});

describe("contact privacy", () => {
  it("masks contacts in lists and profiles for every role, including the cashier", async () => {
    const m = mobile();
    const created = await createCustomer({ mobile: m, email: "ravi.kumar@example.com" });
    for (const session of [admin, cashier]) {
      const list = await api().get("/api/v1/customers").query({ q: m }).set(session.auth);
      expect(list.body.data.items).toHaveLength(1);
      expect(list.body.data.items[0].mobile).toBe(`+91 ••••••${m.slice(-4)}`);
      expect(list.body.data.items[0].email).toBe("r•••@example.com");
    }
    const detail = await api().get(`/api/v1/customers/${created.body.data.id}`).set(cashier.auth);
    expect(JSON.stringify(detail.body.data)).not.toContain(m);
  });

  it("finds a customer by the full number or the visible last four digits, but not by other fragments", async () => {
    const m = mobile();
    const name = `Lookup ${uid()}`;
    await createCustomer({ name, mobile: m });
    const search = async (q: string) => (await api().get("/api/v1/customers").query({ q }).set(cashier.auth)).body.data.items;
    expect((await search(`+91 ${m}`)).map((c: { name: string }) => c.name)).toEqual([name]);
    expect((await search(m.slice(-4))).some((c: { name: string }) => c.name === name)).toBe(true);
    expect((await search(m.slice(2, 8))).some((c: { name: string }) => c.name === name)).toBe(false);
  });

  it("reveals the full contact on request and records who looked", async () => {
    const m = mobile();
    const created = await createCustomer({ mobile: m });
    const res = await api().post(`/api/v1/customers/${created.body.data.id}/contact`).set(cashier.auth);
    expect(res.body.data.mobile).toBe(`+91${m}`);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: created.body.data.id, action: "customer.contact_revealed", userId: cashier.userId },
    });
    expect(audit).not.toBeNull();
  });

  it("allows full-contact exports to admins only, and audits them", async () => {
    const denied = await api().get("/api/v1/customers").query({ format: "csv", contacts: "full" }).set(cashier.auth);
    expect(denied.status).toBe(403);
    const masked = await api().get("/api/v1/customers").query({ format: "csv" }).set(cashier.auth);
    expect(masked.status).toBe(200);
    expect(masked.text).toContain("Mobile (masked)");

    const before = await prisma.auditLog.count({ where: { action: "customer.contacts_exported", userId: admin.userId } });
    const full = await api().get("/api/v1/customers").query({ format: "csv", contacts: "full" }).set(admin.auth);
    expect(full.status).toBe(200);
    expect(full.text).toContain("WhatsApp");
    expect(await prisma.auditLog.count({ where: { action: "customer.contacts_exported", userId: admin.userId } })).toBe(before + 1);
  });
});

describe("duplicates and merging", () => {
  it("warns about a similar name at the same PIN and about an existing mobile", async () => {
    const tag = uid();
    const m = mobile();
    const existing = await createCustomer({ name: `Srinivas Rao ${tag}`, pincode: "500032", mobile: m });
    const res = await api()
      .get("/api/v1/customers/duplicates/check")
      .query({ name: `Srinivas  rao ${tag}`, pincode: "500032" })
      .set(cashier.auth);
    expect(res.body.data).toContainEqual(expect.objectContaining({ id: existing.body.data.id, reason: "NAME_AND_PIN" }));

    const byMobile = await api()
      .get("/api/v1/customers/duplicates/check")
      .query({ mobile: `0${m}` })
      .set(cashier.auth);
    expect(byMobile.body.data[0]).toMatchObject({ id: existing.body.data.id, reason: "MOBILE" });

    const excluded = await api()
      .get("/api/v1/customers/duplicates/check")
      .query({ mobile: m, excludeId: existing.body.data.id })
      .set(cashier.auth);
    expect(excluded.body.data).toHaveLength(0);
  });

  it("lists likely duplicate pairs for admins", async () => {
    // The list is capped and the test database outlives runs: earlier runs' pairs would crowd this one out.
    await prisma.customer.updateMany({ where: { name: { startsWith: "Lakshmi Toy" } }, data: { isActive: false } });
    const tag = uid();
    await createCustomer({ name: `Lakshmi Toys ${tag}`, pincode: "500072" });
    await createCustomer({ name: `Lakshmi Toy ${tag}`, pincode: "500072" });
    const res = await api().get("/api/v1/customers/duplicates").set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { a: { name: string }; b: { name: string } }) => p.a.name.includes(tag) && p.b.name.includes(tag))).toBe(
      true,
    );
    expect((await api().get("/api/v1/customers/duplicates").set(cashier.auth)).status).toBe(403);
  });

  it("merges a duplicate into the kept customer, moving prices and contact gaps, and audits both sides", async () => {
    const [v1, v2] = await Promise.all([variant(), variant()]);
    const m = mobile();
    const keep = (await createCustomer({ name: `Keep ${uid()}`, pincode: "500001" })).body.data;
    const dup = (await createCustomer({ name: `Dup ${uid()}`, mobile: m, email: "dup@example.com", notes: "Prefers UPI" })).body.data;

    await api().put(`/api/v1/customers/${keep.id}/prices/${v1}`).set(admin.auth).send({ price: "650" });
    await api().put(`/api/v1/customers/${dup.id}/prices/${v1}`).set(admin.auth).send({ price: "600" });
    await api().put(`/api/v1/customers/${dup.id}/prices/${v2}`).set(admin.auth).send({ price: "640" });

    expect((await api().post(`/api/v1/customers/${dup.id}/merge`).set(cashier.auth).send({ intoId: keep.id, reason: "x" })).status).toBe(
      403,
    );

    const res = await api().post(`/api/v1/customers/${dup.id}/merge`).set(admin.auth).send({ intoId: keep.id, reason: "Same person" });
    expect(res.status).toBe(200);
    const prices = Object.fromEntries(res.body.data.prices.map((p: { variantId: string; price: string }) => [p.variantId, p.price]));
    expect(prices).toEqual({ [v1]: "650.00", [v2]: "640.00" });
    expect(res.body.data.mergedFrom).toEqual([expect.objectContaining({ id: dup.id })]);

    const [folded, kept] = await Promise.all([
      prisma.customer.findUniqueOrThrow({ where: { id: dup.id } }),
      prisma.customer.findUniqueOrThrow({ where: { id: keep.id } }),
    ]);
    expect(folded).toMatchObject({ isActive: false, mergedIntoId: keep.id, mobile: null });
    expect(kept).toMatchObject({ mobile: `+91${m}`, email: "dup@example.com" });
    expect(kept.notes).toContain("Prefers UPI");

    const audits = await prisma.auditLog.findMany({
      where: { entityId: { in: [dup.id, keep.id] }, action: { startsWith: "customer.merge" } },
    });
    expect(audits.map((a) => a.action).sort()).toEqual(["customer.merged", "customer.merged_in"]);

    const again = await api().post(`/api/v1/customers/${dup.id}/merge`).set(admin.auth).send({ intoId: keep.id, reason: "again" });
    expect(again.body.error.code).toBe("ALREADY_MERGED");
    const other = (await createCustomer({})).body.data;
    const intoFolded = await api().post(`/api/v1/customers/${other.id}/merge`).set(admin.auth).send({ intoId: dup.id, reason: "x" });
    expect(intoFolded.body.error.code).toBe("TARGET_MERGED");
    expect((await api().patch(`/api/v1/customers/${dup.id}`).set(admin.auth).send({ name: "Edit" })).body.error.code).toBe(
      "CUSTOMER_MERGED",
    );
  });
});

describe("customer-specific prices", () => {
  it("are set by admins only and refused for archived items", async () => {
    const customer = (await createCustomer({ type: "WHOLESALE" })).body.data;
    const v = await variant();
    expect((await api().put(`/api/v1/customers/${customer.id}/prices/${v}`).set(cashier.auth).send({ price: "500" })).status).toBe(403);

    const set = await api().put(`/api/v1/customers/${customer.id}/prices/${v}`).set(admin.auth).send({ price: "500" });
    expect(set.body.data.prices).toEqual([expect.objectContaining({ variantId: v, price: "500.00", regularPrice: "1000.00" })]);
    const removed = await api().delete(`/api/v1/customers/${customer.id}/prices/${v}`).set(admin.auth);
    expect(removed.body.data.prices).toEqual([]);

    const product = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({
        name: `Two ${uid()}`,
        categoryId,
        gstRate: "18",
        options: [{ name: "Colour", values: ["Red", "Blue"] }],
        variants: [
          { optionValues: ["Red"], sku: `TR-${uid()}`, regularPrice: "900" },
          { optionValues: ["Blue"], sku: `TB-${uid()}`, regularPrice: "900" },
        ],
      });
    const blue = product.body.data.variants[1].id as string;
    await api().patch(`/api/v1/variants/${blue}`).set(admin.auth).send({ status: "ARCHIVED" });
    const archived = await api().put(`/api/v1/customers/${customer.id}/prices/${blue}`).set(admin.auth).send({ price: "500" });
    expect(archived.body.error.code).toBe("VARIANT_INACTIVE");
  });
});
