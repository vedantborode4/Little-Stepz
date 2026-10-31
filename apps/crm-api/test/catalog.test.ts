import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let categoryId: string;

const uid = () => randomUUID().slice(0, 8).toUpperCase();

beforeAll(async () => {
  admin = await sessionAs("ADMIN");
  const res = await api()
    .post("/api/v1/categories")
    .set(admin.auth)
    .send({ name: `Die-cast ${uid()}` });
  categoryId = res.body.data.id;
});

function colourProduct(prefix: string, colours = ["Red", "Blue", "Black", "White"]) {
  return {
    name: `YEGAO 1:64 ${prefix}`,
    categoryId,
    scale: "1:64",
    gstRate: "18",
    options: [{ name: "Colour", values: colours }],
    variants: colours.map((c) => ({ sku: `${prefix}-${c}`, optionValues: [c], regularPrice: "499", offerPrice: "449" })),
  };
}

async function createColourProduct(prefix = `YG${uid()}`) {
  const res = await api().post("/api/v1/products").set(admin.auth).send(colourProduct(prefix));
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("products and variants", () => {
  it("creates a product with one variant per colour, each with its own SKU and price history", async () => {
    const product = await createColourProduct();

    expect(product.code).toMatch(/^PRD-\d{4}$/);
    expect(product.variants.map((v: { name: string }) => v.name)).toEqual(["Red", "Blue", "Black", "White"]);
    expect(product.variants[0].sku).toBe(product.variants[0].sku.toUpperCase());

    const history = await prisma.priceChange.count({ where: { variantId: { in: product.variants.map((v: { id: string }) => v.id) } } });
    expect(history).toBe(8); // regular + offer for each of 4 variants
  });

  it("rejects a SKU that already exists, case-insensitively", async () => {
    const product = await createColourProduct();
    const res = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ name: "Clash", categoryId, gstRate: "18", variants: [{ sku: product.variants[0].sku.toLowerCase(), regularPrice: "10" }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SKU_TAKEN");
  });

  it("validates price order and option combinations", async () => {
    const offerTooHigh = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ name: "Bad", categoryId, gstRate: "18", variants: [{ sku: `BAD-${uid()}`, regularPrice: "100", offerPrice: "120" }] });
    expect(offerTooHigh.status).toBe(400);

    const missingOption = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ ...colourProduct(`MX${uid()}`), variants: [{ sku: `MX-${uid()}`, optionValues: [], regularPrice: "10" }] });
    expect(missingOption.status).toBe(400);

    const twoVariantsNoOptions = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({
        name: "Bad",
        categoryId,
        gstRate: "18",
        variants: [
          { sku: `A-${uid()}`, regularPrice: "1" },
          { sku: `B-${uid()}`, regularPrice: "1" },
        ],
      });
    expect(twoVariantsNoOptions.status).toBe(400);
  });

  it("enforces offer <= regular in the database too", async () => {
    const product = await createColourProduct();
    await expect(prisma.$executeRaw`UPDATE "Variant" SET "offerPrice" = 999999 WHERE id = ${product.variants[0].id}`).rejects.toThrow(
      /Variant_prices_valid/,
    );
  });

  it("adds a variant for a new colour and refuses a duplicate combination", async () => {
    const product = await createColourProduct();
    const added = await api()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(admin.auth)
      .send({ sku: `${product.variants[0].sku}-GRN`, optionValues: ["Green"], regularPrice: "499" });
    expect(added.status).toBe(201);
    expect(added.body.data.options[0].values.map((v: { value: string }) => v.value)).toContain("Green");

    const dup = await api()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(admin.auth)
      .send({ sku: `DUP-${uid()}`, optionValues: ["green"], regularPrice: "499" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("COMBINATION_EXISTS");
  });

  it("records each price edit in an append-only history", async () => {
    const product = await createColourProduct();
    const blue = product.variants[1];
    await api().patch(`/api/v1/variants/${blue.id}`).set(admin.auth).send({ offerPrice: "399", reason: "Diwali" }).expect(200);

    const history = await api().get(`/api/v1/variants/${blue.id}/price-history`).set(admin.auth);
    expect(history.body.data[0]).toMatchObject({ field: "OFFER", oldPrice: "449.00", newPrice: "399.00", reason: "Diwali" });

    await expect(prisma.$executeRaw`DELETE FROM "PriceChange" WHERE "variantId" = ${blue.id}`).rejects.toThrow(/append-only/);
  });

  it("keeps at least one active variant on a product", async () => {
    const res = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ name: "Single", categoryId, gstRate: "18", variants: [{ sku: `ONE-${uid()}`, regularPrice: "50" }] });
    const only = res.body.data.variants[0];
    const archive = await api().patch(`/api/v1/variants/${only.id}`).set(admin.auth).send({ status: "ARCHIVED" });
    expect(archive.status).toBe(409);
    expect(archive.body.error.code).toBe("LAST_ACTIVE_VARIANT");
  });

  it("validates wholesale quantity tiers", async () => {
    const product = await createColourProduct();
    const red = product.variants[0];
    const ok = await api()
      .put(`/api/v1/variants/${red.id}/tiers`)
      .set(admin.auth)
      .send({
        tiers: [
          { minQty: 10, price: "400" },
          { minQty: 50, price: "360" },
        ],
      });
    expect(ok.status).toBe(200);
    expect(ok.body.data.variants[0].priceTiers).toEqual([
      { minQty: 10, price: "400.00" },
      { minQty: 50, price: "360.00" },
    ]);

    const rising = await api()
      .put(`/api/v1/variants/${red.id}/tiers`)
      .set(admin.auth)
      .send({
        tiers: [
          { minQty: 10, price: "300" },
          { minQty: 50, price: "360" },
        ],
      });
    expect(rising.status).toBe(400);
    const aboveRegular = await api()
      .put(`/api/v1/variants/${red.id}/tiers`)
      .set(admin.auth)
      .send({ tiers: [{ minQty: 5, price: "600" }] });
    expect(aboveRegular.status).toBe(400);
  });
});

