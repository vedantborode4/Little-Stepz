import { randomInt, randomUUID } from "crypto";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let category: string;
let categoryId: string;
let store: string;
let cash: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const mobile = () => `9${String(randomInt(0, 1e9)).padStart(9, "0")}`;
const csv = (rows: string[][]) =>
  Buffer.from(rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n"));

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  category = `Imported ${uid()}`;
  categoryId = (await api().post("/api/v1/categories").set(admin.auth).send({ name: category })).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `IM${uid()}`, name: "Import store", type: "STORE" })
  ).body.data.id;
  cash = (
    await api()
      .post("/api/v1/settings/receiving-accounts")
      .set(admin.auth)
      .send({ name: `Cash ${uid()}`, method: "CASH" })
  ).body.data.id;
});

const upload = (kind: string, fileName: string, body: Buffer, session = admin) =>
  api().post("/api/v1/imports").query({ kind, fileName }).set(session.auth).set("Content-Type", "application/octet-stream").send(body);
const check = (id: string, body: Record<string, unknown>) => api().put(`/api/v1/imports/${id}/mapping`).set(admin.auth).send(body);
const rows = async (id: string) =>
  (await api().get(`/api/v1/imports/${id}/rows`).query({ limit: 100 }).set(admin.auth)).body.data.items as {
    rowNumber: number;
    status: string;
    errors: string[];
    duplicateOf: string | null;
    createdEntityId: string | null;
  }[];
const row = (all: Awaited<ReturnType<typeof rows>>, n: number) => all.find((r) => r.rowNumber === n)!;

