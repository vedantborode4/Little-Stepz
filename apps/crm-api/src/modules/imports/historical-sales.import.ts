import { prisma, type SalesChannel, type Tx } from "@repo/crm-db/client";
import { GST_RATES, normalizeMobile, SALES_CHANNEL_LABELS, SALES_CHANNELS, skuSchema } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { fromDbDate, todayIST, toDbDate } from "../../core/dates";
import { ApiError, type RequestContext } from "../../core/http";
import { dec, Decimal } from "../../core/money";
import { nextCode } from "../../core/sequence";
import { createExpenseInTx } from "../expenses/expenses.service";
import { recordReceipt } from "../payments/ledger";
import { addEvent, financialYear } from "../sales/sales.service";
import { computeSaleTotals } from "../sales/totals";
import {
  amountCell,
  costCell,
  dateCell,
  duplicate,
  fail,
  gstCell,
  inr,
  ok,
  type BatchRef,
  type Created,
  type FieldRow,
  type KindHandler,
  type RowResult,
  type Unit,
} from "./import-shared";

/**
 * Past bills, brought in so reports and customer history cover the time before
 * the CRM. Each bill becomes a completed sale on its own date, with its
 * payments and courier cost on that date. Stock is not touched: the opening
 * count taken at cut-over already reflects these sales.
 */

const PAYMENT_FIELDS = ["payment1", "payment2", "payment3"] as const;
const PAYMENT_OPTIONS = { payment1: "payment1Account", payment2: "payment2Account", payment3: "payment3Account" } as const;

const WALK_IN = /^(walk[\s-]?in|cash)(\s+customer)?$/i;

const CHANNEL_WORDS: Record<string, SalesChannel> = {
  ...Object.fromEntries(SALES_CHANNELS.map((c) => [c.toLowerCase(), c])),
  ...Object.fromEntries(SALES_CHANNELS.map((c) => [SALES_CHANNEL_LABELS[c].toLowerCase(), c])),
  shop: "STORE",
  counter: "STORE",
  web: "WEBSITE",
  insta: "INSTAGRAM",
  fb: "FACEBOOK",
};

interface BillLine {
  variantId: string;
  quantity: number;
  unitPrice: string;
  lineDiscount: string;
  unitCost: string | null;
  /** The product's rate, unless the file gives one for this sale. */
  gstRate: string;
}

interface BillPayload {
  billId: string;
  saleDate: string;
  channel: SalesChannel;
  customerId: string | null;
  notes: string | null;
  lines: BillLine[];
  billDiscount: string;
  payments: { accountId: string; amount: string }[];
  courier: string;
}

interface ParsedRow {
  index: number;
  line: number;
  billId: string;
  date: string | null;
  item: (BillLine & { sku: string }) | null;
  billDiscount: Decimal;
  payments: Decimal[];
  courier: Decimal;
  channel: SalesChannel | null;
  customerId: string | null;
  notes: string | null;
}

type CustomerRow = { id: string; code: string; name: string; mobile: string | null };
type VariantRow = { id: string; product: { gstRate: { toString(): string } } };

const gstRates: readonly string[] = GST_RATES;

/** Customer by code, mobile or exact name; a name shared by several customers must be told apart. */
function findCustomer(customers: CustomerRow[], text: string): { id: string } | { error: string } {
  const upper = text.toUpperCase();
  const mobile = normalizeMobile(text);
  const byKey = customers.find((c) => c.code === upper || (mobile && c.mobile === mobile));
  if (byKey) return { id: byKey.id };
  const byName = customers.filter((c) => c.name.trim().toLowerCase() === text.toLowerCase());
  if (byName.length === 1) return { id: byName[0]!.id };
  if (byName.length > 1) return { error: `Customer: ${byName.length} customers are named "${text}"; use their mobile or code` };
  return { error: `Customer: no customer "${text}"; import customers first, or leave it blank for a walk-in` };
}

