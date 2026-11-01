import { randomInt, randomUUID } from "crypto";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { IMPORT_MAX_BYTES } from "@repo/crm-schema";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let store: string;
let cash: string;
let upi: string;
let courierCategory: string;
let skuA: string;
let skuB: string;
let ravi: { id: string; name: string };

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const post = (path: string, body: object) => api().post(`/api/v1${path}`).set(admin.auth).send(body);
const upload = (kind: string, fileName: string, body: Buffer, extra: Record<string, string | number> = {}) =>
  api()
    .post("/api/v1/imports")
    .query({ kind, fileName, ...extra })
    .set(admin.auth)
    .set("Content-Type", "application/octet-stream")
    .send(body);
const check = (id: string, body: Record<string, unknown>) => api().put(`/api/v1/imports/${id}/mapping`).set(admin.auth).send(body);
const rows = async (id: string) =>
  (await api().get(`/api/v1/imports/${id}/rows`).query({ limit: 100 }).set(admin.auth)).body.data.items as {
    rowNumber: number;
    status: string;
    errors: string[];
    duplicateOf: string | null;
  }[];

beforeAll(async () => {
  admin = await sessionAs("ADMIN");
  const categoryId = (await post("/categories", { name: `History ${uid()}`, gstRate: "18" })).body.data.id;
  const product = async (price: string) =>
    (
      await post("/products", {
        name: `Old stock ${uid()}`,
        categoryId,
        gstRate: null,
        variants: [{ sku: `OS-${uid()}`, regularPrice: price }],
      })
    ).body.data.variants[0].sku as string;
  [skuA, skuB] = [await product("1000"), await product("500")];
  store = (await post("/settings/locations", { code: `HI${uid()}`, name: "History store", type: "STORE" })).body.data.id;
  cash = (await post("/settings/receiving-accounts", { name: `Till ${uid()}`, method: "CASH" })).body.data.id;
  upi = (await post("/settings/receiving-accounts", { name: `PhonePe ${uid()}`, method: "UPI" })).body.data.id;
  const name = `Courier ${uid()}`;
  courierCategory = (await post("/expenses/categories", { name })).body.data.find((c: { name: string }) => c.name === name).id;
  const customer = (await post("/customers", { name: `Ravi ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}` })).body
    .data;
  ravi = { id: customer.id, name: customer.name };
});

