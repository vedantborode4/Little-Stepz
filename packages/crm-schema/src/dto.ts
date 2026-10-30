import type { CurrencyCode, MappingState, PriceField, ProductStatus, VariantStatus } from "./catalog";
import type { CustomerType, DuplicateReason } from "./customers";
import type { FulfilmentMethod, PriceSource, SalesChannel, SalesOrderStatus, SalesOrderType } from "./sales";
import type { LocationType, PaymentMethod, Role } from "./enums";
import type { StockBucket, StockDocumentType, StockReasonCode, StockState } from "./inventory";
import type { AllocationMethod, ChargeType, PurchaseStatus } from "./purchases";
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
  physicalQty: number;
  availableQty: number;
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
  physicalQty: number;
  availableQty: number;
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

// ─── Inventory ───────────────────────────────────────────────────────────────

/**
 * Cost fields are omitted (undefined) for roles without `costs.view`; the API
 * strips them, the client only renders what it receives.
 */
export interface CostFieldsDto {
  avgUnitCost?: string | null;
  stockValue?: string | null;
  unvaluedQty?: number;
}

export interface BucketQuantitiesDto {
  sellable: number;
  damaged: number;
  demo: number;
  quarantine: number;
}

export interface StockRowDto extends BucketQuantitiesDto, CostFieldsDto {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  imageUrl: string | null;
  reorderLevel: number;
  byLocation: (BucketQuantitiesDto & { locationId: string; locationCode: string; locationName: string })[];
  physical: number;
  reserved: number;
  available: number;
  state: StockState;
}

export interface StockSummaryDto extends CostFieldsDto {
  variants: number;
  physical: number;
  available: number;
  damaged: number;
  demo: number;
  lowStock: number;
  outOfStock: number;
}

export interface LedgerRowDto {
  id: string;
  documentId: string;
  documentCode: string;
  type: StockDocumentType;
  /** The type a reversal undoes, so reports attribute it correctly. */
  effectiveType: StockDocumentType;
  businessDate: string;
  createdAt: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  locationCode: string;
  bucket: StockBucket;
  quantity: number;
  unitCost?: string | null;
  reference: string | null;
  reason: string;
  reasonCode: StockReasonCode | null;
  createdByName: string | null;
}

export interface StockDocumentDto {
  id: string;
  code: string;
  type: StockDocumentType;
  /** For a reversal, the type it undoes; otherwise the same as `type`. */
  effectiveType: StockDocumentType;
  businessDate: string;
  reason: string;
  reasonCode: StockReasonCode | null;
  reference: string | null;
  notes: string | null;
  sourceType: string | null;
  createdByName: string | null;
  createdAt: string;
  reversalOf: { id: string; code: string } | null;
  reversedBy: { id: string; code: string } | null;
  canReverse: boolean;
  lines: {
    variantId: string;
    sku: string;
    productName: string;
    variantName: string;
    locationCode: string;
    bucket: StockBucket;
    quantity: number;
    unitCost?: string | null;
  }[];
}

/** Closing physical stock = opening + purchases + sales returns − sales − purchase returns − write-offs ± adjustments. */
export interface StockReconciliationDto {
  opening: number;
  purchases: number;
  salesReturns: number;
  sales: number;
  purchaseReturns: number;
  writeOffs: number;
  adjustments: number;
  /** Transfers and status changes move units around without changing the total; always 0 overall. */
  internalNet: number;
  computedPhysical: number;
  actualPhysical: number;
}

export interface VariantStockCardDto {
  stock: StockRowDto;
  reconciliation: StockReconciliationDto;
  recent: LedgerRowDto[];
}

export interface VariantSearchResultDto {
  id: string;
  sku: string;
  name: string;
  productId: string;
  productCode: string;
  productName: string;
  imageUrl: string | null;
  status: VariantStatus;
}

// ─── Purchasing ──────────────────────────────────────────────────────────────

