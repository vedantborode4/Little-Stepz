import { prisma, type Prisma } from "@repo/crm-db/client";
import type {
  ListQuery,
  SyncConflictDto,
  SyncDifferenceDto,
  SyncLinkDto,
  SyncLinkResultDto,
  SyncMode,
  SyncPlanDto,
  SyncRunDto,
  SyncRunStatus,
  SyncStatusDto,
} from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { ApiError, notFound, type RequestContext } from "../../core/http";
import { pageWindow, paginated } from "../../core/list";
import { dec } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { stockTotals } from "../inventory/inventory.service";
import { configuredSource, syncConnection, type WebsiteSource } from "./website-source";

/** How far back a dry run looks at website orders. */
const ORDER_WINDOW_DAYS = 90;
/** A link run must follow a recent dry run the owner has looked at. */
const DRY_RUN_VALID_MS = 24 * 60 * 60 * 1000;
const MAX_DIFFERENCES = 200;

const runInclude = { createdBy: { select: { name: true } } } satisfies Prisma.SyncRunInclude;
type RunRow = Prisma.SyncRunGetPayload<{ include: typeof runInclude }>;

function toRunDto(r: RunRow): SyncRunDto {
  const summary = (r.summary ?? null) as { plan?: SyncPlanDto; result?: SyncLinkResultDto } | null;
  return {
    id: r.id,
    code: r.code,
    source: r.source,
    mode: r.mode,
    status: r.status,
    plan: summary?.plan ?? null,
    result: summary?.result ?? null,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    createdByName: r.createdBy?.name ?? null,
  };
}

const sameMoney = (a: string | null, b: string | null) => (a === null || b === null ? a === b : dec(a).eq(dec(b)));

/**
 * Compares the website's catalogue and recent orders with the CRM without
 * changing anything. Variants are matched on SKU; a link is proposed only
 * when neither side is already linked to something else.
 */
