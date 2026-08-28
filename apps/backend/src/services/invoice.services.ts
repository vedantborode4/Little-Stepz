import { prisma } from "@repo/db/client";
import { Decimal } from "decimal.js";
import { ApiError } from "../utils/api";
import {
  computeTax,
  financialYearOf,
  formatInvoiceNumber,
  getGstRate,
  getSeller,
} from "../utils/invoice";
import { renderInvoicePdf, type InvoicePdfData } from "../utils/invoicePdf";

/**
 * Issue and serve tax invoices.
 *
 * An invoice is written once and never recomputed. `Invoice.orderId` is unique, so
 * a replayed webhook or a re-sent email lands on the existing row rather than
 * minting a second number for the same sale — which would be a real GST problem,
 * not just a duplicate.
 */

/** Only a paid order has anything to invoice. */
async function loadInvoiceableOrder(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      id: true,
      total: true,
      shippingCharges: true,
      discount: true,
      paymentMethod: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      address: {
        select: { name: true, phone: true, address: true, city: true, state: true, pincode: true },
      },
      payment: { select: { status: true, method: true } },
      items: {
        select: {
          quantity: true,
          price: true,
          productName: true,
          variantName: true,
          product: { select: { name: true } },
          variant: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * Reserve the next number for a financial year.
 *
 * An upsert followed by an increment inside one transaction: two checkouts
 * completing at the same instant would otherwise both read the same last number.
 */
async function nextInvoiceNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  financialYear: string
): Promise<string> {
  await tx.invoiceCounter.upsert({
    where: { financialYear },
    create: { financialYear, lastNumber: 0 },
    update: {},
  });
  const counter = await tx.invoiceCounter.update({
    where: { financialYear },
    data: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return formatInvoiceNumber(financialYear, counter.lastNumber);
}

/**
 * Create the invoice for an order, or return the one that already exists.
 *
 * Returns null when the order cannot be invoiced (missing, unpaid) rather than
 * throwing: this runs on the post-payment path, where a failure must never take
 * down the confirmation that follows it.
 */
export async function issueInvoiceForOrder(orderId: string) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const order = await loadInvoiceableOrder(orderId);
  if (!order) return null;
  if (order.payment?.status !== "SUCCESS") return null;

  const seller = getSeller();
  const issuedAt = new Date();
  const financialYear = financialYearOf(issuedAt);

  const breakup = computeTax({
    items: order.items.map((i) => ({
      // Snapshot names first — the live relation is only a fallback for old rows.
      name: i.productName ?? i.product?.name ?? "Item",
      variantName: i.variantName ?? i.variant?.name ?? null,
      quantity: i.quantity,
      lineTotal: new Decimal(i.price.toString()).mul(i.quantity),
    })),
    shipping: new Decimal(order.shippingCharges.toString()),
    discount: new Decimal(order.discount.toString()),
    grandTotal: new Decimal(order.total.toString()),
    buyerState: order.address?.state ?? null,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, financialYear);
      return tx.invoice.create({
        data: {
          orderId: order.id,
          number,
          financialYear,
          placeOfSupply: order.address?.state ?? null,
          isIntraState: breakup.isIntraState,
          taxableValue: breakup.taxableValue.toString(),
          cgst: breakup.cgst.toString(),
          sgst: breakup.sgst.toString(),
          igst: breakup.igst.toString(),
          gstRate: breakup.gstRate.toString(),
          grandTotal: breakup.grandTotal.toString(),
          // Interface types lack an index signature, which Prisma's Json input requires.
          seller: { ...seller },
          buyer: {
            name: order.address?.name ?? order.user.name,
            email: order.user.email,
            phone: order.address?.phone ?? order.user.phone ?? null,
            address: order.address?.address ?? "",
            city: order.address?.city ?? "",
            state: order.address?.state ?? "",
            pincode: order.address?.pincode ?? "",
          },
          items: breakup.lines.map((l) => ({
            name: l.name,
            variantName: l.variantName,
            quantity: l.quantity,
            gross: l.gross.toString(),
            taxable: l.taxable.toString(),
            tax: l.tax.toString(),
          })),
          issuedAt,
        },
      });
    });
  } catch (err: any) {
    // Lost a race with a concurrent issue for the same order — the unique index on
    // orderId did its job. Return the winner rather than failing the caller.
    if (err?.code === "P2002") {
      return prisma.invoice.findUnique({ where: { orderId } });
    }
    throw err;
  }
}

/** Shape the stored snapshot for the renderer. */
function toPdfData(invoice: any, orderCreatedAt: Date, paymentMethod: string): InvoicePdfData {
  return {
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    orderId: invoice.orderId,
    orderDate: orderCreatedAt,
    seller: invoice.seller,
    buyer: invoice.buyer,
    placeOfSupply: invoice.placeOfSupply ?? "",
    isIntraState: invoice.isIntraState,
    gstRate: invoice.gstRate.toString(),
    items: invoice.items,
    taxableValue: invoice.taxableValue.toString(),
    cgst: invoice.cgst.toString(),
    sgst: invoice.sgst.toString(),
    igst: invoice.igst.toString(),
    grandTotal: invoice.grandTotal.toString(),
    paymentMethod: paymentMethod === "COD" ? "Cash on Delivery" : "Paid online",
  };
}

/**
 * Render an order's invoice, issuing it first if it does not exist yet.
 *
 * `userId` scopes the lookup to the requester's own order; admin callers omit it.
 */
export async function getInvoicePdfService(orderId: string, userId?: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null, ...(userId ? { userId } : {}) },
    select: {
      id: true,
      createdAt: true,
      paymentMethod: true,
      payment: { select: { status: true } },
    },
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND");

  if (order.payment?.status !== "SUCCESS") {
    throw new ApiError(409, "INVOICE_NOT_AVAILABLE");
  }

  // Back-fills invoices for orders paid before this feature existed, on first view.
  const invoice = await issueInvoiceForOrder(orderId);
  if (!invoice) throw new ApiError(409, "INVOICE_NOT_AVAILABLE");

  const pdf = await renderInvoicePdf(toPdfData(invoice, order.createdAt, order.paymentMethod));
  return { pdf, number: invoice.number };
}

/** Filename-safe form of the invoice number: LS/2026-27/00001 -> LS-2026-27-00001. */
export function invoiceFileName(number: string): string {
  return `${number.replace(/[^A-Za-z0-9-]/g, "-")}.pdf`;
}

export { getGstRate };
