import { randomUUID } from "crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Uploads need Cloudinary settings at boot; Cloudinary itself is replaced by a fake fetch below.
vi.hoisted(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
});

import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let categoryId: string;

const uid = () => randomUUID().slice(0, 8).toUpperCase();
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

interface CloudinaryCall {
  url: string;
  fields: Record<string, string>;
}
let calls: CloudinaryCall[] = [];

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Photos ${uid()}` })
  ).body.data.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
  calls = [];
});

function fakeCloudinary() {
  vi.stubGlobal("fetch", async (url: string, init: { body: FormData | URLSearchParams }) => {
    const fields: Record<string, string> = {};
    init.body.forEach((v, k) => {
      if (typeof v === "string") fields[k] = v;
    });
    calls.push({ url, fields });
    const publicId = `${fields.folder}/photo-${calls.length}`;
    const body = url.endsWith("/upload")
      ? { secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.png`, public_id: publicId }
      : { result: "ok" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
}

async function colourProduct() {
  const prefix = `PH${uid()}`;
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({
      name: `Photo car ${prefix}`,
      categoryId,
      gstRate: "18",
      options: [{ name: "Colour", values: ["Red", "Blue"] }],
      variants: ["Red", "Blue"].map((c) => ({ sku: `${prefix}-${c}`, optionValues: [c], regularPrice: "499" })),
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string; variants: { id: string; name: string }[] };
}

const upload = (productId: string, file: Buffer, session = admin, query: Record<string, string> = {}) =>
  api()
    .post(`/api/v1/products/${productId}/images`)
    .query(query)
    .set(session.auth)
    .set("Content-Type", "application/octet-stream")
    .send(file);
const detail = async (id: string) => (await api().get(`/api/v1/products/${id}`).set(admin.auth)).body.data;

describe("product photos", () => {
  it("uploads into the CRM's own Cloudinary folder, signed, and makes the first photo the main one", async () => {
    fakeCloudinary();
    const product = await colourProduct();

    const res = await upload(product.id, PNG);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual([expect.objectContaining({ source: "UPLOAD", position: 0, variantId: null })]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    expect(calls[0]!.fields).toMatchObject({ folder: `littlestepz-crm/products/${product.code}`, api_key: "test-key" });
    expect(calls[0]!.fields.signature).toMatch(/^[0-9a-f]{40}$/);

    const saved = await detail(product.id);
    expect(saved.imageUrl).toBe(res.body.data[0].url);
    expect(saved.images).toHaveLength(1);
  });

  it("refuses files that aren't photos without calling Cloudinary", async () => {
    fakeCloudinary();
    const product = await colourProduct();
    const res = await upload(product.id, Buffer.from("not a photo at all"));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IMAGE_INVALID");
    expect(calls).toHaveLength(0);
  });

  it("links photos to a colour, reorders the gallery and removes photos, deleting only what the CRM uploaded", async () => {
    fakeCloudinary();
    const product = await colourProduct();
    const [red, blue] = product.variants;
    const uploaded = (await upload(product.id, PNG, admin, { variantId: blue!.id })).body.data[0];
    const linked = await api()
      .post(`/api/v1/products/${product.id}/images/link`)
      .set(admin.auth)
      .send({ url: "https://www.littlestepz.in/red.jpg", variantId: red!.id });
    expect(linked.status).toBe(201);
    const link = linked.body.data[1];

    let saved = await detail(product.id);
    expect(saved.imageUrl).toBe(uploaded.url);
    expect(saved.variants.find((v: { id: string }) => v.id === red!.id).imageUrl).toBe(link.url);
    expect(saved.variants.find((v: { id: string }) => v.id === blue!.id).imageUrl).toBe(uploaded.url);

    const other = await colourProduct();
    const wrongVariant = await api()
      .patch(`/api/v1/products/${product.id}/images/${link.id}`)
      .set(admin.auth)
      .send({ variantId: other.variants[0]!.id });
    expect(wrongVariant.body.error.code).toBe("INVALID_VARIANT");

    const stale = await api()
      .put(`/api/v1/products/${product.id}/images/order`)
      .set(admin.auth)
      .send({ imageIds: [link.id] });
    expect(stale.body.error.code).toBe("PHOTOS_CHANGED");
    await api()
      .put(`/api/v1/products/${product.id}/images/order`)
      .set(admin.auth)
      .send({ imageIds: [link.id, uploaded.id] })
      .expect(200);
    expect((await detail(product.id)).imageUrl).toBe(link.url);

    calls = [];
    await api().delete(`/api/v1/products/${product.id}/images/${link.id}`).set(admin.auth).expect(200);
    expect(calls).toHaveLength(0);
    saved = await detail(product.id);
    expect(saved.imageUrl).toBe(uploaded.url);
    expect(saved.images).toEqual([expect.objectContaining({ id: uploaded.id, position: 0 })]);

    await api().delete(`/api/v1/products/${product.id}/images/${uploaded.id}`).set(admin.auth).expect(200);
    expect(calls).toEqual([
      expect.objectContaining({
        url: "https://api.cloudinary.com/v1_1/test-cloud/image/destroy",
        fields: expect.objectContaining({ public_id: `littlestepz-crm/products/${product.code}/photo-1` }),
      }),
    ]);
    saved = await detail(product.id);
    expect(saved.imageUrl).toBeNull();
    expect(saved.images).toEqual([]);
  });

  it("keeps photo changes to catalogue managers", async () => {
    fakeCloudinary();
    const product = await colourProduct();
    expect((await upload(product.id, PNG, cashier)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