/** All money below is INR unless the field says otherwise. Cost fields are omitted for roles without `costs.view`. */
export interface LandedCostLineDto {
  unitPriceInr: string;
  allocatedCharges: string;
  landedUnitCost: string;
  landedTotal: string;
}

export interface LandedCostTotalsDto {
  goodsForeign: string;
  goodsInr: string;
  /** Charges that become part of inventory cost. */
  capitalisedCharges: string;
  /** Claimable input GST / IGST, kept out of inventory cost. */
  inputTaxCredit: string;
  landedTotal: string;
  units: number;
}

export interface LandedCostPreviewDto {
  lines: LandedCostLineDto[];
  totals: LandedCostTotalsDto;
}

export interface PurchaseListItemDto {
  id: string;
  code: string;
  status: PurchaseStatus;
  supplier: RefDto;
  invoiceNumber: string | null;
  invoiceDate: string;
  currency: string;
  locationName: string;
  lineCount: number;
  units: number;
  landedTotal?: string | null;
  receivedAt: string | null;
}

export interface PurchaseLineDto {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  returnedQty: number;
  weightKg: string | null;
  cbm: string | null;
  unitPrice?: string;
  costs?: LandedCostLineDto | null;
}

export interface ShipmentChargeDto {
  id: string;
  type: ChargeType;
  description: string | null;
  amount: string;
  currency: string;
  amountInr: string;
  isRecoverableTax: boolean;
}

export interface CostAdjustmentDto {
  id: string;
  code: string;
  type: ChargeType;
  description: string | null;
  amountInr: string;
  isRecoverableTax: boolean;
  allocationMethod: AllocationMethod;
  businessDate: string;
  createdByName: string | null;
  createdAt: string;
  lines: { variantId: string; sku: string; allocated: string; toInventory: string; toCostOfSales: string }[];
}

export interface PurchaseReturnDto {
  id: string;
  code: string;
  businessDate: string;
  reason: string;
  locationName: string;
  stockDocumentId: string;
  createdByName: string | null;
  lines: { sku: string; productName: string; variantName: string; quantity: number }[];
}

export interface PurchaseDetailDto {
  id: string;
  code: string;
  status: PurchaseStatus;
  supplier: RefDto;
  invoiceNumber: string | null;
  shipmentRef: string | null;
  invoiceDate: string;
  currency: string;
  exchangeRate?: string;
  allocationMethod: AllocationMethod;
  location: RefDto;
  notes: string | null;
  receivedAt: string | null;
  receivedDate: string | null;
  receivedByName: string | null;
  createdByName: string | null;
  stockDocument: { id: string; code: string } | null;
  lines: PurchaseLineDto[];
  charges?: ShipmentChargeDto[];
  /** Frozen figures once received; a live preview while still a draft. */
  totals?: LandedCostTotalsDto | null;
  costAdjustments?: CostAdjustmentDto[];
  returns: PurchaseReturnDto[];
}

// ─── Customers ───────────────────────────────────────────────────────────────

/**
 * Contact details are masked ("+91 •••••• 3210") everywhere except the audited
 * reveal endpoint and an admin's full-contact export.
 */
export interface CustomerListItemDto {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  mobile: string | null;
  email: string | null;
  city: string | null;
  pincode: string | null;
  creditDays: number | null;
  creditLimit: string | null;
  isActive: boolean;
  mergedInto: { id: string; code: string; name: string } | null;
  createdAt: string;
}

export interface CustomerContactDto {
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
}

export interface CustomerPriceDto {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  price: string;
  regularPrice: string;
  offerPrice: string | null;
  wholesalePrice: string | null;
  updatedAt: string;
}

/** Lifetime value counts fulfilled orders only (money for unfulfilled orders is an advance). */
export interface CustomerStatsDto {
  orders: number;
  lifetimeValue: string;
  lastOrderDate: string | null;
}

export interface CustomerDetailDto extends CustomerListItemDto {
  whatsapp: string | null;
  addressLine: string | null;
  stateCode: string | null;
  notes: string | null;
  mergedFrom: { id: string; code: string; name: string }[];
  prices: CustomerPriceDto[];
  stats: CustomerStatsDto;
  updatedAt: string;
}

