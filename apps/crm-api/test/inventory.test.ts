import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let categoryId: string;
let store: string;
let godown: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();

beforeAll(async () => {
  admin = await sessionAs("ADMIN");
  categoryId = (await api().post("/api/v1/categories").set(admin.auth).send({ name: `Stock ${uid()}` })).body.data.id;
  store = (await api().post("/api/v1/settings/locations").set(admin.auth).send({ code: `ST${uid()}`, name: "Store", type: "STORE" })).body.data.id;
  godown = (await api().post("/api/v1/settings/locations").set(admin.auth).send({ code: `GD${uid()}`, name: "Godown", type: "WAREHOUSE" })).body.data.id;
});

/** A YEGAO-style product: one variant per colour. Returns variant ids keyed by colour. */
async function colourProduct(colours = ["Red", "Blue", "Black", "White"]) {
  const prefix = `YG${uid()}`;
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({
      name: `YEGAO 1:64 ${prefix}`,
      categoryId,
      gstRate: "18",
      options: [{ name: "Colour", values: colours }],
      variants: colours.map((c) => ({ sku: `${prefix}-${c}`, optionValues: [c], regularPrice: "499" })),
    });
  const ids = Object.fromEntries(res.body.data.variants.map((v: { id: string; name: string }) => [v.name, v.id])) as Record<string, string>;
  return { productId: res.body.data.id as string, ids };
}

async function opening(lines: { variantId: string; quantity: number; unitCost?: string }[], locationId = store) {
  return api().post("/api/v1/inventory/opening").set(admin.auth).send({ locationId, lines });
}

async function card(variantId: string, session = admin) {
  return (await api().get(`/api/v1/inventory/variants/${variantId}`).set(session.auth)).body.data;
}

