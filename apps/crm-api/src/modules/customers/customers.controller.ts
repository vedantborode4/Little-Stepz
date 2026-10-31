import type { Request, Response } from "express";
import { z } from "zod";
import {
  createCustomerSchema,
  CUSTOMER_TYPE_LABELS,
  customerListQuery,
  customerPriceSchema,
  duplicateCheckQuery,
  formatMobile,
  idParam,
  mergeCustomerSchema,
  updateCustomerSchema,
  type CustomerListItemDto,
} from "@repo/crm-schema";
import { can } from "../../core/auth";
import { sendExport, type ExportColumn } from "../../core/export";
import { forbidden, requestContext, sendData } from "../../core/http";
import * as customers from "./customers.service";

const priceParams = z.object({ id: z.string().uuid(), variantId: z.string().uuid() });

const baseColumns: ExportColumn<CustomerListItemDto>[] = [
  { header: "Code", value: (c) => c.code },
  { header: "Name", value: (c) => c.name, width: 28 },
  { header: "Type", value: (c) => CUSTOMER_TYPE_LABELS[c.type] },
  { header: "City", value: (c) => c.city ?? "" },
  { header: "PIN", value: (c) => c.pincode ?? "" },
  { header: "Credit days", value: (c) => c.creditDays },
  { header: "Credit limit", value: (c) => (c.creditLimit ? Number(c.creditLimit) : null) },
  { header: "Active", value: (c) => (c.isActive ? "Yes" : "No") },
];

export async function list(req: Request, res: Response) {
  const query = customerListQuery.parse(req.query);
  if (query.format && query.contacts === "full") {
    if (!can(req, "customers.export")) throw forbidden("Only admins can export full contact details");
    const rows = await customers.exportCustomersWithContacts(query, requestContext(req));
    type Row = (typeof rows)[number];
    const columns: ExportColumn<Row>[] = [
      ...(baseColumns as ExportColumn<Row>[]),
      { header: "Mobile", value: (c) => (c.contact.mobile ? formatMobile(c.contact.mobile) : "") },
      { header: "WhatsApp", value: (c) => (c.contact.whatsapp ? formatMobile(c.contact.whatsapp) : "") },
      { header: "Email", value: (c) => c.contact.email ?? "", width: 26 },
    ];
    return sendExport(res, { filename: "customers-contacts", format: query.format, rows, columns });
  }

  const result = await customers.listCustomers(query);
  if (query.format) {
    const columns: ExportColumn<CustomerListItemDto>[] = [
      ...baseColumns,
      { header: "Mobile (masked)", value: (c) => c.mobile ?? "" },
      { header: "Email (masked)", value: (c) => c.email ?? "" },
    ];
    return sendExport(res, { filename: "customers", format: query.format, rows: result.items, columns });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await customers.getCustomer(id));
}

export async function contact(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await customers.revealContact(id, requestContext(req)));
}

export async function create(req: Request, res: Response) {
  sendData(res, await customers.createCustomer(createCustomerSchema.parse(req.body), requestContext(req)), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await customers.updateCustomer(id, updateCustomerSchema.parse(req.body), requestContext(req)));
}

export async function checkDuplicates(req: Request, res: Response) {
  sendData(res, await customers.findDuplicates(duplicateCheckQuery.parse(req.query)));
}

export async function duplicatePairs(_req: Request, res: Response) {
  sendData(res, await customers.duplicatePairs());
}

export async function merge(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await customers.mergeCustomer(id, mergeCustomerSchema.parse(req.body), requestContext(req)));
}

export async function setPrice(req: Request, res: Response) {
  const { id, variantId } = priceParams.parse(req.params);
  const { price } = customerPriceSchema.parse(req.body);
  sendData(res, await customers.setCustomerPrice(id, variantId, price, requestContext(req)));
}

export async function removePrice(req: Request, res: Response) {
  const { id, variantId } = priceParams.parse(req.params);
  sendData(res, await customers.removeCustomerPrice(id, variantId, requestContext(req)));
}
