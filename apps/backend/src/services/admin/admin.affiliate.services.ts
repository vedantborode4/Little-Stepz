import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { AffiliateErrorCode } from "../../utils/affiliateErrors";
import { createAuditLogInTx, createAuditLog } from "../../utils/auditLog";
import { Decimal } from "decimal.js";
import type {
  AdminCommissionsQuery,
  AdminApproveCommissionBody,
  AdminPayCommissionBody,
} from "@repo/zod-schema/index";
import type { Request } from "express";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isSerial =
        err?.code === "P2034" ||
        err?.message?.includes("serialization failure") ||
        err?.message?.includes("could not serialize");
      if (isSerial && i < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i + 1) * 100 + Math.random() * 100));
        continue;
      }
      throw err;
    }
  }
  throw new ApiError(500, AffiliateErrorCode.CONCURRENCY_CONFLICT);
}

// GET /admin/affiliates — already in affiliate.services.ts

export async function adminApproveAffiliateOnlyService(
  adminUserId:  string,
  affiliateId:  string,
  commissionRate?: number,
  commissionType?: string,
  adminNote?:   string,
  req?:         Request
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string; userId: string; status: string;
    }>>`SELECT id, "userId", status FROM "Affiliate" WHERE id = ${affiliateId} FOR UPDATE`;

    const aff = rows[0];
    if (!aff) throw new ApiError(404, AffiliateErrorCode.AFFILIATE_NOT_FOUND);
    if (aff.status === "APPROVED") throw new ApiError(409, "Already approved");

    const updateData: any = {
      status:    "APPROVED",
      adminNote,
      approvedBy: adminUserId,
      approvedAt: new Date(),
    };
    if (commissionRate !== undefined) {
      if (commissionRate < 0.01 || commissionRate > 0.20)
        throw new ApiError(400, "Commission rate must be 1%–20%");
      updateData.commissionRate = commissionRate;
    }
    if (commissionType) updateData.commissionType = commissionType;

    await tx.affiliate.update({ where: { id: affiliateId }, data: updateData });
    await tx.user.update({ where: { id: aff.userId }, data: { role: "AFFILIATE" } });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "AFFILIATE_APPROVED",
      entity:   "Affiliate",
      entityId: affiliateId,
      newValue: { commissionRate, commissionType, adminNote },
      req,
    });

    return { affiliateId, status: "APPROVED" };
  });
}

export async function adminRejectAffiliateService(
  adminUserId:  string,
  affiliateId:  string,
  adminNote?:   string,
  req?:         Request
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string; status: string;
    }>>`SELECT id, status FROM "Affiliate" WHERE id = ${affiliateId} FOR UPDATE`;

    const aff = rows[0];
    if (!aff) throw new ApiError(404, AffiliateErrorCode.AFFILIATE_NOT_FOUND);
    if (aff.status === "REJECTED") throw new ApiError(409, "Already rejected");

    await tx.affiliate.update({
      where: { id: affiliateId },
      data:  { status: "REJECTED", adminNote, approvedBy: adminUserId },
    });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "AFFILIATE_REJECTED",
      entity:   "Affiliate",
      entityId: affiliateId,
      newValue: { adminNote },
      req,
    });

    return { affiliateId, status: "REJECTED" };
  });
}