describe("opening stock and the parent total", () => {
  it("records 5 / 8 / 4 / 3 and the product shows 20", async () => {
    const { productId, ids } = await colourProduct();
    const res = await opening([
      { variantId: ids.Red!, quantity: 5, unitCost: "300" },
      { variantId: ids.Blue!, quantity: 8, unitCost: "300" },
      { variantId: ids.Black!, quantity: 4, unitCost: "300" },
      { variantId: ids.White!, quantity: 3, unitCost: "300" },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^STK-\d{5}$/);

    const product = (await api().get(`/api/v1/products/${productId}`).set(admin.auth)).body.data;
    expect(product.variants.map((v: { physicalQty: number }) => v.physicalQty)).toEqual([5, 8, 4, 3]);
    const list = (await api().get(`/api/v1/products?q=${product.code}`).set(admin.auth)).body.data.items[0];
    expect(list.physicalQty).toBe(20);
  });

  it("allows opening stock only once per item", async () => {
    const { ids } = await colourProduct(["Red"]);
    await opening([{ variantId: ids.Red!, quantity: 2 }]);
    const again = await opening([{ variantId: ids.Red!, quantity: 2 }]);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("OPENING_EXISTS");
  });

  it("rejects a future date", async () => {
    const { ids } = await colourProduct(["Red"]);
    const res = await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, businessDate: "2999-01-01", lines: [{ variantId: ids.Red!, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FUTURE_DATE");
  });
});

describe("stock list", () => {
  it("lists, sorts, filters by location and state, and exports", async () => {
    const { ids } = await colourProduct(["Red", "Blue"]);
    await opening([{ variantId: ids.Red!, quantity: 3, unitCost: "50" }]);
    await api().patch(`/api/v1/variants/${ids.Red}`).set(admin.auth).send({ reorderLevel: 5 }).expect(200);

    for (const sort of ["product:asc", "sku:desc", "physical:desc", "available:asc"]) {
      const res = await api().get(`/api/v1/inventory/stock?sort=${sort}`).set(admin.auth);
      expect(res.status).toBe(200);
    }

    const low = await api().get(`/api/v1/inventory/stock?state=LOW&locationId=${store}&limit=100`).set(admin.auth);
    const lowSkus = low.body.data.items.map((r: { variantId: string }) => r.variantId);
    expect(lowSkus).toContain(ids.Red);

    const out = await api().get("/api/v1/inventory/stock?state=OUT&limit=100").set(admin.auth);
    expect(out.body.data.items.every((r: { available: number }) => r.available <= 0)).toBe(true);

    const csv = await api().get("/api/v1/inventory/stock?format=csv").set(admin.auth);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("Avg landed cost");

    const summary = await api().get("/api/v1/inventory/summary").set(admin.auth);
    expect(summary.body.data.physical).toBeGreaterThan(0);
  });
});

describe("damaged and demo stock is never counted twice", () => {
  it("moving to damaged keeps physical stock and lowers sellable; the write-off removes it", async () => {
    const { ids } = await colourProduct(["Blue"]);
    await opening([{ variantId: ids.Blue!, quantity: 8, unitCost: "300" }]);

    const moved = await api()
      .post("/api/v1/inventory/status-changes")
      .set(admin.auth)
      .send({ locationId: store, fromBucket: "SELLABLE", toBucket: "DAMAGED", reason: "Box crushed", lines: [{ variantId: ids.Blue!, quantity: 2 }] });
    expect(moved.status).toBe(201);

    let stock = (await card(ids.Blue!)).stock;
    expect(stock).toMatchObject({ physical: 8, sellable: 6, damaged: 2, available: 6 });

    await api()
      .post("/api/v1/inventory/write-offs")
      .set(admin.auth)
      .send({ locationId: store, bucket: "DAMAGED", reasonCode: "DAMAGED", reason: "Unrepairable", lines: [{ variantId: ids.Blue!, quantity: 2 }] })
      .expect(201);

    const c = await card(ids.Blue!);
    stock = c.stock;
    expect(stock).toMatchObject({ physical: 6, sellable: 6, damaged: 0 });
    expect(c.reconciliation).toMatchObject({ opening: 8, writeOffs: 2, internalNet: 0, computedPhysical: 6, actualPhysical: 6 });
    expect(stock.stockValue).toBe("1800.00");
  });
});

describe("transfers and negative stock", () => {
  it("moves stock between locations without changing the total", async () => {
    const { ids } = await colourProduct(["Red"]);
    await opening([{ variantId: ids.Red!, quantity: 5 }]);
    await api()
      .post("/api/v1/inventory/transfers")
      .set(admin.auth)
      .send({ fromLocationId: store, toLocationId: godown, reason: "Restock godown", lines: [{ variantId: ids.Red!, quantity: 3 }] })
      .expect(201);

    const { stock } = await card(ids.Red!);
    expect(stock.physical).toBe(5);
    expect(stock.byLocation.map((l: { locationId: string; sellable: number }) => [l.locationId, l.sellable]).sort()).toEqual(
      [
        [store, 2],
        [godown, 3],
      ].sort(),
    );
  });

  it("refuses to move more than is there, and changes nothing", async () => {
    const { ids } = await colourProduct(["Red", "Blue"]);
    await opening([
      { variantId: ids.Red!, quantity: 5 },
      { variantId: ids.Blue!, quantity: 1 },
    ]);
    const res = await api()
      .post("/api/v1/inventory/transfers")
      .set(admin.auth)
      .send({
        fromLocationId: store,
        toLocationId: godown,
        reason: "Too many",
        lines: [
          { variantId: ids.Red!, quantity: 2 },
          { variantId: ids.Blue!, quantity: 4 },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STOCK_INSUFFICIENT");
    expect((await card(ids.Red!)).stock.byLocation).toHaveLength(1); // the Red line did not partially apply
  });

  it("never goes negative under concurrent removals", async () => {
    const { ids } = await colourProduct(["Red"]);
    await opening([{ variantId: ids.Red!, quantity: 5, unitCost: "100" }]);
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        api()
          .post("/api/v1/inventory/write-offs")
          .set(admin.auth)
          .send({ locationId: store, bucket: "SELLABLE", reasonCode: "MISSING", reason: "Race", lines: [{ variantId: ids.Red!, quantity: 2 }] }),
      ),
    );
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(2);
    const c = await card(ids.Red!);
    expect(c.stock.physical).toBe(1);
    expect(c.stock.stockValue).toBe("100.00");
  });
});

describe("costing", () => {
  it("keeps unknown-cost opening stock out of the average and issues it first", async () => {
    const { ids } = await colourProduct(["White"]);
    await opening([{ variantId: ids.White!, quantity: 3 }]); // cost unknown
    await api()
      .post("/api/v1/inventory/adjustments")
      .set(admin.auth)
      .send({ locationId: store, reasonCode: "FOUND", reason: "Found carton", lines: [{ variantId: ids.White!, quantity: 1 }] })
      .expect(201);

    let c = await card(ids.White!);
    expect(c.stock).toMatchObject({ physical: 4, unvaluedQty: 4, avgUnitCost: null, stockValue: "0.00" });

    const out = await api()
      .post("/api/v1/inventory/write-offs")
      .set(admin.auth)
      .send({ locationId: store, bucket: "SELLABLE", reasonCode: "MISSING", reason: "Lost", lines: [{ variantId: ids.White!, quantity: 2 }] });
    expect(out.body.data.lines[0]).toMatchObject({ quantity: -2, unitCost: null });
    c = await card(ids.White!);
    expect(c.stock.unvaluedQty).toBe(2);
  });
});

describe("reversals", () => {
  it("restores balances, links both documents, and happens only once", async () => {
    const { ids } = await colourProduct(["Black"]);
    await opening([{ variantId: ids.Black!, quantity: 4, unitCost: "250" }]);
    const transfer = await api()
      .post("/api/v1/inventory/transfers")
      .set(admin.auth)
      .send({ fromLocationId: store, toLocationId: godown, reason: "Oops", lines: [{ variantId: ids.Black!, quantity: 4 }] });

    const reversal = await api().post(`/api/v1/inventory/documents/${transfer.body.data.id}/reverse`).set(admin.auth).send({ reason: "Wrong location" });
    expect(reversal.status).toBe(201);
    expect(reversal.body.data).toMatchObject({ type: "REVERSAL", reversalOf: { code: transfer.body.data.code } });

    const { stock } = await card(ids.Black!);
    expect(stock.byLocation).toEqual([expect.objectContaining({ locationId: store, sellable: 4 })]);

    const again = await api().post(`/api/v1/inventory/documents/${transfer.body.data.id}/reverse`).set(admin.auth).send({ reason: "Again" });
    expect(again.body.error.code).toBe("ALREADY_REVERSED");
    const ofReversal = await api().post(`/api/v1/inventory/documents/${reversal.body.data.id}/reverse`).set(admin.auth).send({ reason: "Undo" });
    expect(ofReversal.body.error.code).toBe("CANNOT_REVERSE_REVERSAL");
  });

  it("restores cost when a write-off is reversed, and blocks reversing stock that is gone", async () => {
    const { ids } = await colourProduct(["Red"]);
    const open = await opening([{ variantId: ids.Red!, quantity: 4, unitCost: "250" }]);
    const writeOff = await api()
      .post("/api/v1/inventory/write-offs")
      .set(admin.auth)
      .send({ locationId: store, bucket: "SELLABLE", reasonCode: "MISSING", reason: "Missing", lines: [{ variantId: ids.Red!, quantity: 3 }] });

    const blocked = await api().post(`/api/v1/inventory/documents/${open.body.data.id}/reverse`).set(admin.auth).send({ reason: "Undo opening" });
    expect(blocked.body.error.code).toBe("STOCK_INSUFFICIENT");

    await api().post(`/api/v1/inventory/documents/${writeOff.body.data.id}/reverse`).set(admin.auth).send({ reason: "Found them" }).expect(201);
    const c = await card(ids.Red!);
    expect(c.stock).toMatchObject({ physical: 4, stockValue: "1000.00" });
    expect(c.reconciliation).toMatchObject({ writeOffs: 0, computedPhysical: 4, actualPhysical: 4 });
  });
});

describe("guards and roles", () => {
  it("won't archive a variant or deactivate a location that holds stock", async () => {
    const { ids } = await colourProduct(["Red", "Blue"]);
    await opening([{ variantId: ids.Red!, quantity: 1 }]);
    const archive = await api().patch(`/api/v1/variants/${ids.Red}`).set(admin.auth).send({ status: "ARCHIVED" });
    expect(archive.body.error.code).toBe("VARIANT_HAS_STOCK");
    const deactivate = await api().patch(`/api/v1/settings/locations/${store}`).set(admin.auth).send({ isActive: false });
    expect(deactivate.body.error.code).toBe("LOCATION_HAS_STOCK");
  });

  it("hides costs from cashiers and limits corrections to admins", async () => {
    const { ids } = await colourProduct(["Red"]);
    await opening([{ variantId: ids.Red!, quantity: 6, unitCost: "120" }]);
    const cashier = await sessionAs("CASHIER");
    const ops = await sessionAs("OPS");

    const cashierCard = await card(ids.Red!, cashier);
    expect(cashierCard.stock.physical).toBe(6);
    expect(cashierCard.stock).not.toHaveProperty("avgUnitCost");
    expect(cashierCard.stock).not.toHaveProperty("stockValue");

    const opsTransfer = await api()
      .post("/api/v1/inventory/transfers")
      .set(ops.auth)
      .send({ fromLocationId: store, toLocationId: godown, reason: "Move", lines: [{ variantId: ids.Red!, quantity: 1 }] });
    expect(opsTransfer.status).toBe(201);
    expect(opsTransfer.body.data.lines[0]).not.toHaveProperty("unitCost");

    const opsWriteOff = await api()
      .post("/api/v1/inventory/write-offs")
      .set(ops.auth)
      .send({ locationId: store, bucket: "SELLABLE", reasonCode: "MISSING", reason: "x", lines: [{ variantId: ids.Red!, quantity: 1 }] });
    expect(opsWriteOff.status).toBe(403);
  });
});

describe("ledger integrity", () => {
  it("is append-only", async () => {
    const row = await prisma.stockMovement.findFirstOrThrow();
    await expect(prisma.$executeRaw`UPDATE "StockMovement" SET quantity = 999 WHERE id = ${row.id}`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM "StockDocument" WHERE id = ${row.documentId}`).rejects.toThrow(/append-only/);
  });

  it("balances equal the sum of movements, and costed units equal physical units, for every variant", async () => {
    const drift = await prisma.$queryRaw<{ n: number }[]>`
      WITH m AS (SELECT "variantId", "locationId", bucket, SUM(quantity)::int AS qty FROM "StockMovement" GROUP BY 1, 2, 3)
      SELECT COUNT(*)::int AS n FROM m
      FULL JOIN "StockBalance" b USING ("variantId", "locationId", bucket)
      WHERE COALESCE(m.qty, 0) <> COALESCE(b.quantity, 0)`;
    expect(drift[0]!.n).toBe(0);

    const costDrift = await prisma.$queryRaw<{ n: number }[]>`
      WITH p AS (SELECT "variantId", SUM(quantity)::int AS qty FROM "StockBalance" GROUP BY 1)
      SELECT COUNT(*)::int AS n FROM "VariantCost" c LEFT JOIN p USING ("variantId")
      WHERE c."valuedQty" + c."unvaluedQty" <> COALESCE(p.qty, 0)`;
    expect(costDrift[0]!.n).toBe(0);
  });
});
