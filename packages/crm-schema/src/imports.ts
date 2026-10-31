import { z } from "zod";
import { listQuery, requiredText } from "./common";

export const IMPORT_KINDS = ["PRODUCTS", "OPENING_STOCK", "CUSTOMERS"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  PRODUCTS: "Products & variants",
  OPENING_STOCK: "Opening stock",
  CUSTOMERS: "Customers",
};

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
    field("category", "Category", true, ["category", "type"], "Must match an existing category"),
    field("sku", "SKU", true, ["sku", "code", "item code"]),
    field("gstRate", "GST %", true, ["gst", "gst rate", "tax", "tax rate"]),
    field("regularPrice", "Regular price (incl. GST)", true, ["price", "mrp", "regular price", "selling price"]),
    field("offerPrice", "Offer price", false, ["offer", "sale price", "offer price", "discounted price"]),
    field("wholesalePrice", "Wholesale price", false, ["wholesale", "wholesale price", "dealer price"]),
    field("optionName", "Option name", false, ["option", "option name", "attribute"], "e.g. Colour; needed when a product has several rows"),
    field("optionValue", "Option value", false, ["variant", "colour", "color", "size", "option value"]),
    field("brand", "Brand", false, ["brand", "make"], "Must match an existing brand"),
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
};

export const importUploadQuery = z.object({
  kind: z.enum(IMPORT_KINDS),
  fileName: requiredText(200),
});
export type ImportUploadQuery = z.infer<typeof importUploadQuery>;

/** Target field → file header (null or missing = not imported). */
export const importMappingSchema = z.object({
  mapping: z.record(z.string(), z.string().trim().max(200).nullable()),
  /** Where opening stock lands. */
  locationId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((v) => v || null)
    .nullish(),
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
