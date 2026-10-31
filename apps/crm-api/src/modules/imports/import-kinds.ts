import { prisma, Prisma, type Tx } from "@repo/crm-db/client";
import {
  createCustomerSchema,
  createProductSchema,
  IMPORT_FIELDS,
  INDIAN_STATES,
  skuSchema,
  type CreateCustomerInput,
  type CreateProductInput,
  type ImportKind,
} from "@repo/crm-schema";
import type { z } from "zod";
import type { RequestContext } from "../../core/http";
import { createCustomerInTx } from "../customers/customers.service";
import { recordOpeningStockInTx, reverseDocumentInTx } from "../inventory/inventory.service";
import { lockVariants } from "../inventory/stock-engine";
import { createProductInTx } from "../products/products.service";

type Db = Tx | typeof prisma;

/** A data row with its values re-keyed by target field (unmapped fields absent). */
export interface FieldRow {
  line: number;
  fields: Record<string, string>;
}

export interface RowResult {
  status: "VALID" | "ERROR" | "DUPLICATE";
  errors: string[];
  duplicateOf: string | null;
}

/** Rows that are created together (a product and its variants, one customer, all opening stock). */
interface Unit<P> {
  rows: number[];
  payload: P;
}

export interface CheckOutcome<P = unknown> {
  results: RowResult[];
  units: Unit<P>[];
}

export interface Created {
  /** Row index → entity it created. */
  entities: Map<number, { entity: string; id: string }>;
  stockDocumentId?: string;
}

export interface BatchRef {
  id: string;
  code: string;
  locationId: string | null;
  stockDocumentId: string | null;
}

export interface CreatedRow {
  createdEntity: string | null;
  createdEntityId: string | null;
}

interface KindHandler<P> {
  check(rows: FieldRow[], batch: BatchRef): Promise<CheckOutcome<P>>;
  create(tx: Tx, ctx: RequestContext, batch: BatchRef, units: Unit<P>[]): Promise<Created>;
  /**
   * Locks the rows any new use of the batch's records must touch, so nothing
   * can start using them between the rollback's blocker check and the rollback.
   */
  lockForRollback(tx: Tx, batch: BatchRef, rows: CreatedRow[]): Promise<void>;
  /** Why the batch can't be undone any more, or null when it can. */
  rollbackBlocker(db: Db, batch: BatchRef, rows: CreatedRow[]): Promise<string | null>;
  rollback(tx: Tx, ctx: RequestContext, batch: BatchRef, rows: CreatedRow[], reason: string): Promise<void>;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const ok = (): RowResult => ({ status: "VALID", errors: [], duplicateOf: null });
const fail = (r: RowResult, message: string) => {
  r.status = "ERROR";
  r.errors.push(message);
};
const duplicate = (r: RowResult, of: string) => {
  if (r.status === "VALID") r.status = "DUPLICATE";
  r.duplicateOf = of;
};

const labelOf = (kind: ImportKind, key: string) => IMPORT_FIELDS[kind].find((f) => f.key === key)?.label ?? key;

/** "₹1,250.00", "Rs 1250" and "1 250" all mean 1250; anything else is left for the schema to reject. */
const moneyCell = (v: string | undefined) => (v ?? "").replace(/₹|rs\.?|inr/gi, "").replace(/[,\s]/g, "");
const numberCell = (v: string | undefined) => (v ?? "").replace(/[,\s]/g, "");
/** "18%", "18.00" and "18" are the same GST rate. */
const gstCell = (v: string | undefined) =>
  numberCell(v)
    .replace(/%$/, "")
    .replace(/^\d+(\.\d+)?$/, (m) => String(Number(m)));
const blankToUndefined = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : v.trim());

function issueMessages(kind: ImportKind, error: z.ZodError, fieldFor: (path: PropertyKey[]) => string | null) {
  return error.issues.map((i) => {
    const key = fieldFor(i.path);
    return key ? `${labelOf(kind, key)}: ${i.message}` : i.message;
  });
}

// ─── Products & variants ─────────────────────────────────────────────────────

const VARIANT_FIELD: Record<string, string> = {
  sku: "sku",
  regularPrice: "regularPrice",
  offerPrice: "offerPrice",
  wholesalePrice: "wholesalePrice",
  reorderLevel: "reorderLevel",
  websiteVariantId: "websiteVariantId",
  optionValues: "optionValue",
};
const PRODUCT_FIELD: Record<string, string> = {
  name: "productName",
  categoryId: "category",
  brandId: "brand",
  gstRate: "gstRate",
  hsnCode: "hsnCode",
  scale: "scale",
  description: "description",
  websiteProductId: "websiteProductId",
  options: "optionName",
};

