/**
 * Sales entered late and handed over before handover took a date count their
 * revenue on the click day. This lists every fulfilled order whose revenue day
 * is after its order date and, for the codes you name, moves revenue back to
 * the order date. Each move is an order event and an audit row.
 *
 *   pnpm --filter crm-api redate-handovers                       # list only
 *   pnpm --filter crm-api redate-handovers --apply SO-2627-00002,SO-2627-00003
 *   pnpm --filter crm-api redate-handovers --apply all
 *
 * On the server, with dist built: node dist/scripts/redate-handovers.js [--apply …]
 */
import "dotenv/config";
import { prisma } from "@repo/crm-db/client";
import { fromDbDate } from "../core/dates";
import { redateFulfilment } from "../modules/sales/sales.service";

const REASON = "Entered late; revenue moved to the sale date";

async function main() {
  const flag = process.argv.indexOf("--apply");
  const apply = flag === -1 ? null : process.argv[flag + 1];
  if (flag !== -1 && !apply) throw new Error("--apply needs order codes (comma-separated) or 'all'");

  const late = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SalesOrder"
    WHERE "fulfilledDate" > "orderDate" AND status <> 'CANCELLED' AND "importBatchId" IS NULL`;
  const orders = await prisma.salesOrder.findMany({
    where: { id: { in: late.map((o) => o.id) } },
    select: { id: true, code: true, type: true, fulfilment: true, orderDate: true, fulfilledDate: true, grandTotal: true },
    orderBy: { code: "asc" },
  });

  console.log(`${orders.length} order(s) count revenue after their order date:\n`);
  for (const o of orders) {
    console.log(
      `  ${o.code}  ${o.type === "PRE_ORDER" ? "pre-order" : o.fulfilment === "COUNTER" ? "counter" : "delivery"}  ` +
        `ordered ${fromDbDate(o.orderDate)}  revenue ${fromDbDate(o.fulfilledDate!)}  ₹${o.grandTotal.toFixed(2)}`,
    );
  }
  if (!apply) {
    console.log("\nNothing changed. Pre-orders and delivery orders often leave later on purpose; name only the late entries.");
    return;
  }

  const codes = apply === "all" ? orders.map((o) => o.code) : apply.split(",").map((c) => c.trim());
  const wanted = orders.filter((o) => codes.includes(o.code));
  const unknown = codes.filter((c) => !orders.some((o) => o.code === c));
  if (unknown.length) throw new Error(`Not in the list above: ${unknown.join(", ")}. Nothing changed.`);

  const ctx = { userId: null, ip: null, userAgent: "scripts/redate-handovers", requestId: null };
  console.log("");
  for (const o of wanted) {
    await redateFulfilment(o.id, fromDbDate(o.orderDate), REASON, ctx);
    console.log(`  ${o.code}: revenue moved ${fromDbDate(o.fulfilledDate!)} → ${fromDbDate(o.orderDate)}`);
  }
  console.log(`\n${wanted.length} order(s) moved.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