function parseRow(
  row: FieldRow,
  index: number,
  r: RowResult,
  ctx: { variants: Map<string, VariantRow>; customers: CustomerRow[]; today: string },
): ParsedRow {
  const f = row.fields;
  const billId = (f.billId ?? "").trim();
  if (!billId) fail(r, "Bill ID: Required");

  const date = dateCell(f.saleDate);
  if (date === false) fail(r, "Sale date: not a date");
  else if (date && date > ctx.today) fail(r, "Sale date: can't be in the future");

  const amount = (key: string, label: string) => {
    const v = amountCell(f[key]);
    if (v === false) fail(r, `${label}: not an amount`);
    return v ? dec(v) : new Decimal(0);
  };

  let item: ParsedRow["item"] = null;
  const skuText = (f.sku ?? "").trim();
  const hasItemValues = Boolean((f.quantity ?? "").trim() || (f.unitPrice ?? "").trim());
  if (!skuText && hasItemValues) fail(r, "SKU: Required on a row with a quantity or price");
  if (skuText) {
    const sku = skuSchema.safeParse(skuText).data;
    const variant = sku ? ctx.variants.get(sku) : undefined;
    if (!sku) fail(r, "SKU: not a valid SKU");
    else if (!variant) fail(r, `SKU ${sku} not found; import the product first`);
    const quantity = Number((f.quantity ?? "").replace(/[,\s]/g, ""));
    if (!(f.quantity ?? "").trim()) fail(r, "Quantity: Required");
    else if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) fail(r, "Quantity: a whole number of at least 1");
    const unitPrice = amountCell(f.unitPrice);
    if (unitPrice === null) fail(r, "Price per piece: Required");
    if (unitPrice === false) fail(r, "Price per piece: an amount with at most 2 decimals");
    const lineDiscount = amountCell(f.lineDiscount);
    if (lineDiscount === false) fail(r, "Line discount: an amount with at most 2 decimals");
    const unitCost = costCell(f.unitCost);
    if (unitCost === false) fail(r, "Landed cost per piece: not an amount");
    const gstText = gstCell(f.gstRate);
    if (gstText && !gstRates.includes(gstText)) fail(r, `GST %: "${f.gstRate}" should be one of ${GST_RATES.join(", ")}`);
    if (variant && sku && unitPrice && lineDiscount !== false && unitCost !== false && (!gstText || gstRates.includes(gstText))) {
      const gstRate = gstText || dec(variant.product.gstRate.toString()).toString();
      item = { sku, variantId: variant.id, quantity, unitPrice, lineDiscount: lineDiscount ?? "0", unitCost, gstRate };
    }
  }

  const channelText = (f.channel ?? "").trim().toLowerCase();
  const channel = channelText ? (CHANNEL_WORDS[channelText] ?? null) : null;
  if (channelText && !channel)
    fail(r, `Channel: "${f.channel}" should be one of ${SALES_CHANNELS.map((c) => SALES_CHANNEL_LABELS[c]).join(", ")}`);

  const customerText = (f.customer ?? "").trim();
  let customerId: string | null = null;
  if (customerText && !WALK_IN.test(customerText)) {
    const found = findCustomer(ctx.customers, customerText);
    if ("error" in found) fail(r, found.error);
    else customerId = found.id;
  }

  return {
    index,
    line: row.line,
    billId,
    date: date || null,
    item,
    billDiscount: amount("billDiscount", "Bill discount"),
    payments: PAYMENT_FIELDS.map((key, i) => amount(key, `Payment ${i + 1}`)),
    courier: amount("courier", "Courier charges"),
    channel,
    customerId,
    notes: (f.notes ?? "").trim() || null,
  };
}

const sum = (xs: Decimal[]) => xs.reduce((s, x) => s.add(x), new Decimal(0));
const distinct = <T>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];

/** Same item twice on one bill becomes one line when price, cost and GST agree; otherwise the owner must say which. */
function mergeItems(items: (BillLine & { sku: string })[]): { lines: BillLine[] } | { error: string } {
  const bySku = new Map<string, BillLine & { sku: string }>();
  for (const item of items) {
    const seen = bySku.get(item.sku);
    if (!seen) {
      bySku.set(item.sku, { ...item });
      continue;
    }
    if (seen.unitPrice !== item.unitPrice || seen.unitCost !== item.unitCost || !dec(seen.gstRate).eq(item.gstRate)) {
      return { error: `${item.sku} is on this bill twice at different prices, costs or GST; put it on one row` };
    }
    seen.quantity += item.quantity;
    seen.lineDiscount = dec(seen.lineDiscount).add(dec(item.lineDiscount)).toString();
  }
  return { lines: [...bySku.values()].map(({ sku: _sku, ...line }) => line) };
}