/** The archived SKU is renamed with a character SKUs can't contain, so the original code is free to import again. */
export const rolledBackSku = (sku: string, batchCode: string) => `${sku}~${batchCode}`;

const products: KindHandler<CreateProductInput> = {
  async check(rows) {
    const results = rows.map(ok);
    const [categories, brands] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    const categoryId = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const brandId = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));

    const skus = rows.map((r) => skuSchema.safeParse(r.fields.sku ?? "").data ?? null);
    const names = [...new Set(rows.map((r) => (r.fields.productName ?? "").trim().toLowerCase()).filter(Boolean))];
    const websiteVariantIds = rows.map((r) => blankToUndefined(r.fields.websiteVariantId)).filter((v): v is string => Boolean(v));
    const websiteProductIds = rows.map((r) => blankToUndefined(r.fields.websiteProductId)).filter((v): v is string => Boolean(v));
    const [existingSkus, existingProducts, takenVariantIds, takenProductIds] = await Promise.all([
      prisma.variant.findMany({ where: { sku: { in: skus.filter((s): s is string => Boolean(s)) } }, select: { sku: true } }),
      prisma.product.findMany({
        where: { status: { not: "ARCHIVED" }, OR: names.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })) },
        select: { name: true, code: true },
      }),
      prisma.variant.findMany({ where: { websiteVariantId: { in: websiteVariantIds } }, select: { websiteVariantId: true, sku: true } }),
      prisma.product.findMany({ where: { websiteProductId: { in: websiteProductIds } }, select: { websiteProductId: true, code: true } }),
    ]);
    const skuTaken = new Set(existingSkus.map((v) => v.sku));
    const productTaken = new Map(existingProducts.map((p) => [p.name.toLowerCase(), p.code]));
    const variantIdTaken = new Map(takenVariantIds.map((v) => [v.websiteVariantId!, v.sku]));
    const productIdTaken = new Map(takenProductIds.map((p) => [p.websiteProductId!, p.code]));

    const firstLineOfSku = new Map<string, number>();
    rows.forEach((row, i) => {
      const r = results[i]!;
      const sku = skus[i];
      if (sku && firstLineOfSku.has(sku)) fail(r, `SKU ${sku} is repeated (first on line ${firstLineOfSku.get(sku)})`);
      else if (sku) firstLineOfSku.set(sku, row.line);
      if (sku && skuTaken.has(sku)) duplicate(r, `SKU ${sku} already exists`);
      const wv = blankToUndefined(row.fields.websiteVariantId);
      if (wv && variantIdTaken.has(wv)) fail(r, `Website variant ID ${wv} is already on ${variantIdTaken.get(wv)}`);
      const wp = blankToUndefined(row.fields.websiteProductId);
      if (wp && productIdTaken.has(wp)) fail(r, `Website product ID ${wp} is already on ${productIdTaken.get(wp)}`);
    });

    // Rows sharing a product name become one product with one variant per row.
    const groups = new Map<string, number[]>();
    rows.forEach((row, i) => {
      const key = (row.fields.productName ?? "").trim().toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });

    const units: Unit<CreateProductInput>[] = [];
    for (const [key, indexes] of groups) {
      const groupRows = indexes.map((i) => rows[i]!);
      const first = groupRows[0]!.fields;
      const groupResults = indexes.map((i) => results[i]!);

      if (key && productTaken.has(key)) {
        for (const r of groupResults) duplicate(r, `Product already exists (${productTaken.get(key)}); add variants from its page`);
        continue;
      }

      for (const [field, label] of [
        ["category", "category"],
        ["gstRate", "GST rate"],
        ["brand", "brand"],
      ] as const) {
        const values = new Set(
          groupRows.map((r) => (field === "gstRate" ? gstCell(r.fields[field]) : (r.fields[field] ?? "").trim().toLowerCase())),
        );
        if (values.size > 1) groupResults.forEach((r) => fail(r, `Rows of the same product have different ${label}s`));
      }
      const category = (first.category ?? "").trim();
      const brand = (first.brand ?? "").trim();
      const unknownCategory = Boolean(category) && !categoryId.has(category.toLowerCase());
      const unknownBrand = Boolean(brand) && !brandId.has(brand.toLowerCase());
      if (unknownCategory) groupResults.forEach((r) => fail(r, `Unknown category "${category}"; add it in Products first`));
      if (unknownBrand) groupResults.forEach((r) => fail(r, `Unknown brand "${brand}"; add it in Products first`));

      const multi = groupRows.length > 1 || groupRows.some((r) => blankToUndefined(r.fields.optionValue));
      const optionValues = [...new Set(groupRows.map((r) => (r.fields.optionValue ?? "").trim()).filter(Boolean))];
      const input = {
        name: first.productName ?? "",
        categoryId: categoryId.get(category.toLowerCase()) ?? "",
        brandId: brand ? (brandId.get(brand.toLowerCase()) ?? "") : null,
        scale: first.scale ?? "",
        hsnCode: first.hsnCode ?? "",
        gstRate: gstCell(first.gstRate),
        description: first.description ?? "",
        websiteProductId: first.websiteProductId ?? "",
        options: multi
          ? [
              {
                name: blankToUndefined(groupRows.find((r) => blankToUndefined(r.fields.optionName))?.fields.optionName) ?? "Variant",
                values: optionValues,
              },
            ]
          : [],
        variants: groupRows.map((r) => ({
          sku: r.fields.sku ?? "",
          optionValues: multi ? [(r.fields.optionValue ?? "").trim()] : [],
          regularPrice: moneyCell(r.fields.regularPrice),
          offerPrice: moneyCell(r.fields.offerPrice),
          wholesalePrice: moneyCell(r.fields.wholesalePrice),
          reorderLevel: numberCell(r.fields.reorderLevel) || undefined,
          websiteVariantId: r.fields.websiteVariantId ?? "",
        })),
      };

      const parsed = createProductSchema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const [head, index, leaf] = issue.path;
          if (head === "variants" && typeof index === "number") {
            const key = typeof leaf === "string" ? VARIANT_FIELD[leaf] : undefined;
            fail(groupResults[index]!, key ? `${labelOf("PRODUCTS", key)}: ${issue.message}` : issue.message);
          } else if (!(head === "categoryId" && unknownCategory) && !(head === "brandId" && unknownBrand)) {
            const key = typeof head === "string" ? PRODUCT_FIELD[head] : undefined;
            const message = key ? `${labelOf("PRODUCTS", key)}: ${issue.message}` : issue.message;
            groupResults.forEach((r) => fail(r, message));
          }
        }
      }

      // A product is created whole or not at all: one bad or duplicate row holds back its siblings.
      const blocker = groupRows.find((_, j) => groupResults[j]!.status !== "VALID");
      if (blocker) {
        groupResults.forEach((r) => {
          if (r.status === "VALID") fail(r, `Another row of this product (line ${blocker.line}) can't be imported`);
        });
        continue;
      }
      if (parsed.success) units.push({ rows: indexes, payload: parsed.data });
    }
    return { results, units };
  },

  async create(tx, ctx, _batch, units) {
    const entities: Created["entities"] = new Map();
    for (const unit of units) {
      const productId = await createProductInTx(tx, unit.payload, ctx);
      const variants = await tx.variant.findMany({ where: { productId }, select: { id: true, sku: true } });
      const bySku = new Map(variants.map((v) => [v.sku, v.id]));
      unit.rows.forEach((rowIndex, j) => entities.set(rowIndex, { entity: "Variant", id: bySku.get(unit.payload.variants[j]!.sku)! }));
    }
    return { entities };
  },

  async lockForRollback(tx, _batch, rows) {
    // New sale lines, movements and prices key-share these rows, so they wait for the rollback.
    const variantIds = rows.filter((r) => r.createdEntity === "Variant").map((r) => r.createdEntityId!);
    if (variantIds.length) await tx.$queryRaw`SELECT id FROM "Variant" WHERE id IN (${Prisma.join(variantIds)}) ORDER BY id FOR UPDATE`;
  },

  async rollbackBlocker(db, _batch, rows) {
    const variantIds = rows.filter((r) => r.createdEntity === "Variant").map((r) => r.createdEntityId!);
    const used = await db.variant.findFirst({
      where: {
        id: { in: variantIds },
        OR: [
          { stockMovements: { some: {} } },
          { salesOrderLines: { some: {} } },
          { purchaseLines: { some: {} } },
          { customerPrices: { some: {} } },
          { stockCountLines: { some: {} } },
        ],
      },
      select: { sku: true },
    });
    return used ? `${used.sku} has been used since (stock, sales, purchases or prices); archive it from the product page instead` : null;
  },

  async rollback(tx, _ctx, batch, rows) {
    const variantIds = rows.filter((r) => r.createdEntity === "Variant").map((r) => r.createdEntityId!);
    const variants = await tx.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, productId: true } });
    for (const v of variants) {
      await tx.variant.update({
        where: { id: v.id },
        data: { status: "ARCHIVED", sku: rolledBackSku(v.sku, batch.code), websiteVariantId: null },
      });
    }
    const productIds = [...new Set(variants.map((v) => v.productId))];
    await tx.product.updateMany({ where: { id: { in: productIds } }, data: { status: "ARCHIVED", websiteProductId: null } });
  },
};

