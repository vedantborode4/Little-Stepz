import type { Request, Response } from "express";
import {
  adjustmentSchema,
  bucketMoveSchema,
  idParam,
  ledgerQuery,
  openingStockSchema,
  reverseStockDocumentSchema,
  STOCK_BUCKET_LABELS,
  STOCK_DOCUMENT_TYPE_LABELS,
  STOCK_REASON_LABELS,
  stockListQuery,
  transferSchema,
  writeOffSchema,
} from "@repo/crm-schema";
import { can } from "../../core/auth";
import { sendExport, type ExportColumn } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as queries from "./inventory.queries";
import * as inventory from "./inventory.service";

const visibility = (req: Request): queries.Visibility => ({ costs: can(req, "costs.view") });
const num = (v: string | null | undefined) => (v == null ? null : Number(v));

export async function listStock(req: Request, res: Response) {
  const query = stockListQuery.parse(req.query);
  const vis = visibility(req);
  const result = await queries.listStock(query, vis);
  if (query.format) {
    type Row = (typeof result.items)[number];
    const columns: ExportColumn<Row>[] = [
      { header: "Product code", value: (r) => r.productCode },
      { header: "Product", value: (r) => r.productName, width: 34 },
      { header: "Variant", value: (r) => r.variantName, width: 18 },
      { header: "SKU", value: (r) => r.sku, width: 18 },
      { header: "Category", value: (r) => r.categoryName, width: 18 },
      { header: "Sellable", value: (r) => r.sellable },
      { header: "Damaged", value: (r) => r.damaged },
      { header: "Demo", value: (r) => r.demo },
      { header: "Quarantine", value: (r) => r.quarantine },
      { header: "Physical", value: (r) => r.physical },
      { header: "Reserved", value: (r) => r.reserved },
      { header: "Available", value: (r) => r.available },
      { header: "Reorder level", value: (r) => r.reorderLevel },
      { header: "Status", value: (r) => r.state },
      ...(vis.costs
        ? [
            { header: "Avg landed cost", value: (r: Row) => num(r.avgUnitCost) },
            { header: "Stock value (known cost)", value: (r: Row) => num(r.stockValue) },
            { header: "Units with unknown cost", value: (r: Row) => r.unvaluedQty ?? 0 },
          ]
        : []),
    ];
    return sendExport(res, { filename: "stock-levels", format: query.format, rows: result.items, columns });
  }
  sendData(res, result);
}

export async function summary(req: Request, res: Response) {
  sendData(res, await queries.stockSummary(visibility(req)));
}

export async function listLedger(req: Request, res: Response) {
  const query = ledgerQuery.parse(req.query);
  const vis = visibility(req);
  const result = await queries.listLedger(query, vis);
  if (query.format) {
    type Row = (typeof result.items)[number];
    const columns: ExportColumn<Row>[] = [
      { header: "Date", value: (r) => r.businessDate },
      { header: "Document", value: (r) => r.documentCode },
      { header: "Type", value: (r) => STOCK_DOCUMENT_TYPE_LABELS[r.type] },
      { header: "Product", value: (r) => r.productName, width: 34 },
      { header: "Variant", value: (r) => r.variantName },
      { header: "SKU", value: (r) => r.sku, width: 18 },
      { header: "Location", value: (r) => r.locationCode },
      { header: "Status", value: (r) => STOCK_BUCKET_LABELS[r.bucket] },
      { header: "Quantity", value: (r) => r.quantity },
      ...(vis.costs ? [{ header: "Unit cost", value: (r: Row) => num(r.unitCost) }] : []),
      { header: "Reason", value: (r) => (r.reasonCode ? `${STOCK_REASON_LABELS[r.reasonCode]}: ${r.reason}` : r.reason), width: 30 },
      { header: "Reference", value: (r) => r.reference ?? "" },
      { header: "By", value: (r) => r.createdByName ?? "System" },
      { header: "Recorded at (UTC)", value: (r) => r.createdAt, width: 24 },
    ];
    return sendExport(res, { filename: "inventory-ledger", format: query.format, rows: result.items, columns });
  }
  sendData(res, result);
}

export async function getDocument(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await queries.getStockDocument(id, visibility(req)));
}

export async function variantCard(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await queries.variantStockCard(id, visibility(req)));
}

/** Every write returns the posted document, so the client can show its code and lines. */
const respondWithDocument = async (req: Request, res: Response, doc: { id: string }) =>
  sendData(res, await queries.getStockDocument(doc.id, visibility(req)), 201);

export async function opening(req: Request, res: Response) {
  await respondWithDocument(req, res, await inventory.recordOpeningStock(openingStockSchema.parse(req.body), requestContext(req)));
}

export async function transfer(req: Request, res: Response) {
  await respondWithDocument(req, res, await inventory.transferStock(transferSchema.parse(req.body), requestContext(req)));
}

export async function bucketMove(req: Request, res: Response) {
  await respondWithDocument(req, res, await inventory.moveBetweenBuckets(bucketMoveSchema.parse(req.body), requestContext(req)));
}

export async function writeOff(req: Request, res: Response) {
  await respondWithDocument(req, res, await inventory.writeOffStock(writeOffSchema.parse(req.body), requestContext(req)));
}

export async function adjust(req: Request, res: Response) {
  await respondWithDocument(req, res, await inventory.adjustStock(adjustmentSchema.parse(req.body), requestContext(req)));
}

export async function reverse(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = reverseStockDocumentSchema.parse(req.body);
  await respondWithDocument(req, res, await inventory.reverseStockDocument(id, input, requestContext(req)));
}