export const historicalSalesImport: KindHandler<BillPayload> = {
  async check(rows, batch) {
    const results = rows.map(ok);
    const skus = [...new Set(rows.map((r) => skuSchema.safeParse(r.fields.sku ?? "").data).filter((s): s is string => Boolean(s)))];
    const billIds = [...new Set(rows.map((r) => (r.fields.billId ?? "").trim()).filter(Boolean))];
    const [variants, customers, existing] = await Promise.all([
      prisma.variant.findMany({ where: { sku: { in: skus } }, include: { product: { select: { gstRate: true } } } }),
      prisma.customer.findMany({
        where: { isActive: true, mergedIntoId: null },
        select: { id: true, code: true, name: true, mobile: true },
      }),
      prisma.salesOrder.findMany({
        where: { externalRef: { in: billIds }, status: { not: "CANCELLED" } },
        select: { externalRef: true, code: true },
      }),
    ]);
    const variantBySku = new Map(variants.map((v) => [v.sku, v]));
    const alreadyIn = new Map(existing.map((o) => [o.externalRef!, o.code]));

    const parsed = rows.map((row, i) => parseRow(row, i, results[i]!, { variants: variantBySku, customers, today: todayIST() }));
    const bills = new Map<string, ParsedRow[]>();
    for (const p of parsed) if (p.billId) bills.set(p.billId, [...(bills.get(p.billId) ?? []), p]);

    const accountOf = PAYMENT_FIELDS.map((key) => batch.options[PAYMENT_OPTIONS[key]] ?? null);
    const units: Unit<BillPayload>[] = [];
    const closedDays = await closedCashDays(
      distinct(accountOf).concat(batch.options.courierAccount ? [batch.options.courierAccount] : []),
      distinct(parsed.map((p) => p.date)),
    );

    for (const [billId, billRows] of bills) {
      const rowResults = billRows.map((p) => results[p.index]!);
      const failAll = (message: string) => rowResults.forEach((r) => fail(r, message));
      if (alreadyIn.has(billId)) {
        rowResults.forEach((r) => duplicate(r, `Bill ${billId} is already in the CRM (${alreadyIn.get(billId)})`));
        continue;
      }

      const dates = distinct(billRows.map((p) => p.date));
      const channels = distinct(billRows.map((p) => p.channel));
      const customerIds = distinct(billRows.map((p) => p.customerId));
      if (dates.length === 0) failAll("Sale date: the bill has no date");
      if (dates.length > 1) failAll(`Sale date: rows of this bill have different dates (${dates.join(", ")})`);
      if (channels.length > 1) failAll("Channel: rows of this bill have different channels");
      if (customerIds.length > 1) failAll("Customer: rows of this bill name different customers");

      const items = billRows.flatMap((p) => (p.item ? [p.item] : []));
      if (items.length === 0 && billRows.every((p) => !p.item && results[p.index]!.status === "VALID")) failAll("The bill has no items");
      const merged = mergeItems(items);
      if ("error" in merged) failAll(merged.error);

      const blocker = billRows.find((p) => results[p.index]!.status !== "VALID");
      if (blocker) {
        rowResults.forEach((r) => {
          if (r.status === "VALID") fail(r, `Another row of this bill (line ${blocker.line}) can't be imported`);
        });
        continue;
      }
      if ("error" in merged) continue;

      const billDiscount = sum(billRows.map((p) => p.billDiscount));
      let total: Decimal;
      try {
        total = computeSaleTotals(priceLines(merged.lines), billDiscount, new Decimal(0)).totals.grandTotal;
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        failAll(`Discount: ${err.message}`);
        continue;
      }

      const saleDate = dates[0]!;
      const customerId = customerIds[0] ?? null;
      const payments = PAYMENT_FIELDS.flatMap((_, i) => {
        const amount = sum(billRows.map((p) => p.payments[i]!));
        return amount.gt(0) ? [{ accountId: accountOf[i]!, amount: amount.toString() }] : [];
      });
      const paid = sum(payments.map((p) => dec(p.amount)));
      if (paid.gt(total) && !customerId) {
        failAll(
          `Received ${inr(paid)} for a ${inr(total)} bill: correct the amounts, or name the customer to keep the extra as their credit`,
        );
      }
      if (paid.lt(total) && !customerId) {
        failAll(`Walk-in bill not fully paid: ${inr(total.sub(paid))} missing. Name the customer who owes it, or add the payment`);
      }
      const courier = sum(billRows.map((p) => p.courier));
      const usedAccounts = [...payments.map((p) => p.accountId), ...(courier.gt(0) ? [batch.options.courierAccount!] : [])];
      const closed = usedAccounts.find((a) => closedDays.has(`${a}|${saleDate}`));
      if (closed) failAll(`The cash day ${saleDate} is closed for ${closedDays.get(`${closed}|${saleDate}`)}; reopen it first`);
      if (rowResults.some((r) => r.status !== "VALID")) continue;

      units.push({
        rows: billRows.map((p) => p.index),
        payload: {
          billId,
          saleDate,
          channel: channels[0] ?? "STORE",
          customerId,
          notes: distinct(billRows.map((p) => p.notes)).join(" · ") || null,
          lines: merged.lines,
          billDiscount: billDiscount.toString(),
          payments,
          courier: courier.toString(),
        },
      });
    }
    return { results, units, summary: await historySummary(units) };
  },

  async create(tx, ctx, batch, units) {
    const entities: Created["entities"] = new Map();
    const ordered = [...units].sort((a, b) => a.payload.saleDate.localeCompare(b.payload.saleDate) || a.rows[0]! - b.rows[0]!);
    for (const unit of ordered) {
      const orderId = await createHistoricalBill(tx, ctx, batch, unit.payload);
      for (const index of unit.rows) entities.set(index, { entity: "SalesOrder", id: orderId });
    }
    return { entities };
  },

  async lockForRollback() {},

  // Imported bills are money records: locked once saved, like any sale. They are corrected with returns and refunds.
  async rollbackBlocker() {
    return "past sales are locked once imported, like any sale; correct a bill with a return or refund";
  },

  async rollback() {
    throw new ApiError(409, "IMPORT_IN_USE", "Past sales can't be rolled back");
  },
};

