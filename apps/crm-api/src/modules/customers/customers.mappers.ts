import type { Prisma } from "@repo/crm-db/client";
import type { CustomerContactDto, CustomerDetailDto, CustomerListItemDto, CustomerStatsDto } from "@repo/crm-schema";
import { moneyOrNull, money } from "../../core/money";
import { maskEmail, maskMobile } from "../../core/pii";

export const customerListInclude = {
  mergedInto: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CustomerInclude;

export const customerDetailInclude = {
  ...customerListInclude,
  mergedFrom: { select: { id: true, code: true, name: true }, orderBy: { mergedAt: "desc" } },
  prices: {
    include: {
      variant: {
        select: { sku: true, name: true, regularPrice: true, offerPrice: true, wholesalePrice: true, product: { select: { name: true } } },
      },
    },
    orderBy: { variant: { sku: "asc" } },
  },
} satisfies Prisma.CustomerInclude;

type ListRow = Prisma.CustomerGetPayload<{ include: typeof customerListInclude }>;
type DetailRow = Prisma.CustomerGetPayload<{ include: typeof customerDetailInclude }>;

export const toCustomerListItemDto = (c: ListRow): CustomerListItemDto => ({
  id: c.id,
  code: c.code,
  name: c.name,
  type: c.type,
  mobile: maskMobile(c.mobile),
  email: maskEmail(c.email),
  city: c.city,
  pincode: c.pincode,
  creditDays: c.creditDays,
  creditLimit: moneyOrNull(c.creditLimit),
  isActive: c.isActive,
  mergedInto: c.mergedInto,
  createdAt: c.createdAt.toISOString(),
});

export const toCustomerDetailDto = (c: DetailRow, stats: CustomerStatsDto): CustomerDetailDto => ({
  ...toCustomerListItemDto(c),
  whatsapp: maskMobile(c.whatsapp),
  addressLine: c.addressLine,
  stateCode: c.stateCode,
  notes: c.notes,
  mergedFrom: c.mergedFrom,
  prices: c.prices.map((p) => ({
    variantId: p.variantId,
    sku: p.variant.sku,
    productName: p.variant.product.name,
    variantName: p.variant.name,
    price: money(p.price),
    regularPrice: money(p.variant.regularPrice),
    offerPrice: moneyOrNull(p.variant.offerPrice),
    wholesalePrice: moneyOrNull(p.variant.wholesalePrice),
    updatedAt: p.updatedAt.toISOString(),
  })),
  stats,
  updatedAt: c.updatedAt.toISOString(),
});

export const toContactDto = (c: { mobile: string | null; whatsapp: string | null; email: string | null }): CustomerContactDto => ({
  mobile: c.mobile,
  whatsapp: c.whatsapp,
  email: c.email,
});

/** Audit snapshot: full values (the audit log is admin-only), money as strings. */
export const auditSnapshot = (c: Prisma.CustomerGetPayload<object>) => ({
  code: c.code,
  name: c.name,
  mobile: c.mobile,
  whatsapp: c.whatsapp,
  email: c.email,
  addressLine: c.addressLine,
  city: c.city,
  stateCode: c.stateCode,
  pincode: c.pincode,
  type: c.type,
  creditDays: c.creditDays,
  creditLimit: moneyOrNull(c.creditLimit),
  notes: c.notes,
  isActive: c.isActive,
  mergedIntoId: c.mergedIntoId,
});
