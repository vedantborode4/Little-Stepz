import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createSupplierSchema, idParam, listQuery, updateSupplierSchema } from "@repo/crm-schema";
import { requireAnyPermission } from "../../core/auth";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as suppliers from "./suppliers.service";

const supplierListQuery = listQuery.extend({
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/** Product setup and purchasing both pick suppliers, so either permission grants access. */
export const suppliersRoutes = Router();

suppliersRoutes.get("/", requireAnyPermission("products.manage", "purchases.view"), async (req: Request, res: Response) => {
  const query = supplierListQuery.parse(req.query);
  const result = await suppliers.listSuppliers(query);
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
