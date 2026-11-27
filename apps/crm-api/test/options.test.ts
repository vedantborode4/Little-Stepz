import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let categoryId: string;
let store: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();

interface Variant {
  id: string;
  sku: string;
  name: string;
  status: string;
  physicalQty: number;
}
interface Option {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

beforeAll(async () => {
  admin = await sessionAs("ADMIN");
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Options ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `OP${uid()}`, name: "Store", type: "STORE" })
  ).body.data.id;
});

async function simpleProduct() {
  const sku = `SPC${uid()}`;
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Spectre ${sku}`, categoryId, gstRate: "18", variants: [{ sku, regularPrice: "14999" }] });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; variants: Variant[]; options: Option[] };
}

async function colourProduct(colours = ["Red", "Blue"]) {
  const prefix = `OP${uid()}`;
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({
      name: `Car ${prefix}`,
      categoryId,
      gstRate: "18",
      options: [{ name: "Colour", values: colours }],
      variants: colours.map((c) => ({ sku: `${prefix}-${c}`, optionValues: [c], regularPrice: "499" })),
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; variants: Variant[]; options: Option[] };
}

const addOption = (productId: string, name: string, existingValue: string) =>
  api().post(`/api/v1/products/${productId}/options`).set(admin.auth).send({ name, existingValue });

const names = (variants: Variant[]) => variants.map((v) => v.name).sort();

describe("adding an option to a saved product", () => {
  it("turns a simple product's Default variant into the first value, keeping its SKU and stock", async () => {
    const product = await simpleProduct();
    const only = product.variants[0]!;
    await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, lines: [{ variantId: only.id, quantity: 3, unitCost: "9000" }] })
      .expect(201);

    const res = await addOption(product.id, "Colour", "Red");
    expect(res.status).toBe(201);
    expect(res.body.data.options).toMatchObject([{ name: "Colour", values: [{ value: "Red" }] }]);
    expect(res.body.data.variants).toMatchObject([{ id: only.id, sku: only.sku, name: "Red", physicalQty: 3 }]);

    const blue = await api()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(admin.auth)
      .send({ sku: `${only.sku}-BLUE`, optionValues: ["Blue"], regularPrice: "14999" });
    expect(blue.status).toBe(201);
    expect(names(blue.body.data.variants)).toEqual(["Blue", "Red"]);

    const audit = await prisma.auditLog.findFirst({ where: { entityId: product.id, action: "product.option_added" } });
    expect(audit).not.toBeNull();
  });

  it("gives every variant, archived ones too, the existing value of a second option", async () => {
    const product = await colourProduct(["Red", "Blue", "Black"]);
    const black = product.variants.find((v) => v.name === "Black")!;
    await api().patch(`/api/v1/variants/${black.id}`).set(admin.auth).send({ status: "ARCHIVED" }).expect(200);

    const res = await addOption(product.id, "Size", "Standard");
    expect(res.status).toBe(201);
    expect(names(res.body.data.variants)).toEqual(["Black / Standard", "Blue / Standard", "Red / Standard"]);

    const large = await api()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(admin.auth)
      .send({ sku: `L${uid()}`, optionValues: ["Red", "Large"], regularPrice: "599" });
    expect(large.status).toBe(201);
  });

  it("refuses a duplicate name, a fourth option and an archived product", async () => {
    const product = await colourProduct();
    expect((await addOption(product.id, "colour", "x")).body.error.code).toBe("OPTION_EXISTS");
    await addOption(product.id, "Size", "S").expect(201);
    await addOption(product.id, "Pack", "Single").expect(201);
    const fourth = await addOption(product.id, "Finish", "Gloss");
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe("TOO_MANY_OPTIONS");

    const simple = await simpleProduct();
    await api().patch(`/api/v1/products/${simple.id}`).set(admin.auth).send({ status: "ARCHIVED" }).expect(200);
    expect((await addOption(simple.id, "Colour", "Red")).body.error.code).toBe("PRODUCT_ARCHIVED");
  });

  it("is admin-only", async () => {
    const product = await simpleProduct();
    const cashier = await sessionAs("CASHIER");
    const res = await api().post(`/api/v1/products/${product.id}/options`).set(cashier.auth).send({ name: "Colour", existingValue: "Red" });
    expect(res.status).toBe(403);
  });
});

describe("renaming and reordering options", () => {
  it("renames options and values, renaming the variants that use the value", async () => {
    const product = await colourProduct(["Red", "Blu"]);
    const colour = product.options[0]!;
    const blu = colour.values.find((v) => v.value === "Blu")!;

    const value = await api()
      .patch(`/api/v1/products/${product.id}/options/${colour.id}/values/${blu.id}`)
      .set(admin.auth)
      .send({ value: "Blue" });
    expect(value.status).toBe(200);
    expect(names(value.body.data.variants)).toEqual(["Blue", "Red"]);

    const caseOnly = await api()
      .patch(`/api/v1/products/${product.id}/options/${colour.id}/values/${blu.id}`)
      .set(admin.auth)
      .send({ value: "BLUE" });
    expect(caseOnly.status).toBe(200);

    const clash = await api()
      .patch(`/api/v1/products/${product.id}/options/${colour.id}/values/${blu.id}`)
      .set(admin.auth)
      .send({ value: "red" });
    expect(clash.body.error.code).toBe("VALUE_EXISTS");

    const renamed = await api().patch(`/api/v1/products/${product.id}/options/${colour.id}`).set(admin.auth).send({ name: "Body colour" });
    expect(renamed.body.data.options[0].name).toBe("Body colour");
  });

  it("reorders options and the variant names follow", async () => {
    const product = await colourProduct(["Red"]);
    const withSize = (await addOption(product.id, "Size", "M")).body.data;
    expect(withSize.variants[0].name).toBe("Red / M");

    const ids = withSize.options.map((o: Option) => o.id).reverse();
    const res = await api().put(`/api/v1/products/${product.id}/options/order`).set(admin.auth).send({ optionIds: ids });
    expect(res.status).toBe(200);
    expect(res.body.data.options.map((o: Option) => o.name)).toEqual(["Size", "Colour"]);
    expect(res.body.data.variants[0].name).toBe("M / Red");

    const partial = await api()
      .put(`/api/v1/products/${product.id}/options/order`)
      .set(admin.auth)
      .send({ optionIds: [ids[0]] });
    expect(partial.body.error.code).toBe("OPTION_ORDER_INVALID");
  });
});

describe("removing values and options", () => {
  it("removes a value by archiving its variants, and refuses while one has stock", async () => {
    const product = await colourProduct(["Red", "Blue", "Green"]);
    const colour = product.options[0]!;
    const valueId = (v: string) => colour.values.find((x) => x.value === v)!.id;
    const blue = product.variants.find((v) => v.name === "Blue")!;
    await api()
      .post("/api/v1/inventory/opening")
      .set(admin.auth)
      .send({ locationId: store, lines: [{ variantId: blue.id, quantity: 1, unitCost: "300" }] })
      .expect(201);

    const stocked = await api()
      .delete(`/api/v1/products/${product.id}/options/${colour.id}/values/${valueId("Blue")}`)
      .set(admin.auth);
    expect(stocked.status).toBe(409);
    expect(stocked.body.error.code).toBe("VARIANT_HAS_STOCK");

    const green = await api()
      .delete(`/api/v1/products/${product.id}/options/${colour.id}/values/${valueId("Green")}`)
      .set(admin.auth);
    expect(green.status).toBe(200);
    expect(green.body.data.variants.find((v: Variant) => v.name === "Green").status).toBe("ARCHIVED");

    const again = await api()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(admin.auth)
      .send({ sku: `G${uid()}`, optionValues: ["Green"], regularPrice: "499" });
    expect(again.body.error.message).toMatch(/archived/);
  });

  it("keeps at least one active variant", async () => {
    const product = await colourProduct(["Red"]);
    const colour = product.options[0]!;
    const res = await api().delete(`/api/v1/products/${product.id}/options/${colour.id}/values/${colour.values[0]!.id}`).set(admin.auth);
    expect(res.body.error.code).toBe("LAST_ACTIVE_VARIANT");
  });

  it("removes an option only when the variants stay distinct", async () => {
    const product = await colourProduct(["Red", "Blue"]);
    const colour = product.options[0]!;
    const merge = await api().delete(`/api/v1/products/${product.id}/options/${colour.id}`).set(admin.auth);
    expect(merge.status).toBe(409);
    expect(merge.body.error.code).toBe("OPTION_STILL_NEEDED");

    const withSize = (await addOption(product.id, "Size", "Standard")).body.data;
    const size = withSize.options.find((o: Option) => o.name === "Size");
    const removed = await api().delete(`/api/v1/products/${product.id}/options/${size.id}`).set(admin.auth);
    expect(removed.status).toBe(200);
    expect(removed.body.data.options.map((o: Option) => o.name)).toEqual(["Colour"]);
    expect(names(removed.body.data.variants)).toEqual(["Blue", "Red"]);
  });

  it("turns a single-variant product back into a simple product when its last option goes", async () => {
    const product = await simpleProduct();
    const withColour = (await addOption(product.id, "Colour", "Red")).body.data;
    const res = await api().delete(`/api/v1/products/${product.id}/options/${withColour.options[0].id}`).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.options).toEqual([]);
    expect(res.body.data.variants).toMatchObject([{ sku: product.variants[0]!.sku, name: "Default" }]);
    const row = await prisma.variant.findUniqueOrThrow({ where: { id: product.variants[0]!.id } });
    expect(row.optionKey).toBe("");
  });
});
