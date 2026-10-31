import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  courierListQuery,
  createCourierSchema,
  createShipmentSchema,
  idParam,
  packageSchema,
  SHIPMENT_STATUS_LABELS,
  shipmentListQuery,
  shipmentStatusSchema,
  updateCourierSchema,
  updateShipmentSchema,
} from "@repo/crm-schema";
import { requireAnyPermission, requirePermission } from "../../core/auth";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as couriers from "./couriers.service";
import * as shipments from "./shipments.service";

const ship = requirePermission("shipping.manage");
const packageParams = z.object({ id: z.string().uuid(), packageId: z.string().uuid() });

export const shipmentsRoutes = Router();

shipmentsRoutes.get("/", requireAnyPermission("shipping.manage", "sales.view"), async (req: Request, res: Response) => {
  const query = shipmentListQuery.parse(req.query);
  const result = await shipments.listShipments(query);
  if (query.format) {
    return sendExport(res, {
      filename: "shipments",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Shipment", value: (s) => s.code },
        { header: "Order", value: (s) => s.order.code },
        { header: "Customer", value: (s) => s.customer?.name ?? "", width: 24 },
        { header: "Courier", value: (s) => s.courier?.name ?? "" },
        { header: "AWB", value: (s) => s.awbs.join(", "), width: 24 },
        { header: "Status", value: (s) => SHIPMENT_STATUS_LABELS[s.status] },
        { header: "Courier cost (INR)", value: (s) => Number(s.courierCost) },
        { header: "Charged to customer (INR)", value: (s) => Number(s.chargedToCustomer) },
        { header: "Dispatched (UTC)", value: (s) => s.dispatchedAt ?? "", width: 24 },
        { header: "Delivered (UTC)", value: (s) => s.deliveredAt ?? "", width: 24 },
      ],
    });
  }
  sendData(res, result);
});

shipmentsRoutes.get("/summary", requireAnyPermission("shipping.manage", "sales.view"), async (_req: Request, res: Response) => {
  sendData(res, await shipments.shipmentSummary());
});

shipmentsRoutes.get("/:id", requireAnyPermission("shipping.manage", "sales.view"), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await shipments.getShipment(id));
});

shipmentsRoutes.post("/", ship, async (req: Request, res: Response) => {
  sendData(res, await shipments.createShipment(createShipmentSchema.parse(req.body), requestContext(req)), 201);
});

shipmentsRoutes.patch("/:id", ship, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await shipments.updateShipment(id, updateShipmentSchema.parse(req.body), requestContext(req)));
});

shipmentsRoutes.post("/:id/packages", ship, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await shipments.addPackage(id, packageSchema.parse(req.body), requestContext(req)));
});

shipmentsRoutes.delete("/:id/packages/:packageId", ship, async (req: Request, res: Response) => {
  const { id, packageId } = packageParams.parse(req.params);
  sendData(res, await shipments.removePackage(id, packageId, requestContext(req)));
});

shipmentsRoutes.post("/:id/status", ship, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await shipments.changeStatus(id, shipmentStatusSchema.parse(req.body), requestContext(req)));
});

/** Couriers are reference data: anyone shipping can pick one, admins maintain the list. */
export const couriersRoutes = Router();

couriersRoutes.get("/", requireAnyPermission("shipping.manage", "settings.manage"), async (req: Request, res: Response) => {
  const { includeInactive } = courierListQuery.parse(req.query);
  sendData(res, await couriers.listCouriers(includeInactive));
});

couriersRoutes.post("/", requirePermission("settings.manage"), async (req: Request, res: Response) => {
  sendData(res, await couriers.createCourier(createCourierSchema.parse(req.body), requestContext(req)), 201);
});

couriersRoutes.patch("/:id", requirePermission("settings.manage"), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await couriers.updateCourier(id, updateCourierSchema.parse(req.body), requestContext(req)));
});
