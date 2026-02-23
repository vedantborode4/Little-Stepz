import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { createAuditLogInTx } from "../../utils/auditLog";
import type {
  CreateBannerBody,
  UpdateBannerBody,
  PublicBannersQuery,
} from "@repo/zod-schema/index";
import type { Request } from "express";

export async function adminCreateBannerService(
  adminUserId: string,
  data: CreateBannerBody,
  req?: Request
) {
  return prisma.$transaction(async (tx) => {
    const banner = await tx.banner.create({
      data: {
        title:      data.title,
        subtitle:   data.subtitle,
        imageUrl:   data.imageUrl,
        linkUrl:    data.linkUrl,
        altText:    data.altText,
        position:   data.position as any,
        sortOrder:  data.sortOrder ?? 0,
        isActive:   data.isActive ?? true,
        startsAt:   data.startsAt ? new Date(data.startsAt) : null,
        endsAt:     data.endsAt   ? new Date(data.endsAt)   : null,
        targetRole: data.targetRole as any ?? null,
        createdBy:  adminUserId,
      },
    });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "ORDER_STATUS_UPDATED", // reuse closest; extend AuditAction if needed
      entity:   "Order",
      entityId: banner.id,
      newValue: { title: data.title, position: data.position, isActive: data.isActive },
      req,
    });

    return banner;
  });
}

export async function adminListBannersService(
  page:     number = 1,
  limit:    number = 50,
  position?: string,
  isActive?: boolean
) {
  const where: any = { deletedAt: null };
  if (position !== undefined) where.position = position;
  if (isActive !== undefined) where.isActive  = isActive;

  const skip = (page - 1) * limit;

  const [banners, total] = await Promise.all([
    prisma.banner.findMany({
      where,
      skip,
      take:    limit,
      orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.banner.count({ where }),
  ]);

  return {
    banners,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function adminGetBannerService(bannerId: string) {
  const banner = await prisma.banner.findFirst({
    where: { id: bannerId, deletedAt: null },
  });
  if (!banner) throw new ApiError(404, "Banner not found");
  return banner;
}

export async function adminUpdateBannerService(
  adminUserId: string,
  bannerId:    string,
  data:        UpdateBannerBody,
  req?:        Request
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.banner.findFirst({
      where: { id: bannerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Banner not found");

    // Validate scheduling
    const startsAt = data.startsAt ? new Date(data.startsAt) : existing.startsAt;
    const endsAt   = data.endsAt   ? new Date(data.endsAt)   : existing.endsAt;
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new ApiError(400, "startsAt must be before endsAt");
    }

    const updated = await tx.banner.update({
      where: { id: bannerId },
      data: {
        ...(data.title      !== undefined && { title:      data.title }),
        ...(data.subtitle   !== undefined && { subtitle:   data.subtitle }),
        ...(data.imageUrl   !== undefined && { imageUrl:   data.imageUrl }),
        ...(data.linkUrl    !== undefined && { linkUrl:    data.linkUrl }),
        ...(data.altText    !== undefined && { altText:    data.altText }),
        ...(data.position   !== undefined && { position:   data.position as any }),
        ...(data.sortOrder  !== undefined && { sortOrder:  data.sortOrder }),
        ...(data.isActive   !== undefined && { isActive:   data.isActive }),
        ...(data.startsAt   !== undefined && { startsAt:   new Date(data.startsAt) }),
        ...(data.endsAt     !== undefined && { endsAt:     new Date(data.endsAt) }),
        ...(data.targetRole !== undefined && { targetRole: data.targetRole as any }),
        updatedBy: adminUserId,
      },
    });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "ORDER_STATUS_UPDATED",
      entity:   "Order",
      entityId: bannerId,
      oldValue: { isActive: existing.isActive, position: existing.position },
      newValue: { isActive: data.isActive, position: data.position },
      req,
    });

    return updated;
  });
}

export async function adminDeleteBannerService(
  adminUserId: string,
  bannerId:    string,
  req?:        Request
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.banner.findFirst({
      where: { id: bannerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Banner not found");

    await tx.banner.update({
      where: { id: bannerId },
      data:  { deletedAt: new Date(), isActive: false, updatedBy: adminUserId },
    });

    return { deleted: true, bannerId };
  });
}

export async function adminToggleBannerService(
  adminUserId: string,
  bannerId:    string,
  req?:        Request
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.banner.findFirst({
      where: { id: bannerId, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "Banner not found");

    const updated = await tx.banner.update({
      where: { id: bannerId },
      data:  { isActive: !existing.isActive, updatedBy: adminUserId },
    });

    return { bannerId, isActive: updated.isActive };
  });
}

export async function getActiveBannersService(
  query: PublicBannersQuery,
  userRole?: string
) {
  const now = new Date();

  const where: any = {
    deletedAt: null,
    isActive:  true,
    OR: [
      { startsAt: null, endsAt: null },
      { startsAt: { lte: now }, endsAt: null },
      { startsAt: null, endsAt: { gte: now } },
      { startsAt: { lte: now }, endsAt: { gte: now } },
    ],
    // Targeting: show banner if targetRole is null (all) or matches current user
    AND: [
      {
        OR: [
          { targetRole: null },
          ...(userRole ? [{ targetRole: userRole as any }] : []),
        ],
      },
    ],
  };

  if (query.position) where.position = query.position;

  const banners = await prisma.banner.findMany({
    where,
    orderBy: [{ position: "asc" }, { sortOrder: "asc" }],
    select: {
      id:        true,
      title:     true,
      subtitle:  true,
      imageUrl:  true,
      linkUrl:   true,
      altText:   true,
      position:  true,
      sortOrder: true,
      startsAt:  true,
      endsAt:    true,
    },
  });

  return { banners };
}

export async function recordBannerClickService(bannerId: string): Promise<void> {
  prisma.banner
    .updateMany({
      where: { id: bannerId, deletedAt: null },
      data:  { clickCount: { increment: 1 } },
    })
    .catch((err) => console.error("[Banner] Click tracking failed:", err));
}
