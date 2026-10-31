import type { Request, Response } from "express";
import {
  allocateAvailableSchema,
  cancelOrderSchema,
  deallocateSchema,
  expectedArrivalSchema,
  preOrderListQuery,
  FULFILMENT_METHOD_LABELS,
  idParam,
  posSaleSchema,
  SALES_CHANNEL_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_TYPE_LABELS,
  saleQuoteSchema,
  salesListQuery,
  salesOrderSchema,
  salesSummaryQuery,
  sellableSearchQuery,
} from "@repo/crm-schema";
import { can } from "../../core/auth";
import { sendExport } from "../../core/export";
import { forbidden, requestContext, sendData } from "../../core/http";
import type { Visibility } from "./sales.mappers";
import * as preOrders from "./preorders";
import { salesSummary } from "./sales.reports";
import * as sales from "./sales.service";

const visibility = (req: Request): Visibility => ({ costs: can(req, "costs.view") });
const rights = (req: Request): sales.SaleRights => ({ overridePrice: can(req, "sales.manage") });

export async function list(req: Request, res: Response) {
  const query = salesListQuery.parse(req.query);
  const result = await sales.listOrders(query);
  if (query.format) {
    return sendExport(res, {
      filename: "sales-orders",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Order", value: (o) => o.code },
        { header: "Date", value: (o) => o.orderDate },
        { header: "Type", value: (o) => SALES_ORDER_TYPE_LABELS[o.type] },
        { header: "Status", value: (o) => SALES_ORDER_STATUS_LABELS[o.status] },
        { header: "Channel", value: (o) => SALES_CHANNEL_LABELS[o.channel] },
        { header: "Fulfilment", value: (o) => FULFILMENT_METHOD_LABELS[o.fulfilment] },
        { header: "Customer", value: (o) => (o.customer ? `${o.customer.name} (${o.customer.code})` : "Walk-in"), width: 28 },
        { header: "Units", value: (o) => o.units },
        { header: "Total (INR, incl. GST)", value: (o) => Number(o.grandTotal) },
        { header: "Fulfilled at (UTC)", value: (o) => o.fulfilledAt ?? "", width: 24 },
      ],
    });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.getOrder(id, visibility(req)));
}

export async function items(req: Request, res: Response) {
  sendData(res, await sales.searchSellable(sellableSearchQuery.parse(req.query)));
}

export async function quote(req: Request, res: Response) {
  sendData(res, await sales.quoteSale(saleQuoteSchema.parse(req.body), rights(req)));
}

export async function summary(req: Request, res: Response) {
  sendData(res, await salesSummary(salesSummaryQuery.parse(req.query), visibility(req)));
}

export async function pos(req: Request, res: Response) {
  const input = posSaleSchema.parse(req.body);
  sendData(res, await sales.createPosSale(input, requestContext(req), rights(req), visibility(req)), 201);
}

export async function create(req: Request, res: Response) {
  const input = salesOrderSchema.parse(req.body);
  sendData(res, await sales.createOrder(input, requestContext(req), rights(req), visibility(req)), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = salesOrderSchema.parse(req.body);
  sendData(res, await sales.updateDraft(id, input, requestContext(req), rights(req), visibility(req)));
}

export async function confirm(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.confirmOrder(id, requestContext(req), visibility(req)));
}

export async function pack(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.packOrder(id, requestContext(req), visibility(req)));
}

/** Counter handover is a till job; dispatching a delivery is a shipping job. */
export async function fulfil(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const fulfilment = await sales.fulfilmentOf(id);
  const allowed = fulfilment === "COUNTER" ? can(req, "sales.create") : can(req, "shipping.manage") || can(req, "sales.manage");
  if (!allowed) throw forbidden();
  sendData(res, await sales.fulfilOrder(id, requestContext(req), visibility(req)));
}

export async function deliver(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.deliverOrder(id, requestContext(req), visibility(req)));
}

export async function cancel(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.cancelOrder(id, cancelOrderSchema.parse(req.body), requestContext(req), visibility(req)));
}

export async function allocate(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await sales.allocateOrder(id, requestContext(req), visibility(req)));
}

export async function deallocate(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const { reason } = deallocateSchema.parse(req.body);
  sendData(res, await sales.deallocateOrder(id, reason, requestContext(req), visibility(req)));
}

export async function expectedArrival(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const { expectedArrival } = expectedArrivalSchema.parse(req.body);
  sendData(res, await sales.setExpectedArrival(id, expectedArrival, requestContext(req), visibility(req)));
}

export async function listPreOrders(req: Request, res: Response) {
  sendData(res, await preOrders.listPreOrders(preOrderListQuery.parse(req.query)));
}

export async function preOrderSummary(_req: Request, res: Response) {
  sendData(res, await preOrders.preOrderSummary());
}

export async function waitingItems(_req: Request, res: Response) {
  sendData(res, await preOrders.waitingItems());
}

export async function allocateAvailable(req: Request, res: Response) {
  const { variantId } = allocateAvailableSchema.parse(req.body ?? {});
  sendData(res, await preOrders.allocateAvailable(variantId, requestContext(req)));
}
