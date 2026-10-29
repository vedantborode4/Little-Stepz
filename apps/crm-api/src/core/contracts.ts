import type * as Db from "@repo/crm-db/client";
import type * as Schema from "@repo/crm-schema";

/**
 * Compile-time guard: the enums clients see (@repo/crm-schema) must match the
 * database enums exactly. Adding a value on one side only fails the build here.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumParity = [
  Assert<Same<Db.Role, Schema.Role>>,
  Assert<Same<Db.PaymentMethod, Schema.PaymentMethod>>,
  Assert<Same<Db.LocationType, Schema.LocationType>>,
  Assert<Same<Db.ProductStatus, Schema.ProductStatus>>,
  Assert<Same<Db.VariantStatus, Schema.VariantStatus>>,
  Assert<Same<Db.PriceField, Schema.PriceField>>,
  Assert<Same<Db.StockBucket, Schema.StockBucket>>,
  Assert<Same<Db.StockDocumentType, Schema.StockDocumentType>>,
  Assert<Same<Db.StockReasonCode, Schema.StockReasonCode>>,
];