export async function buildPlan(source: WebsiteSource): Promise<SyncPlanDto> {
  const since = new Date(Date.now() - ORDER_WINDOW_DAYS * 86_400_000).toISOString();
  const [websiteProducts, websiteOrders, crmVariants] = await Promise.all([
    source.fetchProducts(),
    source.fetchOrders(since),
    prisma.variant.findMany({
      where: { status: "ACTIVE", product: { status: { not: "ARCHIVED" } } },
      select: {
        id: true,
        sku: true,
        name: true,
        websiteVariantId: true,
        regularPrice: true,
        offerPrice: true,
        product: { select: { name: true, websiteProductId: true } },
      },
    }),
  ]);
  const stock = await stockTotals(crmVariants.map((v) => v.id));
  const bySku = new Map(crmVariants.map((v) => [v.sku, v]));
  const byWebsiteVariant = new Map(crmVariants.filter((v) => v.websiteVariantId).map((v) => [v.websiteVariantId!, v]));
  const productLinkedTo = new Map<string, string>();
  for (const v of crmVariants) if (v.product.websiteProductId) productLinkedTo.set(v.product.websiteProductId, v.product.name);

  const toLink: SyncLinkDto[] = [];
  const conflicts: SyncConflictDto[] = [];
  const websiteOnly: SyncPlanDto["products"]["websiteOnly"] = [];
  const differences: SyncDifferenceDto[] = [];
  const seenSkus = new Map<string, string>();
  let alreadyLinked = 0;
  let websiteVariants = 0;

  for (const p of websiteProducts) {
    for (const wv of p.variants) {
      websiteVariants++;
      const websiteName = `${p.name} — ${wv.name}`;
      const sku = wv.sku?.trim().toUpperCase() ?? "";
      const conflict = (reason: string) => conflicts.push({ sku: sku || "—", websiteVariantId: wv.id, websiteName, reason });
      if (!sku) {
        conflict("No SKU on the website");
        continue;
      }
      if (seenSkus.has(sku)) {
        conflict(`The website uses this SKU twice (also ${seenSkus.get(sku)})`);
        continue;
      }
      seenSkus.set(sku, websiteName);

      const crm = bySku.get(sku);
      if (!crm) {
        websiteOnly.push({ sku, websiteName });
        continue;
      }
      if (crm.websiteVariantId === wv.id) {
        alreadyLinked++;
        const available = stock.get(crm.id)?.available ?? 0;
        if (!sameMoney(crm.regularPrice.toString(), wv.price)) {
          differences.push({ sku, field: "regularPrice", crm: crm.regularPrice.toFixed(2), website: dec(wv.price).toFixed(2) });
        }
        if (!sameMoney(crm.offerPrice?.toString() ?? null, wv.salePrice)) {
          differences.push({
            sku,
            field: "offerPrice",
            crm: crm.offerPrice?.toFixed(2) ?? "—",
            website: wv.salePrice ? dec(wv.salePrice).toFixed(2) : "—",
          });
        }
        if (available !== wv.stock) differences.push({ sku, field: "stock", crm: String(available), website: String(wv.stock) });
        continue;
      }
      if (crm.websiteVariantId) {
        conflict(`The CRM's ${sku} is linked to another website variant (${crm.websiteVariantId})`);
        continue;
      }
      const holder = byWebsiteVariant.get(wv.id);
      if (holder) {
        conflict(`That website variant is already linked to ${holder.sku}`);
        continue;
      }
      if (crm.product.websiteProductId && crm.product.websiteProductId !== p.id) {
        conflict(`The CRM product is linked to another website product (${crm.product.websiteProductId})`);
        continue;
      }
      const productHolder = productLinkedTo.get(p.id);
      if (productHolder && productHolder !== crm.product.name) {
        conflict(`That website product is already linked to ${productHolder}`);
        continue;
      }
      toLink.push({
        sku,
        variantId: crm.id,
        crmName: `${crm.product.name} — ${crm.name}`,
        websiteProductId: p.id,
        websiteVariantId: wv.id,
        websiteName,
      });
    }
  }

  const orderRefs = websiteOrders.flatMap((o) => [o.orderNumber, o.id]);
  const inCrm = await prisma.salesOrder.findMany({ where: { externalRef: { in: orderRefs } }, select: { externalRef: true } });
  const known = new Set(inCrm.map((o) => o.externalRef));
  const alreadyInCrm = websiteOrders.filter((o) => known.has(o.orderNumber) || known.has(o.id)).length;

  return {
    fetchedAt: new Date().toISOString(),
    products: {
      websiteProducts: websiteProducts.length,
      websiteVariants,
      alreadyLinked,
      toLink,
      conflicts,
      websiteOnly,
      crmOnly: crmVariants.filter((v) => !seenSkus.has(v.sku)).length,
      differences: differences.slice(0, MAX_DIFFERENCES),
    },
    orders: {
      total: websiteOrders.length,
      preOrders: websiteOrders.filter((o) => o.isPreOrder).length,
      alreadyInCrm,
      notInCrm: websiteOrders.length - alreadyInCrm,
      paymentRefs: websiteOrders.reduce((n, o) => n + o.paymentRefs.length, 0),
    },
  };
}