describe("Products & variants import", () => {
  it("maps columns, checks every row, imports whole products and rolls back cleanly", async () => {
    const p = uid();
    const existing = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ name: `Existing ${p}`, categoryId, gstRate: "18", variants: [{ sku: `EX-${p}`, regularPrice: "100" }] });
    expect(existing.status).toBe(201);

    const file = csv([
      ["Item", "Category", "SKU", "GST", "MRP", "Offer", "Colour", "Remarks"],
      [`Truck ${p}`, category, `TR-${p}-RED`, "18%", "₹1,180", "1,062", "Red", ""],
      [`Truck ${p}`, category, `TR-${p}-BLU`, "18", "1180", "", "Blue", ""],
      [`Plane ${p}`, category, `PL-${p}`, "12", "560", "", "", ""],
      [`Boat ${p}`, "No such category", `BT-${p}`, "18", "300", "", "", ""],
      [`Kite ${p}`, category, `EX-${p}`, "18", "300", "", "", ""],
      [`Ball ${p}`, category, `BL-${p}`, "18", "300", "350", "", ""],
      [`Top ${p}`, category, `PL-${p}`, "18", "90", "", "", ""],
    ]);
    const up = await upload("PRODUCTS", "catalog.csv", file);
    expect(up.status).toBe(201);
    const batch = up.body.data;
    expect(batch).toMatchObject({ code: expect.stringMatching(/^IMP-\d{4}$/), status: "UPLOADED", totalRows: 7 });
    expect(batch.suggestedMapping).toMatchObject({
      productName: "Item",
      category: "Category",
      sku: "SKU",
      gstRate: "GST",
      regularPrice: "MRP",
      offerPrice: "Offer",
      optionValue: "Colour",
    });

    const missing = await check(batch.id, { mapping: { productName: "Item" } });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fieldErrors.sku).toBeDefined();

    const checked = await check(batch.id, { mapping: batch.suggestedMapping, saveTemplateAs: `Supplier sheet ${p}` });
    expect(checked.status).toBe(200);
    expect(checked.body.data).toMatchObject({ status: "VALIDATED", validRows: 3, errorRows: 3, duplicateRows: 1 });

    const all = await rows(batch.id);
    expect(row(all, 2).status).toBe("VALID");
    expect(row(all, 5).errors[0]).toMatch(/Unknown category/);
    expect(row(all, 6)).toMatchObject({ status: "DUPLICATE", duplicateOf: `SKU EX-${p} already exists` });
    expect(row(all, 7).errors.join()).toMatch(/Offer price/);
    expect(row(all, 8).errors[0]).toMatch(/repeated \(first on line 4\)/);

    const templates = await api().get("/api/v1/imports/templates").query({ kind: "PRODUCTS" }).set(admin.auth);
    expect(templates.body.data.map((t: { name: string }) => t.name)).toContain(`Supplier sheet ${p}`);

    const approved = await api().post(`/api/v1/imports/${batch.id}/approve`).set(admin.auth);
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: "IMPORTED", importedRows: 3, rollbackBlocker: null });

    const truck = await prisma.product.findFirst({
      where: { name: `Truck ${p}` },
      include: { variants: true, options: { include: { values: true } } },
    });
    expect(truck!.variants.map((v) => v.sku).sort()).toEqual([`TR-${p}-BLU`, `TR-${p}-RED`]);
    expect(truck!.options[0]).toMatchObject({ name: "Variant" });
    const red = truck!.variants.find((v) => v.sku === `TR-${p}-RED`)!;
    expect(red.regularPrice.toFixed(2)).toBe("1180.00");
    expect(red.offerPrice!.toFixed(2)).toBe("1062.00");
    expect((await prisma.product.findFirst({ where: { name: `Plane ${p}` } }))!.gstRate.toString()).toBe("12");

    const rolled = await api().post(`/api/v1/imports/${batch.id}/rollback`).set(admin.auth).send({ reason: "Wrong price list" });
    expect(rolled.body.data).toMatchObject({ status: "ROLLED_BACK", rollbackReason: "Wrong price list" });
    const archived = await prisma.variant.findUnique({ where: { id: red.id }, include: { product: true } });
    expect(archived).toMatchObject({ status: "ARCHIVED", sku: `TR-${p}-RED~${batch.code}` });
    expect(archived!.product.status).toBe("ARCHIVED");

    // The SKUs are free again, so the corrected file can come in.
    const again = await upload("PRODUCTS", "catalog-fixed.csv", file);
    const rechecked = await check(again.body.data.id, { mapping: again.body.data.suggestedMapping });
    expect(rechecked.body.data.validRows).toBe(3);
  });

  it("refuses rollback once an imported item has stock", async () => {
    const p = uid();
    const up = await upload(
      "PRODUCTS",
      "one.csv",
      csv([
        ["Product name", "Category", "SKU", "GST %", "Regular price"],
        [`Single ${p}`, category, `SG-${p}`, "18", "500"],
      ]),
    );
    await check(up.body.data.id, { mapping: up.body.data.suggestedMapping }).expect(200);
    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth).expect(200);
    const variant = await prisma.variant.findUnique({ where: { sku: `SG-${p}` } });
    await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, lines: [{ variantId: variant!.id, quantity: 2 }] })
      .expect(201);

    const detail = await api().get(`/api/v1/imports/${up.body.data.id}`).set(admin.auth);
    expect(detail.body.data.rollbackBlocker).toMatch(/has been used since/);
    const rollback = await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "Oops" });
    expect(rollback.body.error.code).toBe("IMPORT_IN_USE");
  });
});

async function newVariant(price = "1000") {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Stocked ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `ST-${uid()}`, regularPrice: price }] });
  return res.body.data.variants[0] as { id: string; sku: string };
}

