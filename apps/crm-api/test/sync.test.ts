import { randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import type { RequestContext } from "../src/core/http";
import { ApiError } from "../src/core/http";
import { dryRun, linkIds } from "../src/modules/sync/sync.service";
import type { WebsiteProduct, WebsiteSource } from "../src/modules/sync/website-source";
import { api, createUser, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ctx: RequestContext;
let categoryId: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();

beforeAll(async () => {
  [admin, cashier] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER")]);
  const owner = await createUser("ADMIN");
  ctx = { userId: owner.id, ip: "127.0.0.1", requestId: "sync-test", userAgent: "vitest" };
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Sync ${uid()}` })
  ).body.data.id;
});

async function product(sku: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Synced ${sku}`, categoryId, gstRate: "18", variants: [{ sku, regularPrice: "999", ...extra }] });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; variants: { id: string }[] };
}

/** A stand-in for the live website: same contract, data under the test's control. */
function liveSource(products: WebsiteProduct[]): WebsiteSource {
  return {
    kind: "LIVE",
    host: "website.test",
    fetchProducts: async () => products,
    fetchOrders: async () => [
      {
        id: "o-1",
        orderNumber: `WEB-${uid()}`,
        status: "DELIVERED",
        isPreOrder: false,
        total: "999",
        placedAt: "2026-10-20T00:00:00Z",
        paymentRefs: ["pay_1"],
      },
      {
        id: "o-2",
        orderNumber: `WEB-${uid()}`,
        status: "BOOKED",
        isPreOrder: true,
        total: "500",
        placedAt: "2026-10-21T00:00:00Z",
        paymentRefs: ["pay_2", "pay_3"],
      },
    ],
  };
}

const variant = (id: string, sku: string | null, price = "999", stock = 0) => ({ id, sku, name: "Default", price, salePrice: null, stock });

describe("Website sync (read-only)", () => {
  it("dry-runs against the demo source, writes nothing and refuses to link demo data", async () => {
    const status = await api().get("/api/v1/sync/status").set(admin.auth);
    expect(status.body.data).toMatchObject({ connection: "MOCK", canLink: false });

    const run = await api().post("/api/v1/sync/dry-run").set(admin.auth);
    expect(run.status).toBe(201);
    expect(run.body.data).toMatchObject({
      code: expect.stringMatching(/^SYN-\d{4}$/),
      source: "MOCK",
      mode: "DRY_RUN",
      status: "SUCCEEDED",
    });
    expect(run.body.data.plan.products.websiteVariants).toBe(7);
    expect(run.body.data.plan.orders).toMatchObject({ total: 3, preOrders: 1, paymentRefs: 3 });

    const link = await api().post("/api/v1/sync/link-ids").set(admin.auth).send({ dryRunId: run.body.data.id });
    expect(link.body.error.code).toBe("SYNC_DEMO_SOURCE");
    expect((await api().post("/api/v1/sync/dry-run").set(cashier.auth)).status).toBe(403);
  });

  it("plans links, conflicts and website-only items, then links only what was reviewed", async () => {
    const s = uid();
    const fresh = await product(`FR-${s}`);
    const linked = await product(`LK-${s}`, { websiteVariantId: `w-lk-${s}` });
    const clash = await product(`CL-${s}`, { websiteVariantId: `w-other-${s}` });
    const late = await product(`LT-${s}`);

    const source = liveSource([
      { id: `wp-fr-${s}`, name: "Fresh", status: "ACTIVE", variants: [variant(`w-fr-${s}`, `fr-${s}`.toUpperCase())] },
      { id: `wp-lk-${s}`, name: "Linked", status: "ACTIVE", variants: [variant(`w-lk-${s}`, `LK-${s}`, "1099", 4)] },
      { id: `wp-cl-${s}`, name: "Clash", status: "ACTIVE", variants: [variant(`w-cl-${s}`, `CL-${s}`)] },
      { id: `wp-lt-${s}`, name: "Late", status: "ACTIVE", variants: [variant(`w-lt-${s}`, `LT-${s}`)] },
      {
        id: `wp-new-${s}`,
        name: "Website only",
        status: "ACTIVE",
        variants: [variant(`w-new-${s}`, `NEW-${s}`), variant(`w-nosku-${s}`, null)],
      },
    ]);

    const dry = await dryRun(ctx, source);
    expect(dry.status).toBe("SUCCEEDED");
    const plan = dry.plan!.products;
    expect(plan.toLink.map((l) => l.sku).sort()).toEqual([`FR-${s}`, `LT-${s}`]);
    expect(plan.conflicts.map((c) => c.sku)).toEqual(expect.arrayContaining(["—", `CL-${s}`]));
    expect(plan.conflicts).toHaveLength(2);
    expect(plan.websiteOnly).toEqual([{ sku: `NEW-${s}`, websiteName: "Website only — Default" }]);
    expect(plan.alreadyLinked).toBe(1);
    expect(plan.differences).toEqual(
      expect.arrayContaining([
        { sku: `LK-${s}`, field: "regularPrice", crm: "999.00", website: "1099.00" },
        { sku: `LK-${s}`, field: "stock", crm: "0", website: "4" },
      ]),
    );
    expect(dry.plan!.orders).toMatchObject({ total: 2, preOrders: 1, alreadyInCrm: 0, paymentRefs: 3 });
    // A dry run changes nothing in the CRM.
    expect((await prisma.variant.findUnique({ where: { id: fresh.variants[0]!.id } }))!.websiteVariantId).toBeNull();

    // Someone links "late" by hand between the review and the link run.
    await prisma.variant.update({ where: { id: late.variants[0]!.id }, data: { websiteVariantId: `manual-${s}` } });

    const result = await linkIds(dry.id, ctx, source);
    expect(result).toMatchObject({
      mode: "LINK_IDS",
      status: "SUCCEEDED",
      result: { linked: 1, skipped: [{ sku: `LT-${s}` }] },
    });
    const linkedVariant = await prisma.variant.findUnique({ where: { id: fresh.variants[0]!.id }, include: { product: true } });
    expect(linkedVariant).toMatchObject({ websiteVariantId: `w-fr-${s}` });
    expect(linkedVariant!.product.websiteProductId).toBe(`wp-fr-${s}`);
    expect((await prisma.variant.findUnique({ where: { id: clash.variants[0]!.id } }))!.websiteVariantId).toBe(`w-other-${s}`);
    expect(linked.id).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({ where: { entityId: result.id, action: "sync.linked" } });
    expect(audit).not.toBeNull();
  });

  it("records a failed pull and never edits a run", async () => {
    const broken: WebsiteSource = {
      kind: "LIVE",
      host: "website.test",
      fetchProducts: async () => {
        throw new ApiError(502, "SYNC_UNAUTHORISED", "The website refused the CRM service key");
      },
      fetchOrders: async () => [],
    };
    const run = await dryRun(ctx, broken);
    expect(run).toMatchObject({ status: "FAILED", error: "The website refused the CRM service key", plan: null });
    expect((await linkIds(run.id, ctx, liveSource([])).catch((e: ApiError) => e)).code).toBe("SYNC_NEEDS_DRY_RUN");
    await expect(prisma.syncRun.update({ where: { id: run.id }, data: { error: null } })).rejects.toThrow(/append-only/);
  });
});
