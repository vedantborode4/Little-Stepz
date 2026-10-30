import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let ops: TestSession;

const uid = () => randomUUID().slice(0, 6).toUpperCase();

beforeAll(async () => {
  [admin, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("OPS")]);
});

/** Each test counts its own fresh location and category, so nothing else is in scope. */
async function setup(items: { stock: number; unitCost?: string }[]) {
  const [location, category] = await Promise.all([
    api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `SC${uid()}`, name: "Count shelf", type: "STORE" }),
    api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Count ${uid()}` }),
  ]);
  const locationId = location.body.data.id as string;
  const categoryId = category.body.data.id as string;
  const variants: string[] = [];
  for (const it of items) {
    const res = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ name: `Counted ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `CNT-${uid()}`, regularPrice: "500" }] });
    const variantId = res.body.data.variants[0].id as string;
    if (it.stock) {
      await api()
        .post("/api/v1/inventory/opening")
        .set(admin.auth)
        .send({ locationId, lines: [{ variantId, quantity: it.stock, unitCost: it.unitCost ?? "200" }] });
    }
    variants.push(variantId);
  }
  return { locationId, categoryId, variants };
}

const create = (body: Record<string, unknown>, session = ops) => api().post("/api/v1/stock-counts").set(session.auth).send(body);
const save = (id: string, lines: { lineId: string; countedQty: number | null }[], session = ops) =>
  api().put(`/api/v1/stock-counts/${id}/counts`).set(session.auth).send({ lines });
const sellable = async (variantId: string) =>
  (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data.stock.sellable;
const lineFor = (count: { lines: { id: string; variantId: string }[] }, variantId: string) =>
  count.lines.find((l) => l.variantId === variantId)!.id;

describe("Scenario H — a counted correction is in the ledger and the audit log, and can be reversed", () => {
  it("posts the difference on approval and undoes it on reversal", async () => {
    const { locationId, categoryId, variants } = await setup([{ stock: 10 }, { stock: 4 }]);
    const [shortItem, rightItem] = variants as [string, string];

    const created = await create({ locationId, categoryId });
    expect(created.status).toBe(201);
    const count = created.body.data;
    expect(count).toMatchObject({
      code: expect.stringMatching(/^CNT-\d{4}$/),
      status: "OPEN",
      blind: true,
      lineCount: 2,
      showSystem: false,
    });
    expect(count.lines[0].systemQty).toBeUndefined();

    await save(count.id, [
      { lineId: lineFor(count, shortItem), countedQty: 8 },
      { lineId: lineFor(count, rightItem), countedQty: 4 },
    ]);
    expect((await api().post(`/api/v1/stock-counts/${count.id}/submit`).set(ops.auth)).body.data.status).toBe("SUBMITTED");
    expect((await api().post(`/api/v1/stock-counts/${count.id}/approve`).set(ops.auth).send({ reason: "x" })).status).toBe(403);

    const review = (await api().get(`/api/v1/stock-counts/${count.id}`).set(admin.auth)).body.data;
    expect(review).toMatchObject({ showSystem: true, unitsShort: 2, unitsOver: 0, valueImpact: "-400.00" });

    const approved = await api()
      .post(`/api/v1/stock-counts/${count.id}/approve`)
      .set(admin.auth)
      .send({ reason: "Monthly count", lines: [{ lineId: lineFor(count, shortItem), reasonCode: "MISSING", note: "Not on shelf" }] });
    expect(approved.body.data).toMatchObject({ status: "APPROVED", adjustmentDocument: { code: expect.stringMatching(/^STK-/) } });
    expect(await sellable(shortItem)).toBe(8);
    expect(await sellable(rightItem)).toBe(4);

    const docId = approved.body.data.adjustmentDocument.id as string;
    const ledger = await api().get("/api/v1/inventory/ledger").query({ variantId: shortItem }).set(admin.auth);
    expect(ledger.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ documentId: docId, type: "ADJUSTMENT", quantity: -2 })]),
    );
    const audit = await prisma.auditLog.findMany({ where: { OR: [{ entityId: count.id }, { entityId: docId }] } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["stockcount.approved", "stock.posted"]));

    const fromInventory = await api().post(`/api/v1/inventory/documents/${docId}/reverse`).set(admin.auth).send({ reason: "x" });
    expect(fromInventory.body.error.code).toBe("REVERSE_AT_SOURCE");

    const reversed = await api()
      .post(`/api/v1/stock-counts/${count.id}/reverse`)
      .set(admin.auth)
      .send({ reason: "Found the 2 in the back room" });
    expect(reversed.body.data).toMatchObject({ status: "REVERSED", reversalDocument: { code: expect.stringMatching(/^STK-/) } });
    expect(await sellable(shortItem)).toBe(10);
    expect((await api().post(`/api/v1/stock-counts/${count.id}/reverse`).set(admin.auth).send({ reason: "again" })).body.error.code).toBe(
      "INVALID_STATUS",
    );
  });
});

