import { prisma, type AuditLog, type Prisma } from "@repo/crm-db/client";
import type { AuditDto, AuditListQuery } from "@repo/crm-schema";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";

type AuditRow = AuditLog & { user: { name: string } | null };

export const toAuditDto = (row: AuditRow): AuditDto => ({
  id: row.id,
  action: row.action,
  entity: row.entity,
  entityId: row.entityId,
  before: row.before,
  after: row.after,
  metadata: row.metadata,
  userId: row.userId,
  userName: row.user?.name ?? null,
  createdAt: row.createdAt.toISOString(),
});

const SORTABLE = { createdAt: "createdAt", action: "action", entity: "entity" };

/** `to` is inclusive of the whole day (dates are compared in UTC). */
function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
    ...(to && { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) }),
  };
}

export async function listAudit(query: AuditListQuery) {
  const where: Prisma.AuditLogWhereInput = {
    entity: query.entity,
    entityId: query.entityId,
    userId: query.userId,
    action: query.action ? { startsWith: query.action } : undefined,
    createdAt: dateRange(query.from, query.to),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: buildOrderBy(query.sort, SORTABLE, "createdAt:desc"),
      ...pageWindow(query),
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginated(rows.map(toAuditDto), total, query);
}
