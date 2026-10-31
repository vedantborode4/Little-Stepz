/**
 * Clearly-marked SAMPLE data for demos and the scenario walkthrough. Created
 * through the real services, so it carries audit and price history like any
 * other record. Never run against production (refused when NODE_ENV=production).
 *
 *   pnpm --filter crm-api seed:demo
 */
import "dotenv/config";
import { prisma } from "@repo/crm-db/client";
import {
  createCourierSchema,
  createCustomerSchema,
  receivePaymentSchema,
  salesOrderSchema,
  type CreateProductInput,
} from "@repo/crm-schema";
import { todayIST } from "../core/dates";
import { createNamed } from "../modules/catalog/catalog.service";
import { createProduct } from "../modules/products/products.service";
import { createSupplier } from "../modules/suppliers/suppliers.service";
import { recordOpeningStock } from "../modules/inventory/inventory.service";
import { createDraft, receivePurchase } from "../modules/purchases/purchases.service";
import { createCustomer, setCustomerPrice } from "../modules/customers/customers.service";
import { receivePayment } from "../modules/payments/payments.service";
import { createOrder } from "../modules/sales/sales.service";
import { createCourier } from "../modules/shipping/couriers.service";

const SYSTEM = { userId: null, ip: null, userAgent: null, requestId: "seed-demo" };
const SAMPLE_GST = "18" as const;

async function ensureBrand(name: string) {
  const existing = await prisma.brand.findUnique({ where: { nameKey: name.toLowerCase() } });
  return existing?.id ?? (await createNamed("brand", { name, isActive: true }, SYSTEM)).id;
}

async function ensureSupplier(name: string, currency: "INR" | "CNY", country: string) {
  const existing = await prisma.supplier.findUnique({ where: { nameKey: name.toLowerCase() } });
  return existing?.id ?? (await createSupplier({ name, currency, country, isActive: true }, SYSTEM)).id;
}

/** Real categories come from the owner's product import; demo products bring their own. */
async function categoryId(name: string) {
  const existing = await prisma.category.findUnique({ where: { nameKey: name.toLowerCase() } });
  return existing?.id ?? (await createNamed("category", { name, isActive: true, gstRate: null }, SYSTEM)).id;
}

async function ensureProduct(input: CreateProductInput) {
  const firstSku = input.variants[0]!.sku;
  if (await prisma.variant.findUnique({ where: { sku: firstSku } })) return;
  const product = await createProduct(input, SYSTEM);
  console.log(`  ${product.code} ${product.name} (${product.variants.length} variant${product.variants.length > 1 ? "s" : ""})`);
}

const base = { status: "ACTIVE" as const, gstRate: SAMPLE_GST, hsnCode: "9503" };

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo data is not allowed in production");

  const china = await ensureSupplier("Shantou Toys Trading (SAMPLE)", "CNY", "China");
  const local = await ensureSupplier("Mumbai Toy Distributors (SAMPLE)", "INR", "India");
  const yegao = await ensureBrand("YEGAO");
  const mjx = await ensureBrand("MJX");
  const hotWheels = await ensureBrand("Hot Wheels");
  const stanley = await ensureBrand("Stanley");

  console.log("• Sample products:");
  await ensureProduct({
    ...base,
    name: "YEGAO 1:64 Die-cast Car (SAMPLE)",
    categoryId: await categoryId("Premium Die-cast"),
    brandId: yegao,
    supplierId: china,
    scale: "1:64",
    options: [{ name: "Colour", values: ["Red", "Blue", "Black", "White"] }],
    variants: ["Red", "Blue", "Black", "White"].map((colour) => ({
      sku: `YG64-${colour.toUpperCase()}`,
      optionValues: [colour],
      regularPrice: "499",
      offerPrice: "449",
      wholesalePrice: "380",
      reorderLevel: 3,
    })),
  });
  await ensureProduct({
    ...base,
    name: "MJX Hyper Go Brushless RC Car (SAMPLE)",
    categoryId: await categoryId("RC Cars"),
    brandId: mjx,
    supplierId: china,
    scale: "1:14",
    options: [],
    variants: [
      { sku: "MJX-HG-14", optionValues: [], regularPrice: "20000", offerPrice: "19500", wholesalePrice: "17000", reorderLevel: 2 },
    ],
  });
  await ensureProduct({
    ...base,
    name: "Hot Wheels Basic Car (SAMPLE)",
    categoryId: await categoryId("Hot Wheels"),
    brandId: hotWheels,
    supplierId: local,
    scale: "1:64",
    options: [],
    variants: [{ sku: "HW-BASIC", optionValues: [], regularPrice: "199", reorderLevel: 20 }],
  });
  await ensureProduct({
    ...base,
    hsnCode: "9617",
    name: "Stanley Quencher Tumbler 40oz (SAMPLE)",
    categoryId: await categoryId("Stanley/Tumblers"),
    brandId: stanley,
    supplierId: local,
    options: [{ name: "Colour", values: ["Cream", "Black", "Rose Quartz"] }],
    variants: ["Cream", "Black", "Rose Quartz"].map((colour) => ({
      sku: `STN-Q40-${colour.split(" ")[0]!.toUpperCase()}`,
      optionValues: [colour],
      regularPrice: "4500",
      offerPrice: "4199",
      reorderLevel: 2,
    })),
  });
}

