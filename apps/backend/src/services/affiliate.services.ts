import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { AffiliateErrorCode } from "../utils/affiliateErrors";
import { createAuditLog, createAuditLogInTx } from "../utils/auditLog";
import { Decimal } from "decimal.js";
import crypto from "crypto";
import type {
  AffiliateApplyBody,
  AffiliatePayoutDetailsBody,
  AffiliateWithdrawBody,
  AffiliateClicksQuery,
  AffiliateConversionsQuery,
  AffiliateCommissionsQuery,
  AffiliateOrdersQuery,
  AdminAffiliateApproveBody,
  AdminProcessWithdrawalBody,
} from "@repo/zod-schema/index";
import type { Request } from "express";

const MIN_WITHDRAWAL_AMOUNT = 100; // ₹100
const MAX_COMMISSION_RATE   = 0.20;
const MIN_COMMISSION_RATE   = 0.01;
const REFERRAL_COOKIE_NAME  = "ref";
const REFERRAL_COOKIE_DAYS  = 30; // 30-day attribution window

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fn();
    } catch (err: any) {
      const isSerialErr =
        err?.code === "P2034" ||
        err?.message?.includes("serialization failure") ||
        err?.message?.includes("could not serialize");

      if (isSerialErr && attempts < 2) {
        attempts++;
        await new Promise((r) =>
          setTimeout(r, Math.pow(2, attempts) * 100 + Math.random() * 100)
        );
        continue;
      }
      throw err;
    }
  }
  throw new ApiError(500, AffiliateErrorCode.CONCURRENCY_CONFLICT);
}