describe("bulk price edit", () => {
  it("previews, applies exactly the confirmed rows, and refuses a stale preview", async () => {
    const category = await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Bulk ${uid()}` });
    const prefix = `BK${uid()}`;
    const created = await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ ...colourProduct(prefix, ["Red", "Blue"]), categoryId: category.body.data.id });
    expect(created.status).toBe(201);

    const preview = await api()
      .post("/api/v1/pricing/bulk/preview")
      .set(admin.auth)
      .send({ categoryId: category.body.data.id, field: "OFFER", operation: "PERCENT_OFF_REGULAR", value: "15", roundToRupee: true });
    expect(preview.status).toBe(200);
    expect(preview.body.data).toHaveLength(2);
    expect(preview.body.data[0]).toMatchObject({ oldPrice: "449.00", newPrice: "424.00", error: null }); // 499 × 0.85 = 424.15 → ₹424

    const changes = preview.body.data.map((r: { variantId: string; oldPrice: string; newPrice: string }) => ({
      variantId: r.variantId,
      expectedOldPrice: r.oldPrice,
      newPrice: r.newPrice,
    }));
    const apply = await api().post("/api/v1/pricing/bulk/apply").set(admin.auth).send({ field: "OFFER", reason: "Sale", changes });
    expect(apply.body.data.updated).toBe(2);

    const stale = await api().post("/api/v1/pricing/bulk/apply").set(admin.auth).send({ field: "OFFER", changes });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("PRICE_CHANGED_SINCE_PREVIEW");

    const batch = await prisma.priceChange.findMany({ where: { batchId: apply.body.data.batchId } });
    expect(batch).toHaveLength(2);
  });

  it("flags rows that would break price rules instead of applying them", async () => {
    const category = await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Rules ${uid()}` });
    await api()
      .post("/api/v1/products")
      .set(admin.auth)
      .send({ ...colourProduct(`RL${uid()}`, ["Red"]), categoryId: category.body.data.id });

    const preview = await api()
      .post("/api/v1/pricing/bulk/preview")
      .set(admin.auth)
      .send({ categoryId: category.body.data.id, field: "REGULAR", operation: "SET_AMOUNT", value: "400" });
    expect(preview.body.data[0].error).toBe("Below the current offer price");
  });
});