export async function adminListCommissionsService(query: AdminCommissionsQuery) {
  const where: any = { deletedAt: null };
  if (query.status)      where.status      = query.status;
  if (query.affiliateId) where.affiliateId = query.affiliateId;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to)   where.createdAt.lte = new Date(query.to);
  }

  const skip = (query.page - 1) * query.limit;

  const [commissions, total, summary] = await Promise.all([
    prisma.commission.findMany({
      where,
      skip,
      take:    query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        affiliateId:    true,
        orderId:        true,
        amount:         true,
        status:         true,
        paidAt:         true,
        approvedBy:     true,
        approvedAt:     true,
        reversedAt:     true,
        reversalReason: true,
        createdAt:      true,
        withdrawalId:   true,
        affiliate: {
          select: {
            referralCode: true,
            commissionRate: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        order: {
          select: { total: true, status: true, createdAt: true, paymentMethod: true },
        },
      },
    }),
    prisma.commission.count({ where }),
    // Aggregated totals for the filtered set
    prisma.commission.aggregate({
      where,
      _sum:   { amount: true },
      _count: { id: true },
    }),
  ]);

  return {
    commissions: commissions.map((c) => ({
      ...c,
      amount: c.amount.toNumber(),
      affiliate: {
        ...c.affiliate,
        commissionRate: c.affiliate.commissionRate.toNumber(),
      },
      order: {
        ...c.order,
        total: c.order.total.toNumber(),
      },
    })),
    pagination: {
      total,
      page:  query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
    summary: {
      totalAmount: summary._sum.amount?.toNumber() ?? 0,
      totalCount:  summary._count.id,
    },
  };
}

export async function adminApproveCommissionService(
  adminUserId:  string,
  commissionId: string,
  data:         AdminApproveCommissionBody,
  req?:         Request
) {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // Row-level lock
      const rows = await tx.$queryRaw<Array<{
        id: string; status: string; affiliateId: string; amount: unknown;
      }>>`
        SELECT id, status, "affiliateId", amount
        FROM "Commission"
        WHERE id = ${commissionId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;

      const commission = rows[0];
      if (!commission) throw new ApiError(404, AffiliateErrorCode.COMMISSION_NOT_FOUND);

      // Idempotency — already approved
      if (commission.status === "APPROVED") {
        return { commissionId, status: "APPROVED", alreadyProcessed: true };
      }

      // Only PENDING commissions can be approved
      if (commission.status !== "PENDING") {
        throw new ApiError(400, `Cannot approve a commission with status: ${commission.status}`);
      }

      await tx.commission.update({
        where: { id: commissionId },
        data: {
          status:     "APPROVED",
          approvedBy: adminUserId,
          approvedAt: new Date(),
        },
      });

      await createAuditLogInTx(tx, {
        userId:   adminUserId,
        action:   "COMMISSION_APPROVED",
        entity:   "Commission",
        entityId: commissionId,
        oldValue: { status: "PENDING" },
        newValue: { status: "APPROVED", approvedBy: adminUserId, note: data.note },
        req,
      });

      return { commissionId, status: "APPROVED", alreadyProcessed: false };
    });
  });
}

export async function adminPayCommissionService(
  adminUserId:  string,
  commissionId: string,
  data:         AdminPayCommissionBody,
  req?:         Request
) {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // Row-level lock
      const rows = await tx.$queryRaw<Array<{
        id: string; status: string; affiliateId: string; amount: unknown; withdrawalId: string | null;
      }>>`
        SELECT id, status, "affiliateId", amount, "withdrawalId"
        FROM "Commission"
        WHERE id = ${commissionId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;

      const commission = rows[0];
      if (!commission) throw new ApiError(404, AffiliateErrorCode.COMMISSION_NOT_FOUND);

      // Idempotency — already paid
      if (commission.status === "PAID") {
        return { commissionId, status: "PAID", alreadyProcessed: true };
      }

      // Must be APPROVED first
      if (commission.status !== "APPROVED") {
        throw new ApiError(
          400,
          commission.status === "PENDING"
            ? "Commission must be approved before payment"
            : `Cannot pay a commission with status: ${commission.status}`
        );
      }

      // If linked to a withdrawal, must be processed via withdrawal flow
      if (commission.withdrawalId) {
        throw new ApiError(
          409,
          "This commission is linked to a withdrawal request. Process via withdrawal flow."
        );
      }

      const amount = new Decimal(String(commission.amount));

      // Mark as PAID
      await tx.commission.update({
        where: { id: commissionId },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      // Update affiliate paidOutBalance, decrement pendingBalance
      await tx.affiliate.update({
        where: { id: commission.affiliateId },
        data: {
          pendingBalance:  { decrement: amount },
          paidOutBalance:  { increment: amount },
        },
      });

      await createAuditLogInTx(tx, {
        userId:   adminUserId,
        action:   "COMMISSION_PAID",
        entity:   "Commission",
        entityId: commissionId,
        oldValue: { status: "APPROVED" },
        newValue: {
          status:         "PAID",
          transactionRef: data.transactionRef,
          note:           data.note,
          amount:         amount.toNumber(),
        },
        req,
      });

      return { commissionId, status: "PAID", amount: amount.toNumber(), alreadyProcessed: false };
    });
  });
}