async function xlsx(rows: (string | number | null)[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock");
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("Opening stock import", () => {
  it("posts one opening document from Excel, keeps unknown costs unknown and reverses on rollback", async () => {
    const [a, b, used] = [await newVariant(), await newVariant(), await newVariant()];
    await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, lines: [{ variantId: used.id, quantity: 1, unitCost: "10" }] })
      .expect(201);

    const up = await upload(
      "OPENING_STOCK",
      "stock.xlsx",
      await xlsx([
        ["SKU", "Qty", "Cost"],
        [a.sku.toLowerCase(), 5, 250],
        [b.sku, "3", null],
        ["NOPE-404", 2, 10],
        [used.sku, 4, 10],
        [a.sku, 0, 10],
      ]),
    );
    expect(up.status).toBe(201);
    expect(up.body.data.suggestedMapping).toMatchObject({ sku: "SKU", quantity: "Qty", unitCost: "Cost" });

    const noLocation = await check(up.body.data.id, { mapping: up.body.data.suggestedMapping });
    expect(noLocation.body.error.details.fieldErrors.locationId).toBeDefined();
    const checked = await check(up.body.data.id, { mapping: up.body.data.suggestedMapping, locationId: store });
    expect(checked.body.data).toMatchObject({ validRows: 2, errorRows: 2, duplicateRows: 1, locationName: "Import store" });
    const all = await rows(up.body.data.id);
    expect(row(all, 4).errors[0]).toMatch(/NOPE-404 not found/);
    expect(row(all, 5).duplicateOf).toMatch(/already has stock history/);
    expect(row(all, 6).errors.join()).toMatch(/repeated|at least 1/);

    const approved = await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth);
    expect(approved.body.data).toMatchObject({ status: "IMPORTED", importedRows: 2, stockDocumentId: expect.any(String) });
    const docId = approved.body.data.stockDocumentId as string;
    const doc = await prisma.stockDocument.findUnique({ where: { id: docId } });
    expect(doc).toMatchObject({ type: "OPENING", sourceType: "IMPORT", sourceId: up.body.data.id });

    const costOf = (variantId: string) => prisma.variantCost.findUnique({ where: { variantId } });
    expect(await costOf(a.id)).toMatchObject({ valuedQty: 5, unvaluedQty: 0 });
    expect(await costOf(b.id)).toMatchObject({ valuedQty: 0, unvaluedQty: 3 });

    const direct = await api().post(`/api/v1/inventory/documents/${docId}/reverse`).set(admin.auth).send({ reason: "x" });
    expect(direct.body.error.code).toBe("REVERSE_AT_SOURCE");

    await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "Counted the wrong shelf" }).expect(200);
    const stock = (await api().get(`/api/v1/inventory/variants/${a.id}`).set(admin.auth)).body.data.stock;
    expect(stock.physical).toBe(0);
    expect(await prisma.stockDocument.findFirst({ where: { reversalOfId: docId } })).toMatchObject({ type: "REVERSAL" });
  });

  it("won't roll back stock that has been sold since", async () => {
    const v = await newVariant("500");
    const up = await upload(
      "OPENING_STOCK",
      "s.csv",
      csv([
        ["sku", "quantity"],
        [v.sku, "5"],
      ]),
    );
    await check(up.body.data.id, { mapping: up.body.data.suggestedMapping, locationId: store }).expect(200);
    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth).expect(200);

    await api()
      .post("/api/v1/sales/pos")
      .set(admin.auth)
      .send({
        locationId: store,
        channel: "STORE",
        idempotencyKey: randomUUID(),
        lines: [{ variantId: v.id, quantity: 1 }],
        payments: [{ accountId: cash, amount: "500" }],
      })
      .expect(201);

    const rollback = await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "x" });
    expect(rollback.body.error.code).toBe("IMPORT_IN_USE");
    expect(rollback.body.error.message).toMatch(/has moved since/);
  });
});

