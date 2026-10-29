/**
 * Idempotent base seed: business profile, locations, receiving accounts and the
 * owner's admin login. Anything marked SAMPLE is placeholder data for the owner
 * to replace in Settings; nothing here is a real business fact.
 *
 *   pnpm --filter crm-api seed
 */
import "dotenv/config";
import { prisma, type PaymentMethod } from "@repo/crm-db/client";
import { hashPassword } from "../core/password";

const SAMPLE_PROFILE = {
  legalName: "Little Stepz (SAMPLE — update in Settings)",
  tradeName: "Little Stepz",
  stateCode: "36",
  addressLine: "SAMPLE address — update in Settings",
  city: "Hyderabad",
  pincode: "500001",
  receiptFooter: "Thank you for shopping at Little Stepz!",
};

const LOCATIONS = [
  { code: "STORE", name: "Store", type: "STORE" as const },
  { code: "GODOWN", name: "Godown", type: "WAREHOUSE" as const },
];

const ACCOUNTS: { name: string; method: PaymentMethod; isPersonal?: boolean; feePercent?: string; details?: string }[] = [
  { name: "Cash Drawer", method: "CASH" },
  { name: "PhonePe — Business", method: "UPI" },
  { name: "PhonePe — Personal", method: "UPI", isPersonal: true },
  { name: "Website Gateway", method: "GATEWAY", feePercent: "2.00", details: "SAMPLE fee % — confirm with gateway" },
  { name: "Bank Account", method: "BANK", details: "SAMPLE — add bank name / last 4 digits" },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• Admin: skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• Admin: ${email} already exists`);
    return;
  }
  await prisma.user.create({
    data: {
      name: process.env.SEED_ADMIN_NAME?.trim() || "Owner",
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
    },
  });
  console.log(`• Admin: created ${email}`);
}

/** Demo logins share one obvious password and must never be enabled in production. */
async function seedDemoUsers() {
  if (process.env.SEED_DEMO_USERS !== "true") return;
  if (process.env.NODE_ENV === "production") throw new Error("SEED_DEMO_USERS is not allowed in production");

  const passwordHash = await hashPassword("Demo-pass-123");
  for (const user of [
    { name: "Demo Cashier (SAMPLE)", email: "cashier@demo.local", role: "CASHIER" as const },
    { name: "Demo Ops (SAMPLE)", email: "ops@demo.local", role: "OPS" as const },
  ]) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash, mustChangePassword: false },
      update: {},
    });
  }
  console.log("• Demo users: cashier@demo.local / ops@demo.local (password Demo-pass-123)");
}

async function main() {
  await prisma.businessProfile.upsert({ where: { id: "default" }, create: SAMPLE_PROFILE, update: {} });
  console.log("• Business profile: ready");

  for (const location of LOCATIONS) {
    await prisma.location.upsert({ where: { code: location.code }, create: location, update: {} });
  }
  console.log("• Locations: Store, Godown");

  for (const account of ACCOUNTS) {
    await prisma.receivingAccount.upsert({ where: { name: account.name }, create: account, update: {} });
  }
  console.log(`• Receiving accounts: ${ACCOUNTS.length}`);

  await seedAdmin();
  await seedDemoUsers();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