export async function adminGetAffiliateDetailService(affiliateId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: {
      user: {
        select: {
          id:          true,
          name:        true,
          email:       true,
          phone:       true,
          role:        true,
          createdAt:   true,
          referredById: true,
        },
      },
      commissions: {
        where:   { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take:    20,
        select: {
          id:         true,
          orderId:    true,
          amount:     true,
          status:     true,
          paidAt:     true,
          approvedAt: true,
          createdAt:  true,
          order: { select: { total: true, status: true, paymentMethod: true } },
        },
      },
      withdrawals: {
        orderBy: { createdAt: "desc" },
        take:    10,
        select: {
          id:            true,
          amount:        true,
          status:        true,
          processedAt:   true,
          transactionRef: true,
          createdAt:     true,
        },
      },
    },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.AFFILIATE_NOT_FOUND);

  // Aggregated commission stats
  const [commissionStats, clickStats] = await Promise.all([
    prisma.commission.groupBy({
      by:    ["status"],
      where: { affiliateId, deletedAt: null },
      _sum:  { amount: true },
      _count: { id: true },
    }),
    prisma.affiliateClick.aggregate({
      where: { affiliateId },
      _count: { id: true },
    }),
  ]);

  const byStatus = commissionStats.reduce(
    (acc, r) => ({
      ...acc,
      [r.status]: {
        count:  r._count.id,
        amount: r._sum.amount?.toNumber() ?? 0,
      },
    }),
    {} as Record<string, { count: number; amount: number }>
  );

  return {
    affiliate: {
      id:              affiliate.id,
      status:          affiliate.status,
      referralCode:    affiliate.referralCode,
      commissionRate:  affiliate.commissionRate.toNumber(),
      commissionType:  affiliate.commissionType,
      totalClicks:     affiliate.totalClicks,
      totalConversions: affiliate.totalConversions,
      totalCommission: affiliate.totalCommission.toNumber(),
      pendingBalance:  affiliate.pendingBalance.toNumber(),
      paidOutBalance:  affiliate.paidOutBalance.toNumber(),
      approvedAt:      affiliate.approvedAt,
      approvedBy:      affiliate.approvedBy,
      adminNote:       affiliate.adminNote,
      createdAt:       affiliate.createdAt,
      payoutDetails:   affiliate.payoutDetails,
    },
    user: affiliate.user,
    recentCommissions: affiliate.commissions.map((c) => ({
      ...c,
      amount: c.amount.toNumber(),
      order:  { ...c.order, total: c.order.total.toNumber() },
    })),
    recentWithdrawals: affiliate.withdrawals.map((w) => ({
      ...w,
      amount: w.amount.toNumber(),
    })),
    commissionBreakdown: byStatus,
    totalClicks: clickStats._count.id,
  };
}

/**
 * PATCH /admin/affiliates/:id/update
 * Update commission rate / type for an already-APPROVED affiliate.
 * Works regardless of current status (unlike approve which requires PENDING).
 */
export async function adminUpdateAffiliateService(
  adminUserId: string,
  affiliateId: string,
  data: { commissionRate?: number; commissionType?: string; adminNote?: string },
  req?: Request
) {
  const aff = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!aff) throw new ApiError(404, "Affiliate not found");

  const updateData: any = {};
  if (data.commissionRate !== undefined) {
    if (data.commissionRate < 0.01 || data.commissionRate > 0.20)
      throw new ApiError(400, "Commission rate must be between 1% and 20%");
    updateData.commissionRate = data.commissionRate;
  }
  if (data.commissionType) updateData.commissionType = data.commissionType;
  if (data.adminNote !== undefined) updateData.adminNote = data.adminNote;

  const updated = await prisma.affiliate.update({
    where: { id: affiliateId },
    data: updateData,
  });

  await createAuditLog({
    userId:   adminUserId,
    action:   "AFFILIATE_UPDATED",
    entity:   "Affiliate",
    entityId: affiliateId,
    newValue: updateData,
    req,
  });

  return { affiliateId, ...updateData };
}