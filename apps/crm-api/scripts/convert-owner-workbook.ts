/**
 * Turns the owner's old workbook (Little_Stepz_Complete_Dashboard_*.xlsx) into
 * files for the CRM's import screens, applying the owner's answers of
 * 2026-11-01 (tasks/crm.md, "Owner answers and supplier balances"). It only
 * reads the workbook and writes files; nothing touches a database.
 *
 *   npx tsx scripts/convert-owner-workbook.ts <workbook.xlsx> <output folder>
 */
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const UNNAMED_CUSTOMER = "Old sheet – unnamed customers";
const SETUP_DATE = "2026-08-22";
const SETUP_CATEGORY = "Business Setup";
const SETUP_ACCOUNT = "Owner – setup funds";
const MISSING_PRICE_MARKER = "11";
const PLACEHOLDER_PRICE = "1";
const WEBSITE_GST = "18";

type Row = Record<string, string | number | null> & { _row: number };

const [workbookPath, outDir] = process.argv.slice(2);
if (!workbookPath || !outDir) {
  console.error("usage: npx tsx scripts/convert-owner-workbook.ts <workbook.xlsx> <output folder>");
  process.exit(1);
}

/** Formula results, rich text and dates as plain values; Excel dates have no time zone, so the UTC date is the sheet's date. */
function cellValue(cell: ExcelJS.Cell): string | number | null {
  let v: unknown = cell.value;
  if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) v = (v as { result?: unknown }).result;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text);
    return null; // a formula error
  }
  return v as string | number;
}

function records(book: ExcelJS.Workbook, sheet: string, headerRow: number, key: string): Row[] {
  const ws = book.getWorksheet(sheet);
  if (!ws) throw new Error(`Sheet "${sheet}" is missing`);
  const headers = new Map<number, string>();
  ws.getRow(headerRow).eachCell((cell, col) => {
    const v = cellValue(cell);
    if (v !== null && v !== "" && !headers.has(col)) headers.set(col, String(v).trim());
  });
  const out: Row[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const o: Row = { _row: n };
    row.eachCell((cell, col) => {
      const name = headers.get(col);
      if (name && !(name in o)) o[name] = cellValue(cell);
    });
    if (o[key] !== null && o[key] !== undefined && o[key] !== "") out.push(o);
  });
  return out;
}

const num = (v: unknown) => Number(v) || 0;
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
/** Landed costs carry many decimals in the sheet; the CRM keeps six. */
const cost = (v: unknown) => (v === null || v === undefined || v === "" ? "" : (Math.round(Number(v) * 1e6) / 1e6).toString());
const placeholder = (sku: string) => /^PEND-|^BUNDLE-/.test(sku);

interface Item {
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  cost: string;
  note: string | null;
}

/**
 * The CRM keeps one line per item on a bill. The sheet sometimes splits one item
 * across rows at prices a rupee apart (₹1,900 for 3 = 2 × ₹633 + 1 × ₹634); those
 * become one line at the higher price with the difference as a line discount, so
 * the bill total is unchanged. Different costs for one item can't be merged.
 */
function oneLinePerItem(billId: string, rows: Row[]): Item[] {
  const bySku = new Map<string, Row[]>();
  for (const r of rows) bySku.set(text(r.sys_SKU), [...(bySku.get(text(r.sys_SKU)) ?? []), r]);
  return [...bySku].map(([sku, group]) => {
    const quantity = group.reduce((s, r) => s + num(r["Quantity Sold"]), 0);
    const price = Math.max(...group.map((r) => num(r["Actual Selling Price"])));
    const charged = group.reduce((s, r) => s + num(r["Quantity Sold"]) * num(r["Actual Selling Price"]), 0);
    const costs = new Set(group.map((r) => cost(r["Landed Cost / Piece"])));
    if (costs.size > 1) throw new Error(`Bill ${billId} has ${sku} at different landed costs; it can't be one line`);
    const note =
      group.length > 1
        ? `${sku} ${group.map((r) => `${num(r["Quantity Sold"])} × ₹${num(r["Actual Selling Price"])}`).join(" + ")} combined into one line`
        : null;
    return { sku, quantity, price, discount: Math.round((quantity * price - charged) * 100) / 100, cost: [...costs][0]!, note };
  });
}