describe("categories and website mapping", () => {
  it("treats category names case-insensitively", async () => {
    const name = `Blocks ${uid()}`;
    await api().post("/api/v1/categories").set(admin.auth).send({ name }).expect(201);
    const dup = await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `  ${name.toLowerCase()} ` });
    expect(dup.status).toBe(409);
  });

  it("maps variants to website ids and blocks reusing an id", async () => {
    const product = await createColourProduct();
    const [red, blue] = product.variants;
    const websiteVariantId = randomUUID();

    const set = await api()
      .put(`/api/v1/variants/${red.id}/mapping`)
      .set(admin.auth)
      .send({ websiteProductId: randomUUID(), websiteVariantId });
    expect(set.body.data.state).toBe("MAPPED");

    const reuse = await api().put(`/api/v1/variants/${blue.id}/mapping`).set(admin.auth).send({ websiteVariantId });
    expect(reuse.status).toBe(409);
    expect(reuse.body.error.code).toBe("WEBSITE_ID_IN_USE");

    const partial = await api().get(`/api/v1/website-mapping?state=PARTIAL&q=${blue.sku}`).set(admin.auth);
    expect(partial.body.data.items.map((r: { sku: string }) => r.sku)).toContain(blue.sku);
  });
});

describe("catalog permissions", () => {
  it("lets every role read products but only admins change them", async () => {
    const cashier = await sessionAs("CASHIER");
    const ops = await sessionAs("OPS");
    expect((await api().get("/api/v1/products").set(cashier.auth)).status).toBe(200);
    expect((await api().post("/api/v1/products").set(cashier.auth).send({})).status).toBe(403);
    expect((await api().post("/api/v1/pricing/bulk/preview").set(ops.auth).send({})).status).toBe(403);
    expect((await api().get("/api/v1/website-mapping").set(ops.auth)).status).toBe(403);
  });
});

describe("GST by category", () => {
  const send = (method: "post" | "patch", path: string, body: object) => api()[method](`/api/v1${path}`).set(admin.auth).send(body);
  const simple = (category: string, gstRate: string | null) => ({
    name: `Tumbler ${uid()}`,
    categoryId: category,
    gstRate,
    variants: [{ sku: `TB-${uid()}`, regularPrice: "1999" }],
  });

  it("lets products follow their category's rate or keep their own, and moves followers when the rate changes", async () => {
    const bottles = (await send("post", "/categories", { name: `Bottles ${uid()}`, gstRate: "12" })).body.data;
    expect(bottles).toMatchObject({ gstRate: "12" });

    const follower = (await send("post", "/products", simple(bottles.id, null))).body.data;
    const ownRate = (await send("post", "/products", simple(bottles.id, "18"))).body.data;
    expect(follower).toMatchObject({ gstRate: "12", gstFromCategory: true });
    expect(ownRate).toMatchObject({ gstRate: "18", gstFromCategory: false });

    await send("patch", `/categories/${bottles.id}`, { gstRate: "5" }).expect(200);
    const rate = async (id: string) => (await api().get(`/api/v1/products/${id}`).set(admin.auth)).body.data;
    expect(await rate(follower.id)).toMatchObject({ gstRate: "5", gstFromCategory: true });
    expect(await rate(ownRate.id)).toMatchObject({ gstRate: "18", gstFromCategory: false });

    const cleared = await send("patch", `/categories/${bottles.id}`, { gstRate: null });
    expect(cleared.body.error.code).toBe("CATEGORY_RATE_IN_USE");

    // Clearing a product's own rate makes it follow; moving a follower takes the new category's rate.
    await send("patch", `/products/${ownRate.id}`, { gstRate: null }).expect(200);
    expect(await rate(ownRate.id)).toMatchObject({ gstRate: "5", gstFromCategory: true });
    const premium = (await send("post", "/categories", { name: `Premium ${uid()}`, gstRate: "28" })).body.data;
    await send("patch", `/products/${follower.id}`, { categoryId: premium.id }).expect(200);
    expect(await rate(follower.id)).toMatchObject({ gstRate: "28", gstFromCategory: true });
  });

  it("asks for a rate when neither the product nor its category has one", async () => {
    const res = await send("post", "/products", simple(categoryId, null));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "GST_RATE_REQUIRED", details: { fieldErrors: { gstRate: [expect.any(String)] } } });
  });
});