/** SAMPLE opening stock, only for items that have no stock history yet. */
async function ensureOpeningStock(locationCode: string, lines: { sku: string; quantity: number; unitCost?: string }[]) {
  const location = await prisma.location.findUniqueOrThrow({ where: { code: locationCode } });
  const variants = await prisma.variant.findMany({ where: { sku: { in: lines.map((l) => l.sku) }, stockMovements: { none: {} } } });
  const fresh = lines.flatMap((l) => {
    const variant = variants.find((v) => v.sku === l.sku);
    return variant ? [{ variantId: variant.id, quantity: l.quantity, unitCost: l.unitCost ?? null }] : [];
  });
  if (fresh.length === 0) return;
  const doc = await recordOpeningStock(
    { locationId: location.id, bucket: "SELLABLE", reference: "SAMPLE opening stock", lines: fresh },
    SYSTEM,
  );
  console.log(`  ${doc.code} opening stock at ${locationCode}: ${fresh.length} items`);
}

async function seedStock() {
  console.log("• Sample opening stock:");
  await ensureOpeningStock("STORE", [
    { sku: "YG64-RED", quantity: 5, unitCost: "300" },
    { sku: "YG64-BLUE", quantity: 8, unitCost: "300" },
    { sku: "YG64-BLACK", quantity: 4, unitCost: "300" },
    { sku: "YG64-WHITE", quantity: 3, unitCost: "300" },
    { sku: "HW-BASIC", quantity: 24 }, // cost deliberately unknown: shows how missing costs are handled
  ]);
  await ensureOpeningStock("GODOWN", [
    { sku: "STN-Q40-CREAM", quantity: 6, unitCost: "2900" },
    { sku: "STN-Q40-BLACK", quantity: 4, unitCost: "2900" },
    { sku: "STN-Q40-ROSE", quantity: 2, unitCost: "2900" },
  ]);
}

/**
 * Scenario A: 10 MJX RC cars bought from China at ¥900, SAMPLE rate ₹12/¥, with ₹8,000
 * freight and ₹9,000 duty → ₹12,500 landed each. Import IGST is recoverable, so it
 * stays out of stock cost.
 */
async function seedScenarioA() {
  const mjx = await prisma.variant.findUnique({ where: { sku: "MJX-HG-14" }, include: { purchaseLines: true } });
  if (!mjx || mjx.purchaseLines.length) return;
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { nameKey: "shantou toys trading (sample)" } });
  const store = await prisma.location.findUniqueOrThrow({ where: { code: "STORE" } });
  const visibility = { costs: true };
  const draft = await createDraft(
    {
      supplierId: supplier.id,
      invoiceNumber: "SAMPLE-INV-001",
      shipmentRef: "SAMPLE-BL-001",
      invoiceDate: todayIST(),
      locationId: store.id,
      notes: "SAMPLE purchase for Scenario A",
      currency: "CNY",
      exchangeRate: "12",
      allocationMethod: "VALUE",
      lines: [{ variantId: mjx.id, quantity: 10, unitPrice: "900" }],
      charges: [
        { type: "FREIGHT", amount: "8000", currency: "INR", isRecoverableTax: false },
        { type: "CUSTOMS_DUTY", amount: "9000", currency: "INR", isRecoverableTax: false },
        { type: "IGST", amount: "22860", currency: "INR", isRecoverableTax: true },
      ],
    },
    SYSTEM,
    visibility,
  );
  const received = await receivePurchase(draft.id, {}, SYSTEM, visibility);
  console.log(`• Scenario A: ${received.code} received — 10 × MJX at ${received.lines[0]?.costs?.landedUnitCost} landed`);
}

