import { prisma } from "@repo/crm-db/client";
import { skuSchema } from "@repo/crm-schema";
import { ApiError } from "../../core/http";
import { dec } from "../../core/money";
import { costPositions, setLandedCostInTx, unchangedMessage, wouldChange } from "../inventory/landed-cost-entries";
import { costCell, duplicate, fail, ok, type Created, type KindHandler, type Unit } from "./import-shared";

interface LandedCostPayload {
  variantId: string;
  unitCost: string;
  reason: string | null;
}

/** A landed cost per SKU for stock that is already in, applied exactly as "Set landed cost" on the item. */
export const landedCostsImport: KindHandler<LandedCostPayload> = {
  async check(rows) {
    const results = rows.map(ok);
    const skus = rows.map((r) => skuSchema.safeParse(r.fields.sku ?? "").data ?? null);
    const variants = await prisma.variant.findMany({
      where: { sku: { in: skus.filter((s): s is string => Boolean(s)) } },
      select: { id: true, sku: true },
    });
    const bySku = new Map(variants.map((v) => [v.sku, v]));
    const positions = await costPositions(
      prisma,
      variants.map((v) => v.id),
    );

    const units: Unit<LandedCostPayload>[] = [];
    const firstLine = new Map<string, number>();
    const totals = { unknownStock: 0, unknownSold: 0, recosted: 0 };
    rows.forEach((row, i) => {
      const r = results[i]!;
      const sku = skus[i];
      if (!sku) fail(r, `SKU: ${(row.fields.sku ?? "").trim() ? "not a valid SKU" : "Required"}`);
      const variant = sku ? bySku.get(sku) : undefined;
      if (sku && !variant) fail(r, `SKU ${sku} not found`);
      if (sku && firstLine.has(sku)) fail(r, `SKU ${sku} is repeated (first on line ${firstLine.get(sku)})`);
      else if (sku) firstLine.set(sku, row.line);

      const cost = costCell(row.fields.unitCost);
      if (cost === null) fail(r, "Landed cost per piece: Required");
      else if (cost === false || dec(cost).lte(0)) fail(r, "Landed cost per piece: an amount above 0");
      if (r.status !== "VALID" || !variant || !cost) return;

      const position = positions.get(variant.id)!;
      if (!wouldChange(position, dec(cost))) return duplicate(r, unchangedMessage(variant.sku, position));
      totals.unknownStock += position.unvaluedQty;
      totals.unknownSold += position.unknownSoldQty;
      totals.recosted += position.tracked.filter((t) => !t.unitCost.eq(cost)).reduce((s, t) => s + t.quantity, 0);
      units.push({
        rows: [i],
        payload: { variantId: variant.id, unitCost: cost, reason: (row.fields.reason ?? "").trim().slice(0, 200) || null },
      });
    });

    const summary = [
      `${units.length} item(s) get a new landed cost; their stock on hand moves to it.`,
      ...(totals.unknownStock ? [`${totals.unknownStock} unit(s) in stock with no cost get one.`] : []),
      ...(totals.unknownSold
        ? [`${totals.unknownSold} sold unit(s) with no cost get one, so their sales' profit and commission change.`]
        : []),
      ...(totals.recosted ? [`${totals.recosted} sold unit(s) costed by an earlier landed cost are re-costed.`] : []),
    ];
    return { results, units, summary };
  },

  async create(tx, ctx, batch, units) {
    const entities: Created["entities"] = new Map();
    for (const unit of units) {
      const { variantId, unitCost, reason } = unit.payload;
      const result = await setLandedCostInTx(tx, ctx, variantId, dec(unitCost), reason ?? `Import ${batch.code}`, batch.id);
      if (result) entities.set(unit.rows[0]!, { entity: "LandedCostEntry", id: result.entryId });
    }
    return { entities };
  },

  async lockForRollback() {},

  async rollbackBlocker() {
    return "landed costs can't be undone; set a new cost on the item to correct one";
  },

  async rollback() {
    throw new ApiError(409, "IMPORT_IN_USE", "Landed costs can't be rolled back");
  },
};
