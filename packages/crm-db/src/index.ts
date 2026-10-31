import { PrismaClient, type Prisma } from "../generated/client/index.js";

export * from "../generated/client/index.js";

export const prisma = new PrismaClient({
  transactionOptions: { maxWait: 5_000, timeout: 20_000 },
});

export type Tx = Prisma.TransactionClient;
