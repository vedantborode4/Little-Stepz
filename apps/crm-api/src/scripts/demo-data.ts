/**
 * Clearly-marked SAMPLE data for demos and the scenario walkthrough. Created
 * through the real services, so it carries audit and price history like any
 * other record. Never run against production (refused when NODE_ENV=production).
 *
 *   pnpm --filter crm-api seed:demo
 */
import "dotenv/config";
import { prisma } from "@repo/crm-db/client";
import type { CreateProductInput } from "@repo/crm-schema";
import { createNamed } from "../modules/catalog/catalog.service";
import { createProduct } from "../modules/products/products.service";
import { createSupplier } from "../modules/suppliers/suppliers.service";

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

async function categoryId(name: string) {
  const category = await prisma.category.findUnique({ where: { nameKey: name.toLowerCase() } });
  if (!category) throw new Error(`Category "${name}" missing — run the base seed first`);
  return category.id;
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

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
