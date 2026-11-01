import { z } from "zod";
import { listQuery, requiredText } from "./common";

export const IMPORT_KINDS = ["PRODUCTS", "OPENING_STOCK", "CUSTOMERS", "HISTORICAL_SALES", "EXPENSES"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  PRODUCTS: "Products & variants",
  OPENING_STOCK: "Opening stock",
  CUSTOMERS: "Customers",
  HISTORICAL_SALES: "Past sales (history)",
  EXPENSES: "Expenses",
};

/** Kinds that need a stock location chosen before checking. */
export const IMPORT_KINDS_WITH_LOCATION: readonly ImportKind[] = ["OPENING_STOCK", "HISTORICAL_SALES"];

/** Kinds whose approved records are locked money records: they are corrected with returns and refunds, not rolled back. */
export const IMPORT_KINDS_WITHOUT_ROLLBACK: readonly ImportKind[] = ["HISTORICAL_SALES"];

export const IMPORT_BATCH_STATUSES = ["UPLOADED", "VALIDATED", "IMPORTED", "ROLLED_BACK", "CANCELLED"] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];
export const IMPORT_BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
  UPLOADED: "Map columns",
  VALIDATED: "Ready to approve",
  IMPORTED: "Imported",
  ROLLED_BACK: "Rolled back",
  CANCELLED: "Cancelled",
};

export const IMPORT_ROW_STATUSES = ["PENDING", "VALID", "ERROR", "DUPLICATE", "IMPORTED"] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];
export const IMPORT_ROW_STATUS_LABELS: Record<ImportRowStatus, string> = {
  PENDING: "Not checked",
  VALID: "Ready",
  ERROR: "Error",
  DUPLICATE: "Duplicate — skipped",
  IMPORTED: "Imported",
};

/** Files are capped so a whole batch can be checked and approved in one go. */
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  /** Extra header spellings recognised when suggesting a mapping. */
  aliases: string[];
  hint?: string;
}

const field = (key: string, label: string, required: boolean, aliases: string[] = [], hint?: string): ImportField => ({
  key,
  label,
  required,
  aliases,
  hint,
});

/**
 * What each kind of import can fill. Anything not mapped stays empty: costs,
 * contacts and other history are never guessed.
 */
export const IMPORT_FIELDS: Record<ImportKind, ImportField[]> = {
  PRODUCTS: [
    field("productName", "Product name", true, ["product", "name", "item", "title"], "Rows with the same name become one product"),
    field("category", "Category", true, ["category", "type"], "A category that doesn't exist yet is created"),
    field("sku", "SKU", true, ["sku", "code", "item code"]),
    field("gstRate", "GST %", false, ["gst", "gst rate", "tax", "tax rate"], "Blank uses the category's rate"),
    field("regularPrice", "Regular price (incl. GST)", true, ["price", "mrp", "regular price", "selling price"]),
    field("offerPrice", "Offer price", false, ["offer", "sale price", "offer price", "discounted price"]),
    field("wholesalePrice", "Wholesale price", false, ["wholesale", "wholesale price", "dealer price"]),
    field("optionName", "Option name", false, ["option", "option name", "attribute"], "e.g. Colour; needed when a product has several rows"),
    field("optionValue", "Option value", false, ["variant", "colour", "color", "size", "option value"]),
    field("brand", "Brand", false, ["brand", "make"], "A brand that doesn't exist yet is created"),
    field("scale", "Scale", false, ["scale"]),
    field("hsnCode", "HSN", false, ["hsn", "hsn code"]),
    field("reorderLevel", "Reorder level", false, ["reorder", "reorder level", "min stock"]),
    field("description", "Description", false, ["description", "details"]),
    field("websiteProductId", "Website product ID", false, ["website product id", "web product id"]),
    field("websiteVariantId", "Website variant ID", false, ["website variant id", "web variant id"]),
  ],
  OPENING_STOCK: [
    field("sku", "SKU", true, ["sku", "code", "item code"]),
    field("quantity", "Quantity", true, ["qty", "quantity", "stock", "units", "on hand"]),
    field("unitCost", "Landed unit cost", false, ["cost", "unit cost", "landed cost", "purchase price"], "Leave blank when unknown; it is never guessed"),
  ],
  CUSTOMERS: [
    field("name", "Name", true, ["name", "customer", "customer name"]),
    field("mobile", "Mobile", false, ["mobile", "phone", "contact", "mobile number", "phone number"]),
    field("whatsapp", "WhatsApp", false, ["whatsapp", "whatsapp number"]),
    field("email", "Email", false, ["email", "e-mail", "mail"]),
    field("addressLine", "Address", false, ["address", "address line"]),
    field("city", "City", false, ["city", "town"]),
    field("state", "State", false, ["state"], "State name or GST state code"),
    field("pincode", "PIN code", false, ["pincode", "pin", "pin code", "zip"]),
    field("type", "Type", false, ["type", "customer type"], "Retail or Wholesale; blank means Retail"),
    field("creditDays", "Credit days", false, ["credit days", "terms"]),
    field("creditLimit", "Credit limit", false, ["credit limit", "limit"]),
    field("notes", "Notes", false, ["notes", "remarks", "comments"]),
  ],
  HISTORICAL_SALES: [
    field("billId", "Bill ID", true, ["transaction id", "bill", "bill no", "bill id", "invoice", "order id"], "Rows with the same bill ID are one bill"),
    field("saleDate", "Sale date", true, ["date", "sale date", "bill date"], "YYYY-MM-DD or DD-MM-YYYY"),
    field("sku", "SKU", true, ["sku", "product sku", "item code"], "Blank on a row that only carries a payment or courier charge"),
    field("quantity", "Quantity", true, ["qty", "quantity", "quantity sold", "units"]),
    field("unitPrice", "Price per piece (incl. GST)", true, ["actual selling price", "selling price", "unit price", "price", "rate"]),
    field("lineDiscount", "Line discount (₹)", false, ["line discount", "discount"]),
    field("billDiscount", "Bill discount (₹)", false, ["bill discount", "bill discount (once per bill)"], "Whole-bill discount; added up across the bill's rows"),
    field("unitCost", "Landed cost per piece", false, ["landed cost", "landed cost / piece", "unit cost", "cost"], "Blank means the cost is unknown; it is never guessed"),
    field("gstRate", "GST % on this sale", false, ["gst", "gst %", "gst rate", "tax rate"], "Blank uses the product's rate"),
    field("payment1", "Payment 1 (₹)", false, ["phonepe amount", "phonepe", "upi"], "Choose below which account it went into"),
    field("payment2", "Payment 2 (₹)", false, ["cash amount", "cash"], "Choose below which account it went into"),
    field("payment3", "Payment 3 (₹)", false, ["online amount", "online", "card"], "Choose below which account it went into"),
    field("courier", "Courier charges (₹)", false, ["courier charges", "courier", "shipping cost"], "Recorded as an expense on the bill"),
    field("channel", "Channel", false, ["channel", "sales channel", "source"], "Store, Website, WhatsApp, Instagram, Facebook, Wholesale or Other; blank is Store"),
    field("customer", "Customer", false, ["customer name", "customer"], "Name, mobile or code of an existing customer; blank or Walk-in is a walk-in"),
    field("notes", "Notes", false, ["notes", "remarks"]),
  ],
  EXPENSES: [
    field("date", "Date paid", true, ["date", "date paid", "expense date", "paid on"], "YYYY-MM-DD or DD-MM-YYYY"),
    field("category", "Expense category", true, ["expense category", "category", "head"], "Must match an expense category"),
    field("amount", "Amount (₹)", true, ["amount", "amount (₹)", "value"]),
    field("account", "Paid from", true, ["paid via", "paid from", "account", "mode"], "An account name, or a method (Cash, PhonePe…) that matches one account"),
    field("description", "Description", false, ["description", "expense", "details", "particulars"]),
    field("vendor", "Paid to", false, ["vendor", "paid to", "supplier"]),
    field("reference", "Reference", false, ["reference", "bill no", "invoice no"]),
  ],
};