export interface DuplicateMatchDto {
  id: string;
  code: string;
  name: string;
  mobile: string | null;
  city: string | null;
  pincode: string | null;
  reason: DuplicateReason;
}

export interface DuplicatePairDto {
  a: DuplicateMatchDto;
  b: DuplicateMatchDto;
  reason: DuplicateReason;
  similarity: number;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

/** An item as POS sees it: list prices and what can be sold from the chosen location now. */
export interface SellableItemDto {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  regularPrice: string;
  offerPrice: string | null;
  gstRate: string;
  /** Sellable at the location minus units reserved for confirmed orders. */
  available: number;
}

/** Every amount is GST-inclusive except `taxableValue` (net of GST). */
export interface SaleLinePricingDto {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  regularPrice: string;
  unitPrice: string;
  priceSource: PriceSource;
  lineDiscount: string;
  orderDiscountShare: string;
  lineTotal: string;
  gstRate: string;
  taxableValue: string;
  gstAmount: string;
}

export interface SaleTotalsDto {
  units: number;
  /** Σ quantity × unit price, before any discount. */
  subtotal: string;
  lineDiscounts: string;
  orderDiscount: string;
  shippingCharged: string;
  grandTotal: string;
  taxableTotal: string;
  gstTotal: string;
}

export interface SaleQuoteDto {
  lines: (SaleLinePricingDto & { available: number })[];
  totals: SaleTotalsDto;
  /** Wholesale pricing applies (wholesale customer or channel). */
  wholesale: boolean;
  isInterState: boolean;
}

export interface SalesOrderListItemDto {
  id: string;
  code: string;
  type: SalesOrderType;
  channel: SalesChannel;
  fulfilment: FulfilmentMethod;
  status: SalesOrderStatus;
  customer: { id: string; code: string; name: string } | null;
  orderDate: string;
  units: number;
  grandTotal: string;
  fulfilledAt: string | null;
  createdAt: string;
}

/**
 * Profit is only known once stock has left (the cost is fixed at that moment).
 * `grossProfit` is net of GST; `profitBeforeGst` is the simple price − cost figure.
 */
export interface OrderProfitDto {
  netSales: string;
  cogs: string;
  grossProfit: string;
  marginPercent: string | null;
  profitBeforeGst: string;
  /** Units whose cost is unknown; their profit is left out rather than guessed. */
  unknownCostUnits: number;
}

export interface SalesOrderLineDto extends SaleLinePricingDto {
  id: string;
  reservedQty: number;
  cogs?: string | null;
  unknownCostQty?: number;
}

export interface SalesOrderEventDto {
  id: string;
  action: string;
  status: SalesOrderStatus | null;
  note: string | null;
  userName: string | null;
  createdAt: string;
}

export interface SalesOrderDetailDto extends SalesOrderListItemDto {
  location: RefDto;
  customerName: string | null;
  dueDate: string | null;
  expectedArrival: string | null;
  isInterState: boolean;
  externalRef: string | null;
  notes: string | null;
  confirmedAt: string | null;
  fulfilledDate: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdByName: string | null;
  stockDocument: { id: string; code: string } | null;
  lines: SalesOrderLineDto[];
  totals: SaleTotalsDto;
  profit?: OrderProfitDto | null;
  events: SalesOrderEventDto[];
}

/** Revenue counts once, when an order is fulfilled (handed over or dispatched). */
export interface SalesSummaryDto {
  from: string;
  to: string;
  orders: number;
  units: number;
  grossSales: string;
  netSales: string;
  gst: string;
  discounts: string;
  cogs?: string;
  grossProfit?: string;
  unknownCostUnits?: number;
  byChannel: { channel: SalesChannel; orders: number; grossSales: string }[];
}

/** Error envelope returned with every non-2xx response. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } & Record<string, unknown>;
  };
}