describe("count rules", () => {
  it("shows the system figures to counters once a count is finished, or straight away when it isn't blind", async () => {
    const { locationId, categoryId } = await setup([{ stock: 3 }]);
    const open = (await create({ locationId, categoryId, blind: false })).body.data;
    expect(open.lines[0].systemQty).toBe(3);
    expect(open.lines[0].unitCost).toBeUndefined();
  });

  it("brings in found stock at the average cost, including an item that wasn't on the list", async () => {
    const { locationId, categoryId, variants } = await setup([{ stock: 2, unitCost: "300" }, { stock: 0 }]);
    const [onList, notOnList] = variants as [string, string];
    const count = (await create({ locationId, categoryId })).body.data;
    expect(count.lineCount).toBe(1);
    const added = await api().post(`/api/v1/stock-counts/${count.id}/lines`).set(ops.auth).send({ variantId: notOnList });
    expect(added.body.data.lineCount).toBe(2);
    await save(count.id, [
      { lineId: lineFor(added.body.data, onList), countedQty: 3 },
      { lineId: lineFor(added.body.data, notOnList), countedQty: 1 },
    ]);
    await api().post(`/api/v1/stock-counts/${count.id}/submit`).set(ops.auth);
    await api().post(`/api/v1/stock-counts/${count.id}/approve`).set(admin.auth).send({ reason: "Count" });
    expect(await sellable(onList)).toBe(3);
    expect(await sellable(notOnList)).toBe(1);
    const cost = await prisma.variantCost.findUniqueOrThrow({ where: { variantId: onList } });
    expect(cost).toMatchObject({ valuedQty: 3 });
    expect(cost.totalValue.toString()).toBe("900");
  });

  it("needs every line counted to submit, and can be sent back for a recount", async () => {
    const { locationId, categoryId, variants } = await setup([{ stock: 5 }, { stock: 5 }]);
    const count = (await create({ locationId, categoryId })).body.data;
    await save(count.id, [{ lineId: lineFor(count, variants[0]!), countedQty: 5 }]);
    const early = await api().post(`/api/v1/stock-counts/${count.id}/submit`).set(ops.auth);
    expect(early.body.error).toMatchObject({ code: "UNCOUNTED_LINES", details: { missing: 1 } });
    await save(count.id, [{ lineId: lineFor(count, variants[1]!), countedQty: 0 }]);
    await api().post(`/api/v1/stock-counts/${count.id}/submit`).set(ops.auth);
    expect((await save(count.id, [{ lineId: lineFor(count, variants[1]!), countedQty: 5 }])).body.error.code).toBe("INVALID_STATUS");
    const back = await api().post(`/api/v1/stock-counts/${count.id}/send-back`).set(admin.auth).send({ reason: "Recount shelf B" });
    expect(back.body.data.status).toBe("OPEN");
    expect((await save(count.id, [{ lineId: lineFor(count, variants[1]!), countedQty: 5 }])).status).toBe(200);
  });

  it("approves a count with no differences without posting anything, and only once", async () => {
    const { locationId, categoryId, variants } = await setup([{ stock: 7 }]);
    const count = (await create({ locationId, categoryId })).body.data;
    await save(count.id, [{ lineId: lineFor(count, variants[0]!), countedQty: 7 }]);
    await api().post(`/api/v1/stock-counts/${count.id}/submit`).set(ops.auth);
    const [a, b] = await Promise.all([
      api().post(`/api/v1/stock-counts/${count.id}/approve`).set(admin.auth).send({ reason: "Count" }),
      api().post(`/api/v1/stock-counts/${count.id}/approve`).set(admin.auth).send({ reason: "Count" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const done = (await api().get(`/api/v1/stock-counts/${count.id}`).set(admin.auth)).body.data;
    expect(done).toMatchObject({ status: "APPROVED", adjustmentDocument: null });
    expect((await api().post(`/api/v1/stock-counts/${count.id}/reverse`).set(admin.auth).send({ reason: "x" })).body.error.code).toBe(
      "NOTHING_TO_REVERSE",
    );
    const lineId = lineFor(done, variants[0]!);
    await expect(prisma.stockCountLine.update({ where: { id: lineId }, data: { countedQty: 1 } })).rejects.toThrow(/locked/);
  });

  it("refuses an empty count and keeps cancelled counts on record", async () => {
    const { locationId, categoryId } = await setup([{ stock: 0 }]);
    expect((await create({ locationId, categoryId })).body.error.code).toBe("NOTHING_TO_COUNT");
    const count = (await create({ locationId, categoryId, includeZero: true })).body.data;
    expect(count.lineCount).toBe(1);
    const cancelled = await api().post(`/api/v1/stock-counts/${count.id}/cancel`).set(ops.auth).send({ reason: "Started by mistake" });
    expect(cancelled.body.data).toMatchObject({ status: "CANCELLED", cancelReason: "Started by mistake" });
    await expect(prisma.stockCount.delete({ where: { id: count.id } })).rejects.toThrow();
  });

  it("keeps counting away from cashiers", async () => {
    const cashier = await sessionAs("CASHIER");
    expect((await api().get("/api/v1/stock-counts").set(cashier.auth)).status).toBe(403);
  });
});