function generateReferralCode(name: string): string {
  const namePrefix = name.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 4);
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${namePrefix}${randomPart}`;
}

export async function applyForAffiliateService(
  userId: string,
  data:   AffiliateApplyBody,
  req?:   Request
) {
  const existing = await prisma.affiliate.findUnique({
    where:  { userId },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "PENDING")  throw new ApiError(409, AffiliateErrorCode.APPLICATION_PENDING);
    if (existing.status === "APPROVED") throw new ApiError(409, AffiliateErrorCode.ALREADY_AFFILIATE);
    if (existing.status === "REJECTED") {
      // Allow re-application after rejection (admin can re-approve)
      throw new ApiError(409, AffiliateErrorCode.APPLICATION_REJECTED);
    }
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { name: true, referralCode: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");

  let referralCode: string;
  let attempts = 0;
  do {
    referralCode = generateReferralCode(user.name);
    const codeExists = await prisma.affiliate.findUnique({
      where:  { referralCode },
      select: { id: true },
    });
    if (!codeExists) break;
    attempts++;
  } while (attempts < 5);

  return prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.create({
      data: {
        userId,
        referralCode: referralCode!,
        status:       "PENDING",
        commissionRate: 0.05, // Default 5%; admin can change on approval
        commissionType: "LIFETIME",
      },
    });

    await createAuditLogInTx(tx, {
      userId,
      action:   "AFFILIATE_APPLIED",
      entity:   "Affiliate",
      entityId: affiliate.id,
      newValue: { referralCode, message: data.message },
      req,
    });

    return {
      affiliateId:  affiliate.id,
      referralCode: affiliate.referralCode,
      status:       affiliate.status,
      message:      "Application submitted. You will be notified once reviewed.",
    };
  });
}

export async function getAffiliateProfileService(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    select: {
      id:              true,
      status:          true,
      referralCode:    true,
      commissionRate:  true,
      commissionType:  true,
      totalClicks:     true,
      totalConversions: true,
      totalCommission: true,
      pendingBalance:  true,
      paidOutBalance:  true,
      approvedAt:      true,
      adminNote:       true,
      createdAt:       true,
    },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.NOT_AN_AFFILIATE);

  const baseUrl = process.env.FRONTEND_URL ?? "https://yourdomain.com";

  return {
    ...affiliate,
    commissionRate:  affiliate.commissionRate.toNumber(),
    totalCommission: affiliate.totalCommission.toNumber(),
    pendingBalance:  affiliate.pendingBalance.toNumber(),
    paidOutBalance:  affiliate.paidOutBalance.toNumber(),
    referralLink:    `${baseUrl}/ref/${affiliate.referralCode}`,
  };
}

export async function getReferralLinkService(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where:  { userId },
    select: { referralCode: true, status: true },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.NOT_AN_AFFILIATE);
  if (affiliate.status !== "APPROVED") {
    throw new ApiError(403, AffiliateErrorCode.AFFILIATE_NOT_APPROVED);
  }

  const baseUrl = process.env.FRONTEND_URL ?? "https://yourdomain.com";
  return {
    referralCode: affiliate.referralCode,
    referralLink: `${baseUrl}/ref/${affiliate.referralCode}`,
    shareLinks: {
      whatsapp: `https://wa.me/?text=Use%20my%20referral%20link%20to%20shop%3A%20${encodeURIComponent(`${baseUrl}/ref/${affiliate.referralCode}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(`${baseUrl}/ref/${affiliate.referralCode}`)}&text=Shop%20using%20my%20link!`,
      twitter:  `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${baseUrl}/ref/${affiliate.referralCode}`)}&text=Check%20this%20out!`,
      copy:     `${baseUrl}/ref/${affiliate.referralCode}`,
    },
  };
}

export async function trackReferralClickService(
  referralCode: string,
  req:          Request
): Promise<{
  redirectUrl:   string;
  cookieOptions: { name: string; value: string; maxAge: number; httpOnly: boolean; sameSite: "lax" };
}> {
  const affiliate = await prisma.affiliate.findUnique({
    where:  { referralCode: referralCode.toUpperCase() },
    select: { id: true, status: true, totalClicks: true },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.INVALID_REFERRAL_CODE);

  if (affiliate.status === "APPROVED") {
    const ip        = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const today     = new Date().toISOString().split("T")[0];
    const ipDateKey = `${affiliate.id}:${ip}:${today}`;
    const userAgent = req.get("User-Agent") ?? "";

    const isBotLike = isLikelyBot(userAgent);

    const existingClick = await prisma.affiliateClick.findFirst({
      where:  { ipDateKey },
      select: { id: true },
    });
    const isUnique = !existingClick && !isBotLike;

    await prisma.$transaction(async (tx) => {
      await tx.affiliateClick.create({
        data: {
          affiliateId: affiliate.id,
          ip:          ip.substring(0, 45), // Truncate IPv6
          userAgent:   userAgent.substring(0, 500),
          referrer:    req.get("Referer")?.substring(0, 500),
          ipDateKey:   isUnique ? ipDateKey : undefined,
          isUnique,
          sessionId:   req.cookies?.sessionId,
        },
      });

      if (isUnique) {
        await tx.affiliate.update({
          where: { id: affiliate.id },
          data:  { totalClicks: { increment: 1 } },
        });
      }
    });
  }

  const baseUrl    = process.env.FRONTEND_URL ?? "https://yourdomain.com";
  const redirectTo = req.query.redirect?.toString() ?? baseUrl;

  return {
    redirectUrl: redirectTo,
    cookieOptions: {
      name:     REFERRAL_COOKIE_NAME,
      value:    affiliate.id,      // Store affiliateId in cookie (not code)
      maxAge:   REFERRAL_COOKIE_DAYS * 24 * 60 * 60, // seconds
      httpOnly: false, // Readable by JS so frontend can show "referred by" UI
      sameSite: "lax" as const,
    },
  };
}

/**
 * POST /affiliate/track-click  (no auth required)
 * Called by the frontend /ref/[code] page.
 * Records the click and returns the affiliateId so the frontend can persist it.
 */
export async function trackClickPublicService(
  referralCode: string,
  req:          Request
): Promise<{ affiliateId: string }> {
  const affiliate = await prisma.affiliate.findUnique({
    where:  { referralCode: referralCode.toUpperCase() },
    select: { id: true, status: true },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.INVALID_REFERRAL_CODE);

  if (affiliate.status === "APPROVED") {
    const ip        = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const today     = new Date().toISOString().split("T")[0];
    const ipDateKey = `${affiliate.id}:${ip}:${today}`;
    // Prefer the real browser UA sent by the frontend (X-Browser-UA), fall back to request UA
    const userAgent = req.get("X-Browser-UA") || req.get("User-Agent") || "";
    const isBotLike = isLikelyBot(userAgent);

    const existingClick = await prisma.affiliateClick.findFirst({
      where:  { ipDateKey },
      select: { id: true },
    });
    const isUnique = !existingClick && !isBotLike;

    await prisma.$transaction(async (tx) => {
      await tx.affiliateClick.create({
        data: {
          affiliateId: affiliate.id,
          ip:          ip.substring(0, 45),
          userAgent:   userAgent.substring(0, 500),
          referrer:    req.get("Referer")?.substring(0, 500),
          ipDateKey:   isUnique ? ipDateKey : undefined,
          isUnique,
          sessionId:   req.cookies?.sessionId,
        },
      });

      if (isUnique) {
        await tx.affiliate.update({
          where: { id: affiliate.id },
          data:  { totalClicks: { increment: 1 } },
        });
      }
    });
  }

  return { affiliateId: affiliate.id };
}

export async function getAffiliateStatsService(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where:  { userId },
    select: { id: true, status: true },
  });
  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.NOT_AN_AFFILIATE);

  const now       = new Date();
  const startOf30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOf7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const [
    totalStats,
    last30Days,
    last7Days,
    commissionBreakdown,
    pendingWithdrawal,
  ] = await Promise.all([
    // Overall totals
    prisma.affiliate.findUnique({
      where:  { id: affiliate.id },
      select: {
        totalClicks:      true,
        totalConversions: true,
        totalCommission:  true,
        pendingBalance:   true,
        paidOutBalance:   true,
        commissionRate:   true,
        commissionType:   true,
      },
    }),
    // Clicks last 30 days
    prisma.affiliateClick.count({
      where: { affiliateId: affiliate.id, isUnique: true, createdAt: { gte: startOf30 } },
    }),
    // Clicks last 7 days
    prisma.affiliateClick.count({
      where: { affiliateId: affiliate.id, isUnique: true, createdAt: { gte: startOf7 } },
    }),
    // Commission by status
    prisma.commission.groupBy({
      by:     ["status"],
      where:  { affiliateId: affiliate.id, deletedAt: null },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    // Pending withdrawal
    prisma.affiliateWithdrawal.findFirst({
      where:   { affiliateId: affiliate.id, status: { in: ["PENDING", "PROCESSING"] } },
      select:  { id: true, amount: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const commissionByStatus = commissionBreakdown.reduce(
    (acc, row) => ({
      ...acc,
      [row.status]: {
        count:  row._count.id,
        amount: row._sum.amount?.toNumber() ?? 0,
      },
    }),
    {} as Record<string, { count: number; amount: number }>
  );

  return {
    overview: {
      totalClicks:      totalStats?.totalClicks       ?? 0,
      totalConversions: totalStats?.totalConversions  ?? 0,
      totalCommission:  totalStats?.totalCommission?.toNumber()  ?? 0,
      pendingBalance:   totalStats?.pendingBalance?.toNumber()   ?? 0,
      paidOutBalance:   totalStats?.paidOutBalance?.toNumber()   ?? 0,
      commissionRate:   totalStats?.commissionRate?.toNumber()   ?? 0,
      commissionType:   totalStats?.commissionType   ?? "LIFETIME",
      conversionRate:
        (totalStats?.totalClicks ?? 0) > 0
          ? (((totalStats?.totalConversions ?? 0) / (totalStats?.totalClicks ?? 1)) * 100).toFixed(2) + "%"
          : "0.00%",
    },
    recent: {
      clicksLast30Days: last30Days,
      clicksLast7Days:  last7Days,
    },
    commissions: commissionByStatus,
    pendingWithdrawal: pendingWithdrawal
      ? {
          id:        pendingWithdrawal.id,
          amount:    pendingWithdrawal.amount.toNumber(),
          status:    pendingWithdrawal.status,
          createdAt: pendingWithdrawal.createdAt,
        }
      : null,
  };
}

export async function getAffiliateClicksService(
  userId: string,
  query:  AffiliateClicksQuery
) {
  const affiliate = await getApprovedAffiliate(userId);

  const where: any = { affiliateId: affiliate.id };
  if (query.unique !== undefined) where.isUnique = query.unique;
  if (query.from) where.createdAt = { ...where.createdAt, gte: new Date(query.from) };
  if (query.to)   where.createdAt = { ...where.createdAt, lte: new Date(query.to) };

  const skip = (query.page - 1) * query.limit;

  const [clicks, total, uniqueTotal] = await Promise.all([
    prisma.affiliateClick.findMany({
      where,
      skip,
      take:    query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        isUnique:  true,
        referrer:  true,
        country:   true,
        createdAt: true,
        convertedAt: true,
        // Don't expose IP for privacy
      },
    }),
    prisma.affiliateClick.count({ where }),
    prisma.affiliateClick.count({ where: { affiliateId: affiliate.id, isUnique: true } }),
  ]);

  return {
    clicks,
    pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    uniqueTotal,
  };
}

export async function getAffiliateConversionsService(
  userId: string,
  query:  AffiliateConversionsQuery
) {
  const affiliate = await getApprovedAffiliate(userId);

  const where: any = { affiliateId: affiliate.id };
  if (query.status) where.status    = query.status;
  if (query.from)   where.createdAt = { ...where.createdAt, gte: new Date(query.from) };
  if (query.to)     where.createdAt = { ...where.createdAt, lte: new Date(query.to) };

  const skip = (query.page - 1) * query.limit;

  const [conversions, total] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where,
      skip,
      take:    query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:         true,
        orderId:    true,
        commission: true,
        status:     true,
        createdAt:  true,
        updatedAt:  true,
        order: {
          select: {
            total:     true,
            status:    true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.affiliateConversion.count({ where }),
  ]);

  return {
    conversions: conversions.map((c) => ({
      ...c,
      commission:        c.commission.toNumber(),
      order: {
        ...c.order,
        total: c.order.total.toNumber(),
      },
    })),
    pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
  };
}

export async function getAffiliateCommissionsService(
  userId: string,
  query:  AffiliateCommissionsQuery
) {
  const affiliate = await getApprovedAffiliate(userId);

  const where: any = { affiliateId: affiliate.id, deletedAt: null };
  if (query.status) where.status    = query.status;
  if (query.from)   where.createdAt = { ...where.createdAt, gte: new Date(query.from) };
  if (query.to)     where.createdAt = { ...where.createdAt, lte: new Date(query.to) };

  const skip = (query.page - 1) * query.limit;

  const [commissions, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      skip,
      take:    query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        orderId:        true,
        amount:         true,
        status:         true,
        paidAt:         true,
        reversedAt:     true,
        reversalReason: true,
        createdAt:      true,
        withdrawal: {
          select: { id: true, status: true, createdAt: true },
        },
        order: {
          select: { total: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.commission.count({ where }),
  ]);

  return {
    commissions: commissions.map((c) => ({
      ...c,
      amount:  c.amount.toNumber(),
      order:   { ...c.order, total: c.order.total.toNumber() },
    })),
    pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
  };
}

export async function getAffiliateOrdersService(
  userId: string,
  query:  AffiliateOrdersQuery
) {
  const affiliate = await getApprovedAffiliate(userId);

  const where: any = { affiliateId: affiliate.id, deletedAt: null };
  if (query.status) where.status    = query.status;
  if (query.from)   where.createdAt = { ...where.createdAt, gte: new Date(query.from) };
  if (query.to)     where.createdAt = { ...where.createdAt, lte: new Date(query.to) };

  const skip = (query.page - 1) * query.limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take:    query.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:            true,
        total:         true,
        status:        true,
        paymentMethod: true,
        createdAt:     true,
        commissions: {
          where:  { affiliateId: affiliate.id, deletedAt: null },
          select: { amount: true, status: true },
        },
        payment: { select: { status: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      total:       o.total.toNumber(),
      commissions: o.commissions.map((c) => ({
        ...c,
        amount: c.amount.toNumber(),
      })),
    })),
    pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
  };
}

export async function updatePayoutDetailsService(
  userId: string,
  data:   AffiliatePayoutDetailsBody,
  req?:   Request
) {
  const affiliate = await getApprovedAffiliate(userId);

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data:  { payoutDetails: data as any },
  });

  return { message: "Payout details updated successfully" };
}

export async function requestWithdrawalService(
  userId: string,
  data:   AffiliateWithdrawBody,
  req?:   Request
) {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const affiliates = await tx.$queryRaw<Array<{
        id: string; pendingBalance: unknown; payoutDetails: unknown; status: string;
      }>>`
        SELECT id, "pendingBalance", "payoutDetails", status
        FROM "Affiliate"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `;

      const affiliate = affiliates[0];
      if (!affiliate) throw new ApiError(404, AffiliateErrorCode.NOT_AN_AFFILIATE);
      if (affiliate.status !== "APPROVED") throw new ApiError(403, AffiliateErrorCode.AFFILIATE_NOT_APPROVED);
      if (!affiliate.payoutDetails) throw new ApiError(400, AffiliateErrorCode.PAYOUT_DETAILS_MISSING);

      const pendingBalance = new Decimal(String(affiliate.pendingBalance));

      if (data.amount < MIN_WITHDRAWAL_AMOUNT) {
        throw new ApiError(400, AffiliateErrorCode.MINIMUM_WITHDRAWAL_NOT_MET);
      }

      if (pendingBalance.lt(data.amount)) {
        throw new ApiError(400, AffiliateErrorCode.INSUFFICIENT_BALANCE);
      }

      const pendingWithdrawal = await tx.affiliateWithdrawal.findFirst({
        where:  { affiliateId: affiliate.id, status: { in: ["PENDING", "PROCESSING"] } },
        select: { id: true },
      });
      if (pendingWithdrawal) {
        throw new ApiError(409, "A withdrawal request is already pending. Please wait for it to be processed.");
      }

      // Fetch approved commissions to include in this payout
      const commissions = await tx.commission.findMany({
        where: {
          affiliateId: affiliate.id,
          status:      "APPROVED",
          deletedAt:   null,
          withdrawalId: null, // Not already in a withdrawal
        },
        orderBy: { createdAt: "asc" },
      });

      if (commissions.length === 0) {
        throw new ApiError(400, "No approved commissions available for withdrawal");
      }

      // Select commissions up to requested amount
      let accumulated = new Decimal(0);
      const selectedCommissions: string[] = [];
      for (const c of commissions) {
        if (accumulated.gte(data.amount)) break;
        accumulated = accumulated.add(c.amount);
        selectedCommissions.push(c.id);
      }

      const withdrawalAmount = accumulated.lte(data.amount) ? accumulated : new Decimal(data.amount);

      // Create withdrawal
      const withdrawal = await tx.affiliateWithdrawal.create({
        data: {
          affiliateId:  affiliate.id,
          amount:       withdrawalAmount,
          status:       "PENDING",
          payoutDetails: affiliate.payoutDetails as any,
        },
      });

      // Link commissions to withdrawal + mark as PAID (pending admin confirmation)
      await tx.commission.updateMany({
        where: { id: { in: selectedCommissions } },
        data:  { withdrawalId: withdrawal.id },
      });

      // Deduct from pendingBalance
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data:  { pendingBalance: { decrement: withdrawalAmount } },
      });

      await createAuditLogInTx(tx, {
        userId,
        action:   "AFFILIATE_WITHDRAWAL_REQUESTED",
        entity:   "AffiliateWithdrawal",
        entityId: withdrawal.id,
        newValue: { amount: withdrawalAmount.toNumber(), commissions: selectedCommissions.length },
        req,
      });

      return {
        withdrawalId: withdrawal.id,
        amount:       withdrawalAmount.toNumber(),
        status:       "PENDING",
        message:      "Withdrawal request submitted. Admin will process within 2-3 business days.",
      };
    });
  });
}

// ADMIN SERVICES

export async function adminApproveAffiliateService(
  adminUserId:  string,
  affiliateId:  string,
  data:         AdminAffiliateApproveBody,
  req?:         Request
) {
  return prisma.$transaction(async (tx) => {
    const affiliates = await tx.$queryRaw<Array<{
      id: string; userId: string; status: string;
    }>>`
      SELECT id, "userId", status FROM "Affiliate"
      WHERE id = ${affiliateId}
      FOR UPDATE
    `;

    const affiliate = affiliates[0];
    if (!affiliate) throw new ApiError(404, AffiliateErrorCode.AFFILIATE_NOT_FOUND);
    if (affiliate.status !== "PENDING") {
      throw new ApiError(409, "Affiliate application already resolved");
    }

    const updateData: any = {
      status:    data.status,
      adminNote: data.adminNote,
      approvedBy: adminUserId,
      approvedAt: data.status === "APPROVED" ? new Date() : null,
    };

    if (data.status === "APPROVED") {
      if (data.commissionRate !== undefined) {
        if (data.commissionRate < MIN_COMMISSION_RATE || data.commissionRate > MAX_COMMISSION_RATE) {
          throw new ApiError(400, `Commission rate must be between ${MIN_COMMISSION_RATE * 100}% and ${MAX_COMMISSION_RATE * 100}%`);
        }
        updateData.commissionRate = data.commissionRate;
      }
      if (data.commissionType) {
        updateData.commissionType = data.commissionType;
      }
    }

    await tx.affiliate.update({
      where: { id: affiliateId },
      data:  updateData,
    });

    if (data.status === "APPROVED") {
      await tx.user.update({
        where: { id: affiliate.userId },
        data:  { role: "AFFILIATE" },
      });
    }

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   data.status === "APPROVED" ? "AFFILIATE_APPROVED" : "AFFILIATE_REJECTED",
      entity:   "Affiliate",
      entityId: affiliateId,
      newValue: { status: data.status, commissionRate: data.commissionRate, adminNote: data.adminNote },
      req,
    });

    return {
      affiliateId,
      status:    data.status,
      message:   `Affiliate ${data.status.toLowerCase()} successfully`,
    };
  });
}

export async function adminListAffiliatesService(
  status?: string,
  page:     number = 1,
  limit:    number = 20
) {
  const where: any = {};
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [affiliates, total] = await Promise.all([
    prisma.affiliate.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        status:         true,
        referralCode:   true,
        commissionRate: true,
        commissionType: true,
        totalClicks:    true,
        totalConversions: true,
        totalCommission: true,
        pendingBalance:  true,
        adminNote:       true,
        approvedAt:      true,
        createdAt:       true,
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    }),
    prisma.affiliate.count({ where }),
  ]);

  return {
    affiliates: affiliates.map((a) => ({
      ...a,
      commissionRate:  a.commissionRate.toNumber(),
      totalCommission: a.totalCommission.toNumber(),
      pendingBalance:  a.pendingBalance.toNumber(),
    })),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function adminProcessWithdrawalService(
  adminUserId:  string,
  withdrawalId: string,
  data:         AdminProcessWithdrawalBody,
  req?:         Request
) {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const withdrawals = await tx.$queryRaw<Array<{
        id: string; affiliateId: string; amount: unknown; status: string;
      }>>`
        SELECT id, "affiliateId", amount, status
        FROM "AffiliateWithdrawal"
        WHERE id = ${withdrawalId}
        FOR UPDATE
      `;

      const withdrawal = withdrawals[0];
      if (!withdrawal) throw new ApiError(404, AffiliateErrorCode.WITHDRAWAL_NOT_FOUND);
      if (!["PENDING", "PROCESSING"].includes(withdrawal.status)) {
        throw new ApiError(409, AffiliateErrorCode.WITHDRAWAL_ALREADY_PROCESSED);
      }

      const amount = new Decimal(String(withdrawal.amount));

      await tx.affiliateWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status:         data.status,
          processedBy:    adminUserId,
          processedAt:    new Date(),
          transactionRef: data.transactionRef,
          adminNote:      data.adminNote,
        },
      });

      if (data.status === "PAID") {
        await tx.commission.updateMany({
          where: { withdrawalId },
          data:  { status: "PAID", paidAt: new Date() },
        });

        await tx.affiliate.update({
          where: { id: withdrawal.affiliateId },
          data:  { paidOutBalance: { increment: amount } },
        });

        await createAuditLogInTx(tx, {
          userId:   adminUserId,
          action:   "AFFILIATE_WITHDRAWAL_PAID",
          entity:   "AffiliateWithdrawal",
          entityId: withdrawalId,
          newValue: { amount: amount.toNumber(), transactionRef: data.transactionRef },
          req,
        });
      } else {
        await tx.commission.updateMany({
          where: { withdrawalId },
          data:  { withdrawalId: null },
        });

        await tx.affiliate.update({
          where: { id: withdrawal.affiliateId },
          data:  { pendingBalance: { increment: amount } },
        });

        await createAuditLogInTx(tx, {
          userId:   adminUserId,
          action:   "AFFILIATE_WITHDRAWAL_REJECTED",
          entity:   "AffiliateWithdrawal",
          entityId: withdrawalId,
          newValue: { adminNote: data.adminNote },
          req,
        });
      }

      return {
        withdrawalId,
        status:    data.status,
        amount:    amount.toNumber(),
      };
    });
  });
}

export async function adminListWithdrawalsService(
  status?: string,
  page:     number = 1,
  limit:    number = 20
) {
  const where: any = {};
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [withdrawals, total] = await Promise.all([
    prisma.affiliateWithdrawal.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      include: {
        affiliate: {
          select: {
            id:   true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.affiliateWithdrawal.count({ where }),
  ]);

  return {
    withdrawals: withdrawals.map((w) => ({
      ...w,
      amount: w.amount.toNumber(),
    })),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

async function getApprovedAffiliate(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where:  { userId },
    select: { id: true, status: true },
  });

  if (!affiliate) throw new ApiError(404, AffiliateErrorCode.NOT_AN_AFFILIATE);
  if (affiliate.status !== "APPROVED") {
    throw new ApiError(403, AffiliateErrorCode.AFFILIATE_NOT_APPROVED);
  }
  return affiliate;
}

function isLikelyBot(userAgent: string): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  const botPatterns = [
    "bot", "crawler", "spider", "scraper", "wget", "curl",
    "python-requests", "java", "libwww", "httpclient",
    "go-http-client", "okhttp", "ruby",
  ];
  return botPatterns.some((p) => ua.includes(p));
}

export async function processAffiliateCommissionService(params: {
  tx:          Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  orderId:     string;
  affiliateId: string;
  orderTotal:  number;
  userId:      string;
}): Promise<void> {
  const { tx, orderId, affiliateId, orderTotal, userId } = params;

  const affiliate = await tx.affiliate.findUnique({
    where:  { id: affiliateId },
    select: { status: true, commissionRate: true, commissionType: true, userId: true },
  });

  if (!affiliate || affiliate.status !== "APPROVED") return;

  if (affiliate.userId === userId) return;

  if (affiliate.commissionType === "PER_ORDER") {
    const previousCommission = await tx.commission.findFirst({
      where: {
        affiliateId,
        order: { userId }, // Any prior order by the same user
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true },
    });
    if (previousCommission) return; // Already earned commission from this user
  }

  const existingCommission = await tx.commission.findUnique({
    where: { affiliateId_orderId: { affiliateId, orderId } },
    select: { id: true },
  });
  if (existingCommission) return;

  const commissionAmount = new Decimal(orderTotal).mul(affiliate.commissionRate);

  await tx.commission.create({
    data: {
      affiliateId,
      orderId,
      amount: commissionAmount,
      status: "PENDING",
    },
  });

  await tx.affiliateConversion.upsert({
    where:  { affiliateId_orderId: { affiliateId, orderId } },
    update: { commission: commissionAmount, status: "PENDING" },
    create: { affiliateId, orderId, commission: commissionAmount, status: "PENDING" },
  });

  await tx.affiliate.update({
    where: { id: affiliateId },
    data: {
      totalConversions: { increment: 1 },
      totalCommission:  { increment: commissionAmount },
      pendingBalance:   { increment: commissionAmount },
    },
  });

  await createAuditLogInTx(tx, {
    userId,
    action:   "COMMISSION_CREATED",
    entity:   "Commission",
    entityId: orderId,
    newValue: { affiliateId, amount: commissionAmount.toNumber() },
  });
}

export async function reverseAffiliateCommissionsService(params: {
  tx:          Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  orderId:     string;
  adminUserId: string;
}): Promise<void> {
  const { tx, orderId, adminUserId } = params;

  const commissions = await tx.commission.findMany({
    where: { orderId, status: { in: ["PENDING", "APPROVED"] }, deletedAt: null },
    select: { id: true, affiliateId: true, amount: true, status: true },
  });

  for (const commission of commissions) {
    await tx.commission.update({
      where: { id: commission.id },
      data: {
        status:         "CANCELLED",
        reversedAt:     new Date(),
        reversalReason: "Refund issued",
        withdrawalId:   null, // Remove from any pending withdrawal
      },
    });

    await tx.affiliate.update({
      where: { id: commission.affiliateId },
      data: {
        totalCommission: { decrement: commission.amount },
        pendingBalance:  { decrement: commission.amount },
        totalConversions: { decrement: 1 },
      },
    });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "COMMISSION_REVERSED",
      entity:   "Commission",
      entityId: commission.id,
      oldValue: { status: commission.status, amount: commission.amount.toNumber() },
      newValue: { status: "CANCELLED", reversalReason: "Refund issued" },
    });
  }

  await tx.affiliateConversion.updateMany({
    where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
    data:  { status: "CANCELLED" },
  });
}
