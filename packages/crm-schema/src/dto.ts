import type { CurrencyCode, MappingState, PriceField, ProductStatus, VariantStatus } from "./catalog";
import type { LocationType, PaymentMethod, Role } from "./enums";
import type { Permission } from "./permissions";

/**
 * Response shapes. crm-api mappers are typed against these, so a field the API
 * stops sending is a compile error for the clients too. Money is a decimal
 * string; timestamps are UTC ISO strings.
 */

export interface SessionUserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  permissions: readonly Permission[];
}

export interface SessionDto {
  user: SessionUserDto;
  accessToken: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BusinessProfileDto {
  legalName: string;
  tradeName: string;
  gstin: string | null;
  stateCode: string;
  addressLine: string;
  city: string;
  pincode: string;
  phone: string | null;
  email: string | null;
  receiptFooter: string | null;
  updatedAt: string;
}

export interface LocationDto {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  address: string | null;
  isActive: boolean;
}

export interface ReceivingAccountDto {
  id: string;
  name: string;
  method: PaymentMethod;
  isPersonal: boolean;
  feePercent: string;
  details: string | null;
  isActive: boolean;
}

export interface AuditDto {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export interface NamedEntityDto {
  id: string;
  name: string;
  isActive: boolean;
  productCount: number;
}

export interface SupplierDto {
  id: string;
  name: string;
  country: string | null;
  currency: CurrencyCode;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface RefDto {
  id: string;
  name: string;
}

export interface ProductListItemDto {
  id: string;
  code: string;
  name: string;
  imageUrl: string | null;
  category: RefDto;
  brand: RefDto | null;
  scale: string | null;
  status: ProductStatus;
  gstRate: string;
  variantCount: number;
  regularPriceMin: string | null;
  regularPriceMax: string | null;
  offerPriceMin: string | null;
  mapping: MappingState;
  updatedAt: string;
}

export interface PriceTierDto {
  minQty: number;
  price: string;
}

export interface VariantDto {
  id: string;
  sku: string;
  name: string;
  optionValueIds: string[];
  regularPrice: string;
  offerPrice: string | null;
  wholesalePrice: string | null;
  reorderLevel: number;
  websiteVariantId: string | null;
  status: VariantStatus;
  priceTiers: PriceTierDto[];
}

export interface ProductOptionDto {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

export interface ProductDetailDto {
  id: string;
  code: string;
  name: string;
  category: RefDto;
  brand: RefDto | null;
  supplier: RefDto | null;
  scale: string | null;
  status: ProductStatus;
  imageUrl: string | null;
  description: string | null;
  notes: string | null;
  hsnCode: string | null;
  gstRate: string;
  websiteProductId: string | null;
  options: ProductOptionDto[];
  variants: VariantDto[];
  createdAt: string;
  updatedAt: string;
}

export interface MappingRowDto {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productCode: string;
  productName: string;
  websiteProductId: string | null;
  websiteVariantId: string | null;
  state: MappingState;
}

export interface PriceChangeDto {
  id: string;
  field: PriceField;
  oldPrice: string | null;
  newPrice: string | null;
  reason: string | null;
  batchId: string | null;
  changedByName: string | null;
  createdAt: string;
}

export interface BulkPricePreviewRowDto {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  oldPrice: string | null;
  newPrice: string | null;
  error: string | null;
}

/** Error envelope returned with every non-2xx response. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } & Record<string, unknown>;
  };
}