export type ImportOptionType = "account" | "expenseCategory";

/** A choice made while mapping that isn't a column, e.g. which account a payment column went into. */
export interface ImportOption {
  key: string;
  label: string;
  type: ImportOptionType;
  /** Required only when this field's column is mapped. */
  whenMapped: string;
}

export const IMPORT_OPTIONS: Record<ImportKind, ImportOption[]> = {
  PRODUCTS: [],
  OPENING_STOCK: [],
  CUSTOMERS: [],
  HISTORICAL_SALES: [
    { key: "payment1Account", label: "Payment 1 went into", type: "account", whenMapped: "payment1" },
    { key: "payment2Account", label: "Payment 2 went into", type: "account", whenMapped: "payment2" },
    { key: "payment3Account", label: "Payment 3 went into", type: "account", whenMapped: "payment3" },
    { key: "courierAccount", label: "Courier paid from", type: "account", whenMapped: "courier" },
    { key: "courierCategory", label: "Courier expense category", type: "expenseCategory", whenMapped: "courier" },
  ],
  EXPENSES: [],
};

const sheetName = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v || undefined)
  .optional();

export const importUploadQuery = z.object({
  kind: z.enum(IMPORT_KINDS),
  fileName: requiredText(200),
  /** The worksheet to read; required when an Excel file has more than one. */
  sheet: sheetName,
  /** The row holding the column headings; found automatically when left out. */
  headerRow: z.coerce.number().int().min(1).max(100).optional(),
});
export type ImportUploadQuery = z.infer<typeof importUploadQuery>;

/** Target field → file header (null or missing = not imported). */
export const importMappingSchema = z.object({
  mapping: z.record(z.string(), z.string().trim().max(200).nullable()),
  /** Where opening stock and historical sales land. */
  locationId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((v) => v || null)
    .nullish(),
  /** Option key → chosen id (see IMPORT_OPTIONS). */
  options: z.record(z.string(), z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null)).default({}),
  /** Save this mapping as a reusable template under this name. */
  saveTemplateAs: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null)
    .nullish(),
});
export type ImportMappingInput = z.infer<typeof importMappingSchema>;

export const importListQuery = listQuery.extend({
  kind: z.enum(IMPORT_KINDS).optional(),
  status: z.enum(IMPORT_BATCH_STATUSES).optional(),
});
export type ImportListQuery = z.infer<typeof importListQuery>;

export const importRowsQuery = listQuery.extend({
  status: z.enum(IMPORT_ROW_STATUSES).optional(),
});
export type ImportRowsQuery = z.infer<typeof importRowsQuery>;

export const importReasonSchema = z.object({ reason: requiredText(200) });

export const importTemplatesQuery = z.object({ kind: z.enum(IMPORT_KINDS) });