// ─── Opening stock ───────────────────────────────────────────────────────────

interface OpeningPayload {
  variantId: string;
  quantity: number;
  unitCost: string | null;
}

const IMPORT_SOURCE = "IMPORT";

const openingStock: KindHandler<OpeningPayload> = {
  async check(rows) {
    const results = rows.map(ok);
    const skus = rows.map((r) => skuSchema.safeParse(r.fields.sku ?? "").data ?? null);
    const variants = await prisma.variant.findMany({
      where: { sku: { in: skus.filter((s): s is string => Boolean(s)) } },
      select: { id: true, sku: true, status: true, product: { select: { status: true } }, _count: { select: { stockMovements: true } } },
    });
    const bySku = new Map(variants.map((v) => [v.sku, v]));

    const units: Unit<OpeningPayload>[] = [];
    const firstLine = new Map<string, number>();
    rows.forEach((row, i) => {
      const r = results[i]!;
      const sku = skus[i];
      if (!sku) fail(r, `SKU: ${(row.fields.sku ?? "").trim() ? "not a valid SKU" : "Required"}`);
      const variant = sku ? bySku.get(sku) : undefined;
      if (sku && !variant) fail(r, `SKU ${sku} not found; import or add the product first`);
      if (variant && (variant.status !== "ACTIVE" || variant.product.status === "ARCHIVED")) fail(r, `${sku} is archived`);
      if (sku && firstLine.has(sku)) fail(r, `SKU ${sku} is repeated (first on line ${firstLine.get(sku)})`);
      else if (sku) firstLine.set(sku, row.line);

      const qtyText = numberCell(row.fields.quantity);
      const quantity = Number(qtyText);
      if (!qtyText) fail(r, "Quantity: Required");
      else if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) fail(r, "Quantity: a whole number of at least 1");

      const costText = moneyCell(row.fields.unitCost);
      if (costText && !/^\d{1,12}(\.\d{1,2})?$/.test(costText)) fail(r, "Landed unit cost: an amount with at most 2 decimals");

      if (variant && variant._count.stockMovements > 0) duplicate(r, `${sku} already has stock history; use an adjustment`);
      if (r.status === "VALID" && variant)
        units.push({ rows: [i], payload: { variantId: variant.id, quantity, unitCost: costText || null } });
    });
    return { results, units };
  },

  async create(tx, ctx, batch, units) {
    if (units.length === 0) return { entities: new Map() };
    const doc = await recordOpeningStockInTx(
      tx,
      {
        locationId: batch.locationId!,
        bucket: "SELLABLE",
        reference: batch.code,
        notes: `Imported from ${batch.code}`,
        lines: units.map((u) => u.payload),
      },
      ctx,
      { type: IMPORT_SOURCE, id: batch.id },
    );
    const entities: Created["entities"] = new Map();
    units.forEach((u) => entities.set(u.rows[0]!, { entity: "StockDocument", id: doc.id }));
    return { entities, stockDocumentId: doc.id };
  },

  async lockForRollback(tx, batch) {
    if (!batch.stockDocumentId) return;
    // The stock engine's own per-variant lock: every posting takes it first, in the same order, so no movement
    // (including one into a location with no balance row yet) can slip in after the check, and nothing deadlocks.
    const lines = await tx.stockMovement.findMany({ where: { documentId: batch.stockDocumentId }, select: { variantId: true } });
    if (lines.length) await lockVariants(tx, [...new Set(lines.map((l) => l.variantId))]);
  },

  async rollbackBlocker(db, batch) {
    if (!batch.stockDocumentId) return null;
    const lines = await db.stockMovement.findMany({ where: { documentId: batch.stockDocumentId }, select: { variantId: true } });
    const moved = await db.stockMovement.findFirst({
      where: { variantId: { in: lines.map((l) => l.variantId) }, documentId: { not: batch.stockDocumentId } },
      select: { variant: { select: { sku: true } } },
    });
    return moved
      ? `Stock of ${moved.variant.sku} has moved since (a sale, transfer or adjustment); correct it with an adjustment instead`
      : null;
  },

  async rollback(tx, ctx, batch, _rows, reason) {
    if (batch.stockDocumentId) await reverseDocumentInTx(tx, ctx, batch.stockDocumentId, `Import ${batch.code} rolled back: ${reason}`);
  },
};