describe("Customers import", () => {
  it("normalises what is there, invents nothing, skips known mobiles and removes them on rollback", async () => {
    const known = mobile();
    const existing = await api()
      .post("/api/v1/customers")
      .set(admin.auth)
      .send({ name: `Known ${uid()}`, mobile: known });
    const [m1, m2] = [mobile(), mobile()];
    const tag = uid();
    const up = await upload(
      "CUSTOMERS",
      "people.csv",
      csv([
        ["Customer Name", "Phone", "City", "State", "PIN", "Type"],
        [`Asha ${tag}`, `+91 ${m1.slice(0, 5)} ${m1.slice(5)}`, "Hyderabad", "Telangana", "500001", "Wholesale"],
        [`Ravi ${tag}`, "", "Pune", "27", "", ""],
        [`Dup ${tag}`, known, "", "", "", ""],
        ["", m2, "", "", "", ""],
        [`Bad ${tag}`, "12345", "", "Atlantis", "50", "VIP"],
        [`Twin ${tag}`, m1, "", "", "", ""],
      ]),
    );
    const checked = await check(up.body.data.id, { mapping: up.body.data.suggestedMapping });
    expect(checked.body.data).toMatchObject({ validRows: 2, errorRows: 3, duplicateRows: 1 });
    const all = await rows(up.body.data.id);
    expect(row(all, 4).duplicateOf).toBe(`Mobile already belongs to ${existing.body.data.code}`);
    expect(row(all, 5).errors).toContain("Name: Required");
    expect(row(all, 6).errors.length).toBeGreaterThanOrEqual(4);
    expect(row(all, 7).errors[0]).toMatch(/Mobile repeated \(first on line 2\)/);

    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth).expect(200);
    const asha = await prisma.customer.findFirst({ where: { name: `Asha ${tag}` } });
    expect(asha).toMatchObject({ mobile: `+91${m1}`, stateCode: "36", type: "WHOLESALE", email: null, whatsapp: null });
    const ravi = await prisma.customer.findFirst({ where: { name: `Ravi ${tag}` } });
    expect(ravi).toMatchObject({ mobile: null, stateCode: "27", type: "RETAIL", pincode: null });

    await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "Test list" }).expect(200);
    expect(await prisma.customer.count({ where: { name: { in: [`Asha ${tag}`, `Ravi ${tag}`] } } })).toBe(0);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: up.body.data.id, action: "import.rolled_back" } });
    expect(audit).not.toBeNull();
  });

  it("re-checks at approval and imports nothing when records changed since", async () => {
    const m = mobile();
    const up = await upload(
      "CUSTOMERS",
      "late.csv",
      csv([
        ["Name", "Mobile"],
        [`Late ${uid()}`, m],
      ]),
    );
    await check(up.body.data.id, { mapping: up.body.data.suggestedMapping }).expect(200);
    await api().post("/api/v1/customers").set(admin.auth).send({ name: "Walked in first", mobile: m }).expect(201);

    const approve = await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth);
    expect(approve.body.error.code).toBe("IMPORT_STALE");
    expect((await rows(up.body.data.id))[0]!.status).toBe("DUPLICATE");
    expect((await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth)).body.error.code).toBe("NOTHING_TO_IMPORT");
    await api().post(`/api/v1/imports/${up.body.data.id}/cancel`).set(admin.auth).expect(200);
  });
});

describe("Import guards", () => {
  it("refuses bad files and non-admins, and never deletes history", async () => {
    expect((await upload("CUSTOMERS", "people.txt", Buffer.from("a,b"))).body.error.code).toBe("IMPORT_FILE_INVALID");
    expect((await upload("CUSTOMERS", "empty.csv", Buffer.from("Name\n"))).body.error.message).toMatch(/no rows/);
    expect((await upload("CUSTOMERS", "dup.csv", Buffer.from("Name,name\nA,B"))).body.error.message).toMatch(/appears twice/);
    expect((await upload("CUSTOMERS", "people.csv", Buffer.from("Name\nA"), cashier)).status).toBe(403);
    expect((await api().get("/api/v1/imports").set(cashier.auth)).status).toBe(403);

    const up = await upload("CUSTOMERS", "keep.csv", Buffer.from(`Name\nKeep ${uid()}`));
    await expect(prisma.importBatch.delete({ where: { id: up.body.data.id } })).rejects.toThrow(/append-only/);
  });
});