/** Cash days already counted and closed, keyed "accountId|date", for the accounts and dates the file uses. */
async function closedCashDays(accountIds: string[], dates: string[]) {
  if (accountIds.length === 0 || dates.length === 0) return new Map<string, string>();
  const sessions = await prisma.cashSession.findMany({
    where: { status: "CLOSED", accountId: { in: accountIds }, businessDate: { in: dates.map(toDbDate) } },
    select: { accountId: true, businessDate: true, account: { select: { name: true } } },
  });
  return new Map(sessions.map((s) => [`${s.accountId}|${fromDbDate(s.businessDate)}`, s.account.name]));
}

const priceLines = (lines: BillLine[]) =>
  lines.map((l) => ({ quantity: l.quantity, unitPrice: dec(l.unitPrice), lineDiscount: dec(l.lineDiscount), gstRate: dec(l.gstRate) }));

async function historySummary(units: Unit<BillPayload>[]) {
  if (units.length === 0) return [];
  let sales = new Decimal(0);
  let gst = new Decimal(0);
  let owed = new Decimal(0);
  let credit = new Decimal(0);
  let unknownCost = 0;
  const byAccount = new Map<string, Decimal>();
  for (const { payload } of units) {
    const { totals } = computeSaleTotals(priceLines(payload.lines), dec(payload.billDiscount), new Decimal(0));
    sales = sales.add(totals.grandTotal);
    gst = gst.add(totals.gstTotal);
    const paid = sum(payload.payments.map((p) => dec(p.amount)));
    if (paid.lt(totals.grandTotal)) owed = owed.add(totals.grandTotal.sub(paid));
    if (paid.gt(totals.grandTotal)) credit = credit.add(paid.sub(totals.grandTotal));
    for (const p of payload.payments) byAccount.set(p.accountId, (byAccount.get(p.accountId) ?? new Decimal(0)).add(dec(p.amount)));
    unknownCost += payload.lines.filter((l) => l.unitCost === null).length;
  }
  const accounts = await prisma.receivingAccount.findMany({
    where: { id: { in: [...byAccount.keys()] } },
    select: { id: true, name: true },
  });
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const dates = units.map((u) => u.payload.saleDate).sort();
  const courier = sum(units.map((u) => dec(u.payload.courier)));
  return [
    `${units.length} bill(s) from ${dates[0]} to ${dates.at(-1)}, with ${units.reduce((n, u) => n + u.payload.lines.length, 0)} item line(s).`,
    `Sales ${inr(sales)} including GST of ${inr(gst)}.`,
    `Payments: ${[...byAccount].map(([id, amount]) => `${accountName.get(id) ?? id} ${inr(amount)}`).join(", ") || "none"}.`,
    ...(owed.gt(0) ? [`Still owed by customers: ${inr(owed)}.`] : []),
    ...(credit.gt(0) ? [`Kept as customer credit (paid more than the bill): ${inr(credit)}.`] : []),
    ...(courier.gt(0) ? [`Courier charges recorded as expenses: ${inr(courier)}.`] : []),
    ...(unknownCost ? [`${unknownCost} item line(s) have no landed cost; their profit is left out, not guessed.`] : []),
    "Stock is not changed: the opening count already reflects these sales. Once approved, bills are corrected with returns, not rolled back.",
  ];
}