async function recordRun(
  ctx: RequestContext,
  source: WebsiteSource,
  mode: SyncMode,
  status: SyncRunStatus,
  startedAt: Date,
  summary: { plan?: SyncPlanDto; result?: SyncLinkResultDto } | null,
  error: string | null,
  write?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const id = await withTransaction(async (tx) => {
    if (write) await write(tx);
    const run = await tx.syncRun.create({
      data: {
        code: await nextCode(tx, "SYN"),
        source: source.kind,
        mode,
        status,
        summary: (summary ?? undefined) as Prisma.InputJsonValue | undefined,
        error,
        startedAt,
        finishedAt: new Date(),
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: mode === "DRY_RUN" ? "sync.dry_run" : "sync.linked",
      entity: "SyncRun",
      entityId: run.id,
      after: { code: run.code, source: source.kind, status, linked: summary?.result?.linked, error },
    });
    return run.id;
  });
  return getRun(id);
}

/** Reads the website and reports what a sync would do. Nothing in the CRM or on the website changes. */
export async function dryRun(ctx: RequestContext, source: WebsiteSource = configuredSource()) {
  const startedAt = new Date();
  try {
    const plan = await buildPlan(source);
    return await recordRun(ctx, source, "DRY_RUN", "SUCCEEDED", startedAt, { plan }, null);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return recordRun(ctx, source, "DRY_RUN", "FAILED", startedAt, null, err.message);
  }
}

/**
 * Writes website ids onto CRM variants (and their products) for the links a
 * recent dry run proposed and that still hold now. Only from the live
 * website: demo data is never written into the CRM.
 */
export async function linkIds(dryRunId: string, ctx: RequestContext, source: WebsiteSource = configuredSource()) {
  if (source.kind !== "LIVE")
    throw new ApiError(409, "SYNC_DEMO_SOURCE", "Demo data is never written into the CRM; connect the live website to link IDs");
  const dry = await prisma.syncRun.findUnique({ where: { id: dryRunId } });
  if (!dry || dry.mode !== "DRY_RUN" || dry.status !== "SUCCEEDED" || dry.source !== "LIVE") {
    throw new ApiError(409, "SYNC_NEEDS_DRY_RUN", "Run a successful dry run against the website first");
  }
  if (Date.now() - dry.startedAt.getTime() > DRY_RUN_VALID_MS)
    throw new ApiError(409, "SYNC_NEEDS_DRY_RUN", "That dry run is over a day old; run a new one");

  const linkKey = (l: SyncLinkDto) => `${l.variantId}|${l.websiteVariantId}`;
  const reviewed = (dry.summary as { plan?: SyncPlanDto } | null)?.plan?.products.toLink ?? [];
  const reviewedKeys = new Set(reviewed.map(linkKey));
  const startedAt = new Date();
  const fresh = await buildPlan(source);
  const freshKeys = new Set(fresh.products.toLink.map(linkKey));
  const links = fresh.products.toLink.filter((l) => reviewedKeys.has(linkKey(l)));
  const skipped = reviewed.filter((l) => !freshKeys.has(linkKey(l))).map((l) => ({ sku: l.sku, reason: "No longer a clean match" }));

  return recordRun(
    ctx,
    source,
    "LINK_IDS",
    "SUCCEEDED",
    startedAt,
    { plan: fresh, result: { linked: links.length, skipped } },
    null,
    async (tx) => {
      for (const l of links) {
        await tx.variant.update({ where: { id: l.variantId }, data: { websiteVariantId: l.websiteVariantId } });
        await tx.product.updateMany({
          where: { variants: { some: { id: l.variantId } }, websiteProductId: null },
          data: { websiteProductId: l.websiteProductId },
        });
      }
    },
  );
}

export async function getRun(id: string): Promise<SyncRunDto> {
  const run = await prisma.syncRun.findUnique({ where: { id }, include: runInclude });
  if (!run) throw notFound("Sync run");
  return toRunDto(run);
}

export async function listRuns(query: ListQuery) {
  const [rows, total] = await Promise.all([
    prisma.syncRun.findMany({ include: runInclude, orderBy: { startedAt: "desc" }, ...pageWindow(query) }),
    prisma.syncRun.count(),
  ]);
  return paginated(rows.map(toRunDto), total, query);
}

export async function syncStatus(): Promise<SyncStatusDto> {
  const connection = syncConnection();
  const last = await prisma.syncRun.findFirst({ include: runInclude, orderBy: { startedAt: "desc" } });
  let host: string | null = null;
  if (connection === "LIVE") host = configuredSource().host;
  return { connection, host, canLink: connection === "LIVE", lastRun: last ? toRunDto(last) : null };
}
