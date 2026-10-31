import { prisma, type Prisma } from "@repo/crm-db/client";
import type { MappingListQuery, MappingRowDto, MappingState, SetMappingInput } from "@repo/crm-schema";
import { recordAudit } from "../../core/audit";
import { withTransaction } from "../../core/db";
import { notFound, type RequestContext } from "../../core/http";
import { buildOrderBy, pageWindow, paginated } from "../../core/list";
import { mappingState } from "./products.mappers";
import { assertWebsiteProductIdFree, assertWebsiteVariantIdFree } from "./products.service";

const SORTABLE = { sku: "sku", product: "product.name", updatedAt: "updatedAt" };

const STATE_FILTERS: Record<MappingState, Prisma.VariantWhereInput> = {
  MAPPED: { websiteVariantId: { not: null }, product: { websiteProductId: { not: null } } },
  UNMAPPED: { websiteVariantId: null, product: { websiteProductId: null } },
  PARTIAL: {
    OR: [
      { websiteVariantId: null, product: { websiteProductId: { not: null } } },
      { websiteVariantId: { not: null }, product: { websiteProductId: null } },
    ],
  },
};

const include = { product: { select: { id: true, code: true, name: true, websiteProductId: true } } } satisfies Prisma.VariantInclude;

function toRow(v: Prisma.VariantGetPayload<{ include: typeof include }>): MappingRowDto {
  return {
    variantId: v.id,
    sku: v.sku,
    variantName: v.name,
    productId: v.product.id,
    productCode: v.product.code,
    productName: v.product.name,
    websiteProductId: v.product.websiteProductId,
    websiteVariantId: v.websiteVariantId,
    state: mappingState(!!v.product.websiteProductId, [!!v.websiteVariantId]),
  };
}

/** Variant-level view of website links, for finding and fixing gaps. */
export async function listMappings(query: MappingListQuery) {
  const where: Prisma.VariantWhereInput = {
    status: "ACTIVE",
    AND: [
      { product: { status: { not: "ARCHIVED" }, categoryId: query.categoryId } },
      query.state ? STATE_FILTERS[query.state] : {},
      query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: "insensitive" } },
              { product: { name: { contains: query.q, mode: "insensitive" } } },
              { websiteVariantId: { contains: query.q } },
            ],
          }
        : {},
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.variant.findMany({ where, include, orderBy: buildOrderBy(query.sort, SORTABLE, "product:asc"), ...pageWindow(query) }),
    prisma.variant.count({ where }),
  ]);
  return paginated(rows.map(toRow), total, query);
}

/**
 * Records which website product/variant a CRM variant corresponds to. These are
 * references only — nothing is read from or written to the website here.
 */
export async function setMapping(variantId: string, input: SetMappingInput, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await tx.variant.findUnique({ where: { id: variantId }, include });
    if (!before) throw notFound("Variant");
    await assertWebsiteProductIdFree(tx, input.websiteProductId, before.product.id);
    await assertWebsiteVariantIdFree(tx, input.websiteVariantId, variantId);

    if (input.websiteProductId !== undefined) {
      await tx.product.update({ where: { id: before.product.id }, data: { websiteProductId: input.websiteProductId } });
    }
    if (input.websiteVariantId !== undefined) {
      await tx.variant.update({ where: { id: variantId }, data: { websiteVariantId: input.websiteVariantId } });
    }
    const after = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, include });

    await recordAudit(tx, ctx, {
      action: "variant.mapping_updated",
      entity: "Variant",
      entityId: variantId,
      before: { sku: before.sku, websiteProductId: before.product.websiteProductId, websiteVariantId: before.websiteVariantId },
      after: { sku: after.sku, websiteProductId: after.product.websiteProductId, websiteVariantId: after.websiteVariantId },
    });
    return toRow(after);
  });
}
