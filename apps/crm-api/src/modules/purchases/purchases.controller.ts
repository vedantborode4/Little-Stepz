import type { Request, Response } from "express";
import { z } from "zod";
import {
  CURRENCY_CODES,
  idParam,
  landedCostInputSchema,
  lateChargeSchema,
  PURCHASE_STATUS_LABELS,
  purchaseDraftSchema,
  purchaseListQuery,
  purchaseReturnSchema,
  receivePurchaseSchema,
} from "@repo/crm-schema";
import { can } from "../../core/auth";
import { sendExport, type ExportColumn } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import { money } from "../../core/money";
import type { Visibility } from "./purchases.mappers";
import * as purchases from "./purchases.service";

const visibility = (req: Request): Visibility => ({ costs: can(req, "costs.view") });

export async function list(req: Request, res: Response) {
  const query = purchaseListQuery.parse(req.query);
  const vis = visibility(req);
  const result = await purchases.listPurchases(query, vis);
  if (query.format) {
    type Row = (typeof result.items)[number];
    const columns: ExportColumn<Row>[] = [
      { header: "Purchase", value: (r) => r.code },
      { header: "Status", value: (r) => PURCHASE_STATUS_LABELS[r.status] },
      { header: "Supplier", value: (r) => r.supplier.name, width: 28 },
      { header: "Invoice", value: (r) => r.invoiceNumber ?? "" },
      { header: "Invoice date", value: (r) => r.invoiceDate },
      { header: "Currency", value: (r) => r.currency },
      { header: "Location", value: (r) => r.locationName },
      { header: "Lines", value: (r) => r.lineCount },
      { header: "Units", value: (r) => r.units },
      ...(vis.costs ? [{ header: "Landed total (INR)", value: (r: Row) => (r.landedTotal ? Number(r.landedTotal) : null) }] : []),
      { header: "Received at (UTC)", value: (r) => r.receivedAt ?? "", width: 24 },
    ];
    return sendExport(res, { filename: "purchases", format: query.format, rows: result.items, columns });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await purchases.getPurchase(id, visibility(req)));
}

export async function preview(req: Request, res: Response) {
  const result = purchases.previewLandedCost(landedCostInputSchema.parse(req.body));
  sendData(res, {
    lines: result.lines.map((l) => ({
      unitPriceInr: money(l.unitPriceInr),
      allocatedCharges: money(l.allocatedCharges),
      landedUnitCost: money(l.landedUnitCost),
      landedTotal: money(l.landedTotal),
    })),
    totals: {
      goodsForeign: money(result.totals.goodsForeign),
      goodsInr: money(result.totals.goodsInr),
      capitalisedCharges: money(result.totals.capitalisedCharges),
      inputTaxCredit: money(result.totals.inputTaxCredit),
      landedTotal: money(result.totals.landedTotal),
      units: result.totals.units,
    },
  });
}

const lastRateQuery = z.object({ currency: z.enum(CURRENCY_CODES) });

export async function lastRate(req: Request, res: Response) {
  const { currency } = lastRateQuery.parse(req.query);
  sendData(res, await purchases.lastExchangeRate(currency));
}

export async function create(req: Request, res: Response) {
  const input = purchaseDraftSchema.parse(req.body);
  sendData(res, await purchases.createDraft(input, requestContext(req), visibility(req)), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = purchaseDraftSchema.parse(req.body);
  sendData(res, await purchases.updateDraft(id, input, requestContext(req), visibility(req)));
}

export async function cancel(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await purchases.cancelDraft(id, requestContext(req), visibility(req)));
}

export async function receive(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = receivePurchaseSchema.parse(req.body ?? {});
  sendData(res, await purchases.receivePurchase(id, input, requestContext(req), visibility(req)));
}

export async function lateCharge(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = lateChargeSchema.parse(req.body);
  sendData(res, await purchases.addLateCharge(id, input, requestContext(req), visibility(req)), 201);
}

export async function returnGoods(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = purchaseReturnSchema.parse(req.body);
  sendData(res, await purchases.returnToSupplier(id, input, requestContext(req), visibility(req)), 201);
}