/** A past sale exactly as it happened: the price charged, its cost then, and the money taken that day. */
async function createHistoricalBill(tx: Tx, ctx: RequestContext, batch: BatchRef, bill: BillPayload) {
  const variants = await tx.variant.findMany({ where: { id: { in: bill.lines.map((l) => l.variantId) } } });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const priced = priceLines(bill.lines);
  const { lines, totals } = computeSaleTotals(priced, dec(bill.billDiscount), new Decimal(0));
  const customer = bill.customerId ? await tx.customer.findUnique({ where: { id: bill.customerId }, select: { name: true } }) : null;
  const date = toDbDate(bill.saleDate);
  const at = new Date(`${bill.saleDate}T12:00:00+05:30`);

  const order = await tx.salesOrder.create({
    data: {
      code: await nextCode(tx, `SO-${financialYear(bill.saleDate)}`, 5),
      type: "REGULAR",
      channel: bill.channel,
      fulfilment: "COUNTER",
      customerId: bill.customerId,
      customerName: customer?.name ?? null,
      locationId: batch.locationId!,
      orderDate: date,
      dueDate: date,
      subtotal: totals.subtotal,
      lineDiscounts: totals.lineDiscounts,
      orderDiscount: totals.orderDiscount,
      shippingCharged: totals.shippingCharged,
      grandTotal: totals.grandTotal,
      taxableTotal: totals.taxableTotal,
      gstTotal: totals.gstTotal,
      externalRef: bill.billId,
      notes: bill.notes,
      importBatchId: batch.id,
      createdById: ctx.userId,
      lines: {
        createMany: {
          data: bill.lines.map((l, position) => {
            const v = byId.get(l.variantId)!;
            const unitPrice = dec(l.unitPrice);
            return {
              variantId: l.variantId,
              position,
              quantity: l.quantity,
              regularPrice: v.regularPrice,
              unitPrice,
              priceSource: unitPrice.eq(v.regularPrice.toString())
                ? ("REGULAR" as const)
                : v.offerPrice && unitPrice.eq(v.offerPrice.toString())
                  ? ("OFFER" as const)
                  : ("MANUAL" as const),
              lineDiscount: priced[position]!.lineDiscount,
              orderDiscountShare: lines[position]!.orderDiscountShare,
              lineTotal: lines[position]!.lineTotal,
              gstRate: priced[position]!.gstRate,
              taxableValue: lines[position]!.taxableValue,
              gstAmount: lines[position]!.gstAmount,
              cogs: l.unitCost ? dec(l.unitCost).mul(l.quantity) : new Decimal(0),
              unknownCostQty: l.unitCost ? 0 : l.quantity,
            };
          }),
        },
      },
    },
  });
  await tx.salesOrder.update({
    where: { id: order.id },
    data: { status: "COMPLETED", confirmedAt: at, fulfilledAt: at, fulfilledDate: date },
  });
  await addEvent(tx, ctx, order.id, "imported", "COMPLETED", `Past sale from ${batch.code}; stock was not changed`);
  await recordAudit(tx, ctx, {
    action: "sale.imported",
    entity: "SalesOrder",
    entityId: order.id,
    after: { code: order.code, billId: bill.billId, batch: batch.code, grandTotal: totals.grandTotal.toString() },
  });

  let remaining = totals.grandTotal;
  for (const p of bill.payments) {
    const amount = dec(p.amount);
    const applied = Decimal.min(amount, remaining);
    remaining = remaining.sub(applied);
    // The file states no provider fee, so none is added: an imported fee would be a guess.
    await recordReceipt(tx, ctx, {
      customerId: bill.customerId,
      accountId: p.accountId,
      amount,
      fee: new Decimal(0),
      reference: bill.billId,
      businessDate: date,
      notes: `Imported from ${batch.code}`,
      allocations: applied.gt(0) ? [{ orderId: order.id, amount: applied }] : [],
      excessToCredit: true,
    });
  }

  if (dec(bill.courier).gt(0)) {
    await createExpenseInTx(tx, ctx, {
      categoryId: batch.options.courierCategory!,
      kind: "ORDER",
      orderId: order.id,
      accountId: batch.options.courierAccount!,
      amount: bill.courier,
      businessDate: bill.saleDate,
      reference: bill.billId,
      notes: `Courier for bill ${bill.billId}, imported from ${batch.code}`,
    });
  }
  return order.id;
}
