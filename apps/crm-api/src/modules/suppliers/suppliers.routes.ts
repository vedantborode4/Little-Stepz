import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createSupplierEntrySchema,
  createSupplierSchema,
  idParam,
  listQuery,
  SUPPLIER_ENTRY_TYPE_LABELS,
  supplierLedgerQuery,
  updateSupplierSchema,
  voidSupplierEntrySchema,
} from "@repo/crm-schema";
import { can, requireAnyPermission, requirePermission } from "../../core/auth";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as ledger from "./supplier-ledger.service";
import * as suppliers from "./suppliers.service";

const supplierListQuery = listQuery.extend({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const view = requireAnyPermission("products.manage", "purchases.view");
const manageLedger = requirePermission("suppliers.ledger");

/** Product setup and purchasing both pick suppliers, so either permission grants access. */
export const suppliersRoutes = Router();

suppliersRoutes.get("/", view, async (req: Request, res: Response) => {
  const query = supplierListQuery.parse(req.query);
  const withBalance = can(req, "suppliers.ledger");
  const result = await suppliers.listSuppliers(query, withBalance);
  if (query.format) {
    return sendExport(res, {
      filename: "suppliers",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Name", value: (s) => s.name, width: 30 },
        { header: "Country", value: (s) => s.country ?? "" },
        { header: "Currency", value: (s) => s.currency },
        { header: "Contact", value: (s) => s.contactName ?? "" },
        { header: "Phone", value: (s) => s.phone ?? "" },
        { header: "Email", value: (s) => s.email ?? "", width: 26 },
        { header: "GSTIN", value: (s) => s.gstin ?? "" },
        { header: "Active", value: (s) => (s.isActive ? "Yes" : "No") },
        ...(withBalance ? [{ header: "Balance (INR, + they hold ours)", value: (s: { balance?: string }) => Number(s.balance ?? 0) }] : []),
      ],
    });
  }
  sendData(res, result);
});

suppliersRoutes.post("/", requireAnyPermission("products.manage", "purchases.manage"), async (req: Request, res: Response) => {
  sendData(res, await suppliers.createSupplier(createSupplierSchema.parse(req.body), requestContext(req)), 201);
});

suppliersRoutes.patch("/:id", requireAnyPermission("products.manage", "purchases.manage"), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await suppliers.updateSupplier(id, updateSupplierSchema.parse(req.body), requestContext(req)));
});

suppliersRoutes.get("/:id", view, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await suppliers.getSupplier(id, can(req, "suppliers.ledger")));
});

// ─── Supplier ledger ─────────────────────────────────────────────────────────

suppliersRoutes.get("/:id/ledger", manageLedger, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const query = supplierLedgerQuery.parse(req.query);
  const result = await ledger.listSupplierLedger(id, query);
  if (query.format) {
    return sendExport(res, {
      filename: "supplier-ledger",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Entry", value: (e) => e.code },
        { header: "Date", value: (e) => e.businessDate },
        { header: "Type", value: (e) => SUPPLIER_ENTRY_TYPE_LABELS[e.type], width: 20 },
        { header: "Amount (INR, + they hold ours)", value: (e) => Number(e.amount) },
        { header: "Balance after (INR)", value: (e) => Number(e.balanceAfter) },
        { header: "Account", value: (e) => e.account?.name ?? "", width: 22 },
        { header: "Purchase", value: (e) => e.purchase?.code ?? "" },
        { header: "Reference", value: (e) => e.reference ?? "" },
        { header: "Voids", value: (e) => e.reversalOf?.code ?? "" },
        { header: "Voided by", value: (e) => e.reversedBy?.code ?? "" },
        { header: "Notes", value: (e) => e.notes ?? "", width: 30 },
      ],
    });
  }
  sendData(res, result);
});

suppliersRoutes.post("/:id/ledger", manageLedger, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await ledger.createSupplierEntry(id, createSupplierEntrySchema.parse(req.body), requestContext(req)), 201);
});

suppliersRoutes.get("/ledger-entries/:id", manageLedger, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await ledger.getSupplierEntry(id));
});

suppliersRoutes.post("/ledger-entries/:id/void", manageLedger, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = voidSupplierEntrySchema.parse(req.body);
  sendData(res, await ledger.voidSupplierEntry(id, reason, requestContext(req)));
});