/** SAMPLE customers with fictional names and placeholder 90000 00xxx numbers. */
async function seedCustomers() {
  const customers = [
    { name: "SAMPLE Ravi Kumar", mobile: "9000000101", city: "Hyderabad", pincode: "500081", type: "RETAIL" as const },
    { name: "SAMPLE Priya Sharma", mobile: "9000000102", city: "Secunderabad", pincode: "500003", type: "RETAIL" as const },
    {
      name: "SAMPLE Toy Mart Wholesale",
      mobile: "9000000201",
      city: "Vijayawada",
      stateCode: "37" as const,
      pincode: "520001",
      type: "WHOLESALE" as const,
      creditDays: 30,
      creditLimit: "100000",
    },
  ];
  for (const c of customers) {
    if (await prisma.customer.findUnique({ where: { mobile: `+91${c.mobile}` } })) continue;
    // Parsed through the shared schema so the mobile is normalised exactly as the API would.
    const created = await createCustomer(createCustomerSchema.parse(c), SYSTEM);
    console.log(`• Customer ${created.code} ${created.name}`);
    if (c.type === "WHOLESALE") {
      const yegao = await prisma.variant.findUnique({ where: { sku: "YG64-RED" } });
      if (yegao) await setCustomerPrice(created.id, yegao.id, "549", SYSTEM);
    }
  }
}

/** Scenario E as SAMPLE data: a ₹20,000 pre-order with a ₹4,000 website advance, waiting to be allocated. */
async function seedScenarioE() {
  if (await prisma.salesOrder.findFirst({ where: { type: "PRE_ORDER", externalRef: "SAMPLE-WEB-1001" } })) return;
  const [customer, mjx, store, gateway] = await Promise.all([
    prisma.customer.findUnique({ where: { mobile: "+919000000102" } }),
    prisma.variant.findUnique({ where: { sku: "MJX-HG-14" } }),
    prisma.location.findUnique({ where: { code: "STORE" } }),
    prisma.receivingAccount.findUnique({ where: { name: "Website Gateway" } }),
  ]);
  if (!customer || !mjx || !store || !gateway) return;
  const order = await createOrder(
    salesOrderSchema.parse({
      type: "PRE_ORDER",
      channel: "WEBSITE",
      fulfilment: "COUNTER",
      customerId: customer.id,
      locationId: store.id,
      expectedArrival: todayIST(),
      externalRef: "SAMPLE-WEB-1001",
      notes: "SAMPLE pre-order (Scenario E)",
      confirm: true,
      lines: [{ variantId: mjx.id, quantity: 1, unitPrice: "20000" }],
    }),
    SYSTEM,
    { overridePrice: true },
    { costs: true },
  );
  await receivePayment(
    receivePaymentSchema.parse({
      customerId: customer.id,
      accountId: gateway.id,
      amount: "4000",
      reference: "SAMPLE-GW-1001",
      allocations: [{ orderId: order.id, amount: "4000" }],
    }),
    SYSTEM,
  );
  console.log(`• Scenario E: pre-order ${order.code} with ₹4,000 advance`);
}

/** SAMPLE couriers with their public tracking-page links (check the links with each courier). */
async function seedCouriers() {
  const couriers = [
    { name: "Delhivery (SAMPLE)", trackingUrlTemplate: "https://www.delhivery.com/track/package/{awb}" },
    { name: "DTDC (SAMPLE)", trackingUrlTemplate: "https://www.dtdc.in/tracking.asp?strCnno={awb}" },
    {
      name: "India Post (SAMPLE)",
      trackingUrlTemplate: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?id={awb}",
    },
  ];
  for (const c of couriers) {
    if (await prisma.courierPartner.findUnique({ where: { nameKey: c.name.toLowerCase() } })) continue;
    await createCourier(createCourierSchema.parse(c), SYSTEM);
    console.log(`• Courier ${c.name}`);
  }
}

main()
  .then(seedStock)
  .then(seedScenarioA)
  .then(seedCustomers)
  .then(seedScenarioE)
  .then(seedCouriers)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
