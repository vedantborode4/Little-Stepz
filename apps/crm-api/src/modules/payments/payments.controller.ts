import type { Request, Response } from "express";
import {
  accountTransferSchema,
  applyCreditSchema,
  collectionsQuery,
  idParam,
  outstandingQuery,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
  paymentListQuery,
  receivePaymentSchema,
  refundCreditSchema,
  reverseTransferSchema,
  SALES_ORDER_STATUS_LABELS,
  transferListQuery,
  voidPaymentSchema,
} from "@repo/crm-schema";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as queries from "./payments.queries";
import * as payments from "./payments.service";

const customerLabel = (c: { name: string; code: string } | null) => (c ? `${c.name} (${c.code})` : "Walk-in");

export async function list(req: Request, res: Response) {
  const query = paymentListQuery.parse(req.query);
  const result = await queries.listPayments(query);
  if (query.format) {
    return sendExport(res, {
      filename: "payments",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Payment", value: (p) => p.code },
        { header: "Date", value: (p) => p.businessDate },
        { header: "Direction", value: (p) => PAYMENT_DIRECTION_LABELS[p.direction] },
        { header: "Method", value: (p) => PAYMENT_METHOD_LABELS[p.method] },
        { header: "Account", value: (p) => p.account.name, width: 22 },
        { header: "Personal account", value: (p) => (p.account.isPersonal ? "Yes" : "No") },
        { header: "Amount (INR)", value: (p) => Number(p.amount) },
        { header: "Fee (INR)", value: (p) => Number(p.fee) },
        { header: "Reference", value: (p) => p.reference ?? "" },
        { header: "Customer", value: (p) => customerLabel(p.customer), width: 26 },
        { header: "Orders", value: (p) => p.orderCodes.join(", "), width: 26 },
        { header: "To/from credit (INR)", value: (p) => Number(p.creditAmount) },
        { header: "Voids", value: (p) => p.reversalOf?.code ?? "" },
        { header: "Voided by", value: (p) => p.reversedBy?.code ?? "" },
      ],
    });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await queries.getPayment(id));
}

export async function receive(req: Request, res: Response) {
  sendData(res, await payments.receivePayment(receivePaymentSchema.parse(req.body), requestContext(req)), 201);
}

export async function voidPayment(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const { reason } = voidPaymentSchema.parse(req.body);
  sendData(res, await payments.voidPaymentById(id, reason, requestContext(req)));
}

export async function credit(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await queries.customerCredit(id));
}

export async function applyCredit(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await payments.applyCustomerCredit(id, applyCreditSchema.parse(req.body), requestContext(req)));
}

export async function refundCredit(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await payments.refundCustomerCredit(id, refundCreditSchema.parse(req.body), requestContext(req)));
}

export async function collections(req: Request, res: Response) {
  sendData(res, await queries.collections(collectionsQuery.parse(req.query)));
}

export async function outstanding(req: Request, res: Response) {
  const query = outstandingQuery.parse(req.query);
  const result = await queries.listOutstanding(query);
  if (query.format) {
    return sendExport(res, {
      filename: "outstanding",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Order", value: (o) => o.code },
        { header: "Customer", value: (o) => customerLabel(o.customer), width: 26 },
        { header: "Order date", value: (o) => o.orderDate },
        { header: "Due date", value: (o) => o.dueDate ?? "" },
        { header: "Status", value: (o) => SALES_ORDER_STATUS_LABELS[o.status] },
        { header: "Total (INR)", value: (o) => Number(o.grandTotal) },
        { header: "Paid (INR)", value: (o) => Number(o.paid) },
        { header: "Due (INR)", value: (o) => Number(o.due) },
        { header: "Age (days)", value: (o) => o.ageDays },
        { header: "Bucket", value: (o) => o.bucket },
        { header: "Overdue", value: (o) => (o.overdue ? "Yes" : "No") },
        { header: "Fulfilled", value: (o) => (o.fulfilled ? "Yes" : "No") },
      ],
    });
  }
  sendData(res, result);
}

export async function outstandingSummary(req: Request, res: Response) {
  const { customerId } = outstandingQuery.pick({ customerId: true }).parse(req.query);
  sendData(res, await queries.outstandingSummary({ customerId }));
}

export async function listTransfers(req: Request, res: Response) {
  sendData(res, await queries.listTransfers(transferListQuery.parse(req.query)));
}

export async function createTransfer(req: Request, res: Response) {
  sendData(res, await payments.createTransfer(accountTransferSchema.parse(req.body), requestContext(req)), 201);
}

export async function reverseTransfer(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const { reason } = reverseTransferSchema.parse(req.body);
  sendData(res, await payments.reverseTransfer(id, reason, requestContext(req)));
}