/** A workbook shaped like the owner's: a guide sheet first, then a sheet with a merged title above its headings. */
async function ownerWorkbook(salesRows: (string | number | null)[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Guide").addRow(["Start here: enter sales on the next sheet"]);
  const sheet = workbook.addWorksheet("Sales");
  sheet.addRow(["PAST SALES"]);
  sheet.mergeCells("A1:D1");
  sheet.addRow([]);
  sheet.addRow([
    "Sale Date",
    "Transaction ID",
    "Product SKU",
    "Quantity Sold",
    "Actual Selling Price",
    "PhonePe Amount",
    "Cash Amount",
    "Online Amount",
    "Courier Charges",
    "Customer Name",
    "Landed Cost / Piece",
    "Bill Discount (once per bill)",
  ]);
  salesRows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("Reading owner workbooks", () => {
  it("asks which sheet to read, finds the headings under the title and refuses oversized files clearly", async () => {
    const file = await ownerWorkbook([[new Date("2026-09-24"), "B-1", skuA, 1, 1000, 1000, null, null, null, null, 600, null]]);
    const pick = await upload("HISTORICAL_SALES", "owner.xlsx", file);
    expect(pick.status).toBe(400);
    expect(pick.body.error).toMatchObject({ code: "IMPORT_PICK_SHEET", details: { sheets: ["Guide", "Sales"] } });

    const read = await upload("HISTORICAL_SALES", "owner.xlsx", file, { sheet: "sales" });
    expect(read.status).toBe(201);
    expect(read.body.data).toMatchObject({ sheetName: "Sales", headerRow: 3, totalRows: 1 });
    expect(read.body.data.suggestedMapping).toMatchObject({
      billId: "Transaction ID",
      saleDate: "Sale Date",
      sku: "Product SKU",
      quantity: "Quantity Sold",
      unitPrice: "Actual Selling Price",
      payment1: "PhonePe Amount",
      payment2: "Cash Amount",
      payment3: "Online Amount",
      courier: "Courier Charges",
      customer: "Customer Name",
      unitCost: "Landed Cost / Piece",
      billDiscount: "Bill Discount (once per bill)",
    });
    expect(read.body.data.sample[0]).toMatchObject({ "Sale Date": "2026-09-24", "Product SKU": skuA });

    const chosenRow = await upload("CUSTOMERS", "list.csv", Buffer.from("Customer list\nexported today\nName,City\nAsha,Pune"), {
      headerRow: 3,
    });
    expect(chosenRow.body.data).toMatchObject({ headers: ["Name", "City"], headerRow: 3, totalRows: 1 });

    const tooBig = await upload("CUSTOMERS", "huge.csv", Buffer.alloc(IMPORT_MAX_BYTES + 1, 65));
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error).toMatchObject({ code: "FILE_TOO_LARGE", message: "The file is too large (the limit is 5 MB)" });
  });
});

describe("Past sales import", () => {
  it("records each bill on its own date with its payments and costs, never moves stock, and refuses to import a bill twice", async () => {
    const t = uid();
    const bill = (n: number) => `${t}-${n}`;
    const file = await ownerWorkbook([
      // Walk-in, paid in full by PhonePe.
      ["2026-09-24", bill(1), skuA, 1, 1000, 1000, null, null, null, "Walk-in customer", 600, null],
      // Two items, a bill discount, split payment over two rows and a courier charge; one cost unknown.
      ["25-09-2026", bill(2), skuA, 1, 900, null, 1000, null, 60, null, 600, 100],
      ["25-09-2026", bill(2), skuB, 2, 500, 800, null, null, null, null, null, null],
      // A known customer who still owes ₹600.
      ["2026-09-26", bill(3), skuA, 1, 1000, 400, null, null, null, ravi.name, 600, null],
      // Walk-in paid more than the bill: refused.
      ["2026-09-27", bill(4), skuB, 1, 500, null, 600, null, null, null, 250, null],
      // An item that doesn't exist.
      ["2026-09-27", bill(5), "NO-SUCH-SKU", 1, 100, null, 100, null, null, null, null, null],
      // The same item on two rows of one bill becomes one line.
      ["2026-09-28", bill(6), skuA, 1, 1000, null, 2000, null, null, null, 600, null],
      ["2026-09-28", bill(6), skuA, 1, 1000, null, null, null, null, null, 600, null],
      // The payment on its own row, with no item.
      ["2026-09-29", bill(7), skuB, 1, 500, null, null, null, null, null, 250, null],
      ["2026-09-29", bill(7), null, null, null, null, 500, null, null, null, null, null],
    ]);
    const up = await upload("HISTORICAL_SALES", "history.xlsx", file, { sheet: "Sales" });
    expect(up.status).toBe(201);
    const batch = up.body.data;
    const mapping = batch.suggestedMapping;

    const noAccount = await check(batch.id, { mapping, locationId: store });
    expect(noAccount.body.error.details.fieldErrors["options.payment1Account"]).toBeDefined();

    const options = { payment1Account: upi, payment2Account: cash, payment3Account: upi, courierAccount: cash, courierCategory };
    const checked = await check(batch.id, { mapping, locationId: store, options });
    expect(checked.status).toBe(200);
    expect(checked.body.data).toMatchObject({ validRows: 8, errorRows: 2, duplicateRows: 0 });
    expect(checked.body.data.summary).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^5 bill\(s\) from 2026-09-24 to 2026-09-29/),
        "Still owed by customers: ₹600.00.",
        "Courier charges recorded as expenses: ₹60.00.",
        "1 item line(s) have no landed cost; their profit is left out, not guessed.",
      ]),
    );
    const all = await rows(batch.id);
    expect(all.find((r) => r.rowNumber === 8)!.errors[0]).toMatch(/Received ₹600.00 for a ₹500.00 bill/);
    expect(all.find((r) => r.rowNumber === 9)!.errors[0]).toMatch(/NO-SUCH-SKU not found/);

    const approved = await api().post(`/api/v1/imports/${batch.id}/approve`).set(admin.auth);
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: "IMPORTED", importedRows: 8, rollbackBlocker: expect.stringMatching(/locked/) });

    const orders = await prisma.salesOrder.findMany({
      where: { importBatchId: batch.id },
      include: { lines: true, allocations: { include: { payment: true } }, expenses: true },
      orderBy: { orderDate: "asc" },
    });
    expect(orders.map((o) => o.externalRef)).toEqual([bill(1), bill(2), bill(3), bill(6), bill(7)]);
    for (const o of orders) expect(o).toMatchObject({ status: "COMPLETED", stockDocumentId: null, fulfilment: "COUNTER" });

    const two = orders[1]!;
    expect(two.fulfilledDate!.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(two.grandTotal.toFixed(2)).toBe("1800.00");
    expect(two.lines.find((l) => l.unknownCostQty === 0)!.cogs!.toFixed(2)).toBe("600.00");
    expect(two.lines.find((l) => l.unknownCostQty === 2)!.cogs!.toFixed(2)).toBe("0.00");
    expect(
      two.allocations.map((a) => [a.payment!.accountId, a.amount.toFixed(2), a.payment!.businessDate.toISOString().slice(0, 10)]).sort(),
    ).toEqual(
      [
        [cash, "1000.00", "2026-09-25"],
        [upi, "800.00", "2026-09-25"],
      ].sort(),
    );
    expect(two.allocations.every((a) => a.payment!.fee.isZero())).toBe(true);
    expect(two.expenses).toMatchObject([{ kind: "ORDER", accountId: cash, categoryId: courierCategory }]);
    expect(two.expenses[0]!.amount.toFixed(2)).toBe("60.00");

    expect(orders[2]).toMatchObject({ customerId: ravi.id, customerName: ravi.name });
    const owing = (await api().get(`/api/v1/sales/${orders[2]!.id}`).set(admin.auth)).body.data;
    expect(owing).toMatchObject({ paid: "400.00", due: "600.00", paymentStatus: "PARTIAL", importBatch: { code: batch.code } });
    expect(orders[3]!.lines).toHaveLength(1);
    expect(orders[3]!.lines[0]!.quantity).toBe(2);

    const variants = await prisma.variant.findMany({ where: { sku: { in: [skuA, skuB] } }, select: { id: true } });
    expect(await prisma.stockMovement.count({ where: { variantId: { in: variants.map((v) => v.id) } } })).toBe(0);

    const again = await upload("HISTORICAL_SALES", "history.xlsx", file, { sheet: "Sales" });
    const rechecked = await check(again.body.data.id, { mapping, locationId: store, options });
    expect(rechecked.body.data).toMatchObject({ validRows: 0, duplicateRows: 8 });

    const rollback = await api().post(`/api/v1/imports/${batch.id}/rollback`).set(admin.auth).send({ reason: "Try again" });
    expect(rollback.body.error.code).toBe("IMPORT_IN_USE");
  });

  it("charges the GST the file gives for a sale instead of the product's rate", async () => {
    const t = uid();
    const csv = [
      "Sale Date,Transaction ID,Product SKU,Quantity Sold,Actual Selling Price,Cash Amount,Channel,GST %",
      `2026-10-01,${t}-W,${skuA},1,1180,1180,Website,18%`,
      `2026-10-01,${t}-S,${skuB},1,500,500,Store,0`,
      `2026-10-01,${t}-P,${skuB},1,500,500,Store,`,
      `2026-10-01,${t}-X,${skuB},1,500,500,Store,7`,
    ].join("\n");
    const up = await upload("HISTORICAL_SALES", "gst.csv", Buffer.from(csv));
    expect(up.body.data.suggestedMapping).toMatchObject({ gstRate: "GST %", channel: "Channel" });
    const checked = await check(up.body.data.id, {
      mapping: up.body.data.suggestedMapping,
      locationId: store,
      options: { payment2Account: cash },
    });
    expect(checked.body.data).toMatchObject({ validRows: 3, errorRows: 1 });
    expect((await rows(up.body.data.id)).find((r) => r.rowNumber === 5)!.errors[0]).toMatch(/^GST %: "7" should be one of/);
    expect(checked.body.data.summary).toContain("Sales ₹2,180.00 including GST of ₹256.27.");

    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth);
    const orders = await prisma.salesOrder.findMany({ where: { importBatchId: up.body.data.id }, include: { lines: true } });
    const byBill = new Map(orders.map((o) => [o.externalRef, o]));
    expect(byBill.get(`${t}-W`)).toMatchObject({ channel: "WEBSITE" });
    expect(byBill.get(`${t}-W`)!.gstTotal.toFixed(2)).toBe("180.00");
    expect(byBill.get(`${t}-W`)!.lines[0]!.gstRate.toFixed(2)).toBe("18.00");
    expect(byBill.get(`${t}-S`)!.gstTotal.toFixed(2)).toBe("0.00");
    // A blank rate falls back to the product's (18% from its category).
    expect(byBill.get(`${t}-P`)!.gstTotal.toFixed(2)).toBe("76.27");
  });
});