function csv(rows: (string | number)[][]) {
  const field = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

async function main() {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(workbookPath!);

  const catalog = records(book, "CATALOG", 4, "SKU");
  const sales = records(book, "DAILY SALES ENTRY", 6, "Sale Date").filter((x) => text(x.sys_SKU));
  const bills = records(book, "TRANSACTIONS", 6, "Transaction ID");
  const laterPayments = records(book, "SALES PAYMENTS", 6, "Payment Date").filter((x) => text(x["Transaction ID"]));
  const errors = records(book, "ERRORS – NEED MY CONFIRMATION", 6, "Issue").filter((x) => x.Status === "Open");
  const setup = records(book, "Business Setup", 3, "Expense").filter((x) => typeof x["S.No"] === "number");

  // ─── Products ──────────────────────────────────────────────────────────────
  const sameName = new Map<string, number>();
  for (const x of catalog) sameName.set(text(x.Name).toLowerCase(), (sameName.get(text(x.Name).toLowerCase()) ?? 0) + 1);
  const priceMarked: string[] = [];
  const placeholderPriced: string[] = [];
  const products = catalog.map((x) => {
    const sku = text(x.SKU);
    let price = text(x.Ref);
    if (!price && placeholder(sku)) {
      price = PLACEHOLDER_PRICE;
      placeholderPriced.push(sku);
    } else if (!price) {
      price = MISSING_PRICE_MARKER;
      priceMarked.push(sku);
    }
    const shared = (sameName.get(text(x.Name).toLowerCase()) ?? 0) > 1;
    return [
      text(x.Name),
      text(x.Cat),
      sku,
      "0",
      price,
      text(x.Brand) === "(No brand)" ? "" : text(x.Brand),
      shared ? "Old SKU" : "",
      shared ? sku : "",
      text(x.Threshold),
    ];
  });

  // ─── Opening stock: only counts nobody doubted (the shelf-count rule the client was sent) ───
  const soldBelowZero = new Set(
    records(book, "DAILY SALES ENTRY", 6, "Sale Date")
      .filter((s) => /Stock below zero/.test(text(s["Entry Check"])))
      .map((s) => text(s.sys_SKU)),
  );
  const doubted = (sku: string, stock: number) =>
    stock < 0 ||
    soldBelowZero.has(sku) ||
    errors.some((e) => text(e.Product).includes(sku) && /stock|count|physical/i.test(text(e.Issue))) ||
    /^(YG-|HW-|PREMIUM-|HRV|STANLEY-|STN-)/.test(sku);
  const stockRows: (string | number)[][] = [];
  const stockLeftBlank: string[] = [];
  for (const x of catalog) {
    const sku = text(x.SKU);
    const stock = num(x.Stock);
    if (placeholder(sku)) continue;
    if (doubted(sku, stock)) {
      if (stock !== 0) stockLeftBlank.push(`${sku} (${stock})`);
      continue;
    }
    if (stock > 0) stockRows.push([sku, stock, cost(x.Landed)]);
  }

  // ─── Past sales ────────────────────────────────────────────────────────────
  const linesOf = new Map<string, Row[]>();
  for (const s of sales) linesOf.set(text(s["Transaction ID"]), [...(linesOf.get(text(s["Transaction ID"])) ?? []), s]);
  const notesOf = (id: string) => [...new Set((linesOf.get(id) ?? []).map((s) => text(s.Notes)).filter(Boolean))];
  const channelOf = (b: Row) => {
    const id = text(b["Transaction ID"]);
    const notes = notesOf(id).join(" ");
    if (/^[0-9A-F]{8}$/.test(id) || /website/i.test(notes)) return "Website";
    if (/ONLINE/i.test(id) || num(b["Direct Selling Exp."]) > 0 || /courier|dispatch/i.test(notes)) return "Other";
    return "Store";
  };
  const walkIn = (name: string) => !name || /^(walk[\s-]?in|cash)(\s+customer)?$/i.test(name);

  const salesRows: (string | number)[][] = [];
  const emptyBills: string[] = [];
  const toUnnamed: string[] = [];
  const named = new Set<string>();
  let sold = 0;
  let received = 0;
  let courier = 0;
  let websiteSales = 0;
  const byMethod = { PhonePe: 0, Cash: 0, Online: 0 };
  for (const b of bills) {
    const id = text(b["Transaction ID"]);
    const lines = linesOf.get(id) ?? [];
    if (lines.length === 0) {
      const hasMoney = ["Bill Total", "Total Received (net)", "Direct Selling Exp.", "Paid Later"].some((k) => num(b[k]) !== 0);
      if (hasMoney) throw new Error(`Bill ${id} carries money but has no item lines`);
      emptyBills.push(id);
      continue;
    }
    const total = lines.reduce((s, l) => s + num(l["Quantity Sold"]) * num(l["Actual Selling Price"]), 0);
    const paid = [num(b["PhonePe (at sale)"]), num(b["Cash (at sale)"]), num(b["Online (at sale)"])];
    const paidAtSale = paid.reduce((s, p) => s + p, 0);
    const later = num(b["Paid Later"]);
    const channel = channelOf(b);
    const notes = notesOf(id);
    const items = oneLinePerItem(id, lines);
    notes.push(...items.flatMap((item) => (item.note ? [item.note] : [])));
    if (num(b["Bill Total"]) === 0 && total > 0) notes.unshift(`Old sheet bill total was ₹0; priced from its lines (₹${money(total)})`);

    let customer = text(b.Customer);
    if (walkIn(customer)) {
      customer = "";
      if (Math.abs(paidAtSale + later - total) > 0.005) {
        customer = UNNAMED_CUSTOMER;
        toUnnamed.push(`${id} (bill ₹${money(total)}, received ₹${money(paidAtSale + later)})`);
        notes.unshift("No customer named in the old sheet");
      }
    } else named.add(customer);

    sold += total;
    received += paidAtSale + later;
    courier += num(b["Direct Selling Exp."]);
    if (channel === "Website") websiteSales += total;
    byMethod.PhonePe += paid[0]!;
    byMethod.Cash += paid[1]!;
    byMethod.Online += paid[2]!;

    items.forEach((item, i) => {
      const first = i === 0;
      salesRows.push([
        id,
        text(b["Sale Date"]),
        item.sku,
        item.quantity,
        money(item.price),
        item.discount ? money(item.discount) : "",
        item.cost,
        channel === "Website" ? WEBSITE_GST : "0",
        first && paid[0] ? money(paid[0]) : "",
        first && paid[1] ? money(paid[1]) : "",
        first && paid[2] ? money(paid[2]) : "",
        first && num(b["Direct Selling Exp."]) ? money(num(b["Direct Selling Exp."])) : "",
        channel,
        customer,
        first ? notes.join(" · ").slice(0, 480) : "",
      ]);
    });
  }

  // ─── Customers, later payments, setup expenses, supplier balances ──────────
  const customers = [...named].sort().map((name) => [name, ""]);
  if (toUnnamed.length) customers.push([UNNAMED_CUSTOMER, "Holds the dues and extra payments of old-sheet bills that named no customer"]);

  const later = laterPayments.map((p) => [
    text(p["Payment Date"]),
    text(p["Transaction ID"]),
    text(p["Customer Name"]),
    num(p["PhonePe Amount"]) ? "PhonePe" : num(p["Cash Amount"]) ? "Cash" : "Online",
    money(num(p["PhonePe Amount"]) + num(p["Cash Amount"]) + num(p["Online Amount"])),
    text(p.Notes),
  ]);

  const zeroSetup = setup.filter((x) => num(x["Amount (₹)"]) <= 0).map((x) => text(x.Expense));
  const expenses = setup
    .filter((x) => num(x["Amount (₹)"]) > 0)
    .map((x) => [
      SETUP_DATE,
      SETUP_CATEGORY,
      money(num(x["Amount (₹)"])),
      SETUP_ACCOUNT,
      `${text(x.Expense)} (setup cost; date to be set)`,
    ]);
  const setupTotal = setup.reduce((s, x) => s + num(x["Amount (₹)"]), 0);

  const supplierBalances = [
    [
      "Hot Wheels supplier",
      "OURS",
      "20420.00",
      "2026-10-17",
      "Paid ₹1,10,000 for 10 Mainline cases; 8 received (₹88,000) and ₹1,580 shipping deducted. Includes the 2 cases still owed (₹22,000); the ₹480 shipping refund is unconfirmed.",
    ],
    ["Anil Ji (RMB sourcing)", "OURS", "8573.70", "2026-10-31", "Final credit after 7 RMB payments (₹17,48,400) per the RMB ledger."],
  ];

  mkdirSync(outDir!, { recursive: true });
  const write = (name: string, header: string[], rows: (string | number)[][]) => writeFileSync(join(outDir!, name), csv([header, ...rows]));
  write(
    "1-products.csv",
    ["Product name", "Category", "SKU", "GST %", "Regular price", "Brand", "Option name", "Option value", "Reorder level"],
    products,
  );
  write("2-opening-stock.csv", ["SKU", "Quantity", "Landed unit cost"], stockRows);
  write("3-customers.csv", ["Name", "Notes"], customers);
  write(
    "4-past-sales.csv",
    [
      "Transaction ID",
      "Sale Date",
      "Product SKU",
      "Quantity Sold",
      "Actual Selling Price",
      "Line Discount",
      "Landed Cost / Piece",
      "GST %",
      "PhonePe Amount",
      "Cash Amount",
      "Online Amount",
      "Courier Charges",
      "Channel",
      "Customer Name",
      "Notes",
    ],
    salesRows,
  );
  write("5-later-payments.csv", ["Date", "Bill", "Customer", "Paid by", "Amount", "Notes"], later);
  write("6-setup-expenses.csv", ["Date paid", "Expense category", "Amount", "Paid from", "Description"], expenses);
  write("7-supplier-balances.csv", ["Supplier", "Direction", "Amount", "Date", "Notes"], supplierBalances);

  const summary = [
    `Products: ${products.length} rows (${priceMarked.length} with no price set to ₹${MISSING_PRICE_MARKER}: ${priceMarked.join(", ")}; ${placeholderPriced.length} placeholders at ₹${PLACEHOLDER_PRICE}). GST 0% on every category.`,
    `Opening stock: ${stockRows.length} products, ${stockRows.reduce((s, r) => s + Number(r[1]), 0)} pieces. Left blank for the client to count: ${stockLeftBlank.length} with stock in the sheet (${stockLeftBlank.join(", ")}).`,
    `Customers: ${customers.length} (${[...named].length} named in the sheet${toUnnamed.length ? ` + "${UNNAMED_CUSTOMER}"` : ""}).`,
    `Past sales: ${bills.length - emptyBills.length} bills, ${salesRows.length} lines, ₹${money(sold)} sold (Website ₹${money(websiteSales)} at ${WEBSITE_GST}% GST, the rest at 0%).`,
    `  Paid at sale: PhonePe ₹${money(byMethod.PhonePe)}, Cash ₹${money(byMethod.Cash)}, Online ₹${money(byMethod.Online)}. Paid later: ₹${money(later.reduce((s, r) => s + Number(r[4]), 0))}. Received in all: ₹${money(received)}.`,
    `  Courier on ${bills.filter((b) => num(b["Direct Selling Exp."])).length} bills: ₹${money(courier)}.`,
    `  On "${UNNAMED_CUSTOMER}": ${toUnnamed.join(", ")}.`,
    ...(emptyBills.length ? [`  Left out as empty (no items, no money): ${emptyBills.join(", ")}.`] : []),
    `Setup expenses: ${expenses.length} dated ${SETUP_DATE}, ₹${money(setupTotal)} in all, under "${SETUP_CATEGORY}" paid from "${SETUP_ACCOUNT}".${zeroSetup.length ? ` Left out at ₹0: ${zeroSetup.join(", ")}.` : ""}`,
    `Supplier balances: ${supplierBalances.map((s) => `${s[0]} ₹${s[2]} (${s[1] === "OURS" ? "they hold ours" : "we owe"})`).join("; ")}.`,
  ].join("\n");
  writeFileSync(join(outDir!, "summary.txt"), summary + "\n");
  console.log(summary);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