// ─── Customers ───────────────────────────────────────────────────────────────

const stateByName = new Map(INDIAN_STATES.flatMap((s) => [[s.name.toLowerCase(), s.code] as const, [s.code, s.code] as const]));

const CUSTOMER_FIELD: Record<string, string> = { stateCode: "state" };

const customers: KindHandler<CreateCustomerInput> = {
  async check(rows) {
    const results = rows.map(ok);
    const parsed = rows.map((row, i) => {
      const f = row.fields;
      const state = (f.state ?? "").trim();
      const type = (f.type ?? "").trim().toLowerCase();
      const r = results[i]!;
      if (state && !stateByName.has(state.toLowerCase()) && !stateByName.has(state.padStart(2, "0")))
        fail(r, `State: "${state}" is not an Indian state`);
      if (type && type !== "retail" && type !== "wholesale") fail(r, `Type: "${f.type}" should be Retail or Wholesale`);
      const result = createCustomerSchema.safeParse({
        name: f.name ?? "",
        mobile: f.mobile ?? "",
        whatsapp: f.whatsapp ?? "",
        email: f.email ?? "",
        addressLine: f.addressLine ?? "",
        city: f.city ?? "",
        stateCode: state ? (stateByName.get(state.toLowerCase()) ?? stateByName.get(state.padStart(2, "0")) ?? "") : "",
        pincode: numberCell(f.pincode),
        type: type === "wholesale" ? "WHOLESALE" : "RETAIL",
        creditDays: numberCell(f.creditDays),
        creditLimit: moneyCell(f.creditLimit),
        notes: f.notes ?? "",
      });
      if (!result.success) {
        issueMessages("CUSTOMERS", result.error, (path) => {
          const key = String(path[0] ?? "");
          return CUSTOMER_FIELD[key] ?? (IMPORT_FIELDS.CUSTOMERS.some((x) => x.key === key) ? key : null);
        }).forEach((m) => fail(r, m));
      }
      return result.success ? result.data : null;
    });

    const mobiles = parsed.map((p) => p?.mobile).filter((m): m is string => Boolean(m));
    const existing = await prisma.customer.findMany({ where: { mobile: { in: mobiles } }, select: { mobile: true, code: true } });
    const taken = new Map(existing.map((c) => [c.mobile!, c.code]));

    const units: Unit<CreateCustomerInput>[] = [];
    const firstLine = new Map<string, number>();
    parsed.forEach((p, i) => {
      const r = results[i]!;
      const mobile = p?.mobile;
      if (mobile && firstLine.has(mobile)) fail(r, `Mobile repeated (first on line ${firstLine.get(mobile)})`);
      else if (mobile) firstLine.set(mobile, rows[i]!.line);
      if (mobile && taken.has(mobile)) duplicate(r, `Mobile already belongs to ${taken.get(mobile)}`);
      if (r.status === "VALID" && p) units.push({ rows: [i], payload: p });
    });
    return { results, units };
  },

  async create(tx, ctx, _batch, units) {
    const entities: Created["entities"] = new Map();
    for (const unit of units) entities.set(unit.rows[0]!, { entity: "Customer", id: await createCustomerInTx(tx, unit.payload, ctx) });
    return { entities };
  },

  async lockForRollback(tx, _batch, rows) {
    // New orders, payments and prices key-share these rows, so they wait for the rollback.
    const ids = rows.filter((r) => r.createdEntity === "Customer").map((r) => r.createdEntityId!);
    if (ids.length) await tx.$queryRaw`SELECT id FROM "Customer" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  },

  async rollbackBlocker(db, _batch, rows) {
    const ids = rows.filter((r) => r.createdEntity === "Customer").map((r) => r.createdEntityId!);
    const used = await db.customer.findFirst({
      where: {
        id: { in: ids },
        OR: [
          { salesOrders: { some: {} } },
          { payments: { some: {} } },
          { prices: { some: {} } },
          { creditEntries: { some: {} } },
          { mergedFrom: { some: {} } },
          { mergedIntoId: { not: null } },
        ],
      },
      select: { code: true },
    });
    return used ? `${used.code} has orders, payments, prices or merges since; edit or deactivate it instead` : null;
  },

  async rollback(tx, _ctx, _batch, rows) {
    // Never used (checked above), so removing them leaves no history behind; the audit log keeps what was created.
    const ids = rows.filter((r) => r.createdEntity === "Customer").map((r) => r.createdEntityId!);
    await tx.customer.deleteMany({ where: { id: { in: ids } } });
  },
};

export const IMPORT_HANDLERS: Record<ImportKind, KindHandler<unknown>> = {
  PRODUCTS: products,
  OPENING_STOCK: openingStock,
  CUSTOMERS: customers,
};