describe("Expenses import", () => {
  it("matches categories and accounts, refuses what it can't tell apart and voids on rollback", async () => {
    const t = uid();
    const category = `Setup ${t}`;
    await post("/expenses/categories", { name: category });
    const account = (await post("/settings/receiving-accounts", { name: `Owner bank ${t}`, method: "BANK" })).body.data;
    const csv = [
      ["Date paid", "Expense", "Category", "Amount (₹)", "Paid via"],
      ["2026-10-01", "Number", category, '"5,200"', account.name],
      ["01-10-2026", "Logo", category.toLowerCase(), "1000", account.name.toUpperCase()],
      ["not a date", "Board", category, "4000", account.name],
      ["2026-10-01", "Chairs", "Furniture nobody added", "2100", account.name],
      ["2026-10-01", "Brooms", category, "230", "Cash"],
      ["2099-01-01", "Later", category, "100", account.name],
    ]
      .map((r) => r.join(","))
      .join("\n");
    const up = await upload("EXPENSES", "setup.csv", Buffer.from(csv));
    expect(up.body.data.suggestedMapping).toMatchObject({
      date: "Date paid",
      category: "Category",
      amount: "Amount (₹)",
      account: "Paid via",
      description: "Expense",
    });

    const checked = await check(up.body.data.id, { mapping: up.body.data.suggestedMapping });
    expect(checked.body.data).toMatchObject({ validRows: 2, errorRows: 4 });
    expect(checked.body.data.summary[0]).toBe("2 expense(s) totalling ₹6,200.00, from 2026-10-01 to 2026-10-01.");
    const all = await rows(up.body.data.id);
    expect(all.find((r) => r.rowNumber === 4)!.errors).toContain("Date paid: not a date");
    expect(all.find((r) => r.rowNumber === 5)!.errors[0]).toMatch(/doesn't exist/);
    expect(all.find((r) => r.rowNumber === 6)!.errors[0]).toMatch(/Paid from: "Cash" could be/);
    expect(all.find((r) => r.rowNumber === 7)!.errors[0]).toMatch(/future/);

    await api().post(`/api/v1/imports/${up.body.data.id}/approve`).set(admin.auth).expect(200);
    const created = await prisma.expense.findMany({ where: { accountId: account.id, reversalOfId: null }, orderBy: { amount: "desc" } });
    expect(created.map((e) => [e.amount.toFixed(2), e.notes, e.businessDate.toISOString().slice(0, 10)])).toEqual([
      ["5200.00", "Number", "2026-10-01"],
      ["1000.00", "Logo", "2026-10-01"],
    ]);

    await api().post(`/api/v1/imports/${up.body.data.id}/rollback`).set(admin.auth).send({ reason: "Wrong dates" }).expect(200);
    expect(await prisma.expense.count({ where: { reversalOfId: { in: created.map((e) => e.id) } } })).toBe(2);
  });
});
