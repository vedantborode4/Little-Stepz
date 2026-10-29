import type { Request, Response } from "express";
import {
  addVariantSchema,
  bulkPriceApplySchema,
  bulkPricePreviewSchema,
  createProductSchema,
  idParam,
  mappingListQuery,
  MAPPING_STATE_LABELS,
  priceTiersSchema,
  PRODUCT_STATUS_LABELS,
  productListQuery,
  setMappingSchema,
  updateProductSchema,
  updateVariantSchema,
} from "@repo/crm-schema";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as mapping from "./mapping.service";
import * as pricing from "./pricing.service";
import * as products from "./products.service";
import * as variants from "./variants.service";

export async function list(req: Request, res: Response) {
  const query = productListQuery.parse(req.query);
  const result = await products.listProducts(query);
  if (query.format) {
    return sendExport(res, {
      filename: "products",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Code", value: (p) => p.code },
        { header: "Name", value: (p) => p.name, width: 36 },
        { header: "Category", value: (p) => p.category.name, width: 18 },
        { header: "Brand", value: (p) => p.brand?.name ?? "" },
        { header: "Scale", value: (p) => p.scale ?? "" },
        { header: "Status", value: (p) => PRODUCT_STATUS_LABELS[p.status] },
        { header: "GST %", value: (p) => Number(p.gstRate) },
        { header: "Variants", value: (p) => p.variantCount },
        { header: "Regular price (min)", value: (p) => (p.regularPriceMin ? Number(p.regularPriceMin) : null) },
        { header: "Regular price (max)", value: (p) => (p.regularPriceMax ? Number(p.regularPriceMax) : null) },
        { header: "Lowest offer price", value: (p) => (p.offerPriceMin ? Number(p.offerPriceMin) : null) },
        { header: "Website mapping", value: (p) => MAPPING_STATE_LABELS[p.mapping] },
      ],
    });
  }
  sendData(res, result);
}

export async function get(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await products.getProduct(id));
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  sendData(res, await products.createProduct(input, requestContext(req)), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateProductSchema.parse(req.body);
  sendData(res, await products.updateProduct(id, input, requestContext(req)));
}

export async function addVariant(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = addVariantSchema.parse(req.body);
  sendData(res, await variants.addVariant(id, input, requestContext(req)), 201);
}

export async function updateVariant(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = updateVariantSchema.parse(req.body);
  sendData(res, await variants.updateVariant(id, input, requestContext(req)));
}

export async function setTiers(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = priceTiersSchema.parse(req.body);
  sendData(res, await variants.setPriceTiers(id, input, requestContext(req)));
}

export async function priceHistory(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendData(res, await variants.getPriceHistory(id));
}

export async function previewBulkPrice(req: Request, res: Response) {
  const input = bulkPricePreviewSchema.parse(req.body);
  sendData(res, await pricing.previewBulkPrice(input));
}

export async function applyBulkPrice(req: Request, res: Response) {
  const input = bulkPriceApplySchema.parse(req.body);
  sendData(res, await pricing.applyBulkPrice(input, requestContext(req)));
}

export async function listMappings(req: Request, res: Response) {
  const query = mappingListQuery.parse(req.query);
  const result = await mapping.listMappings(query);
  if (query.format) {
    return sendExport(res, {
      filename: "website-mapping",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Product code", value: (r) => r.productCode },
        { header: "Product", value: (r) => r.productName, width: 36 },
        { header: "Variant", value: (r) => r.variantName, width: 20 },
        { header: "SKU", value: (r) => r.sku, width: 18 },
        { header: "Website product ID", value: (r) => r.websiteProductId ?? "", width: 38 },
        { header: "Website variant ID", value: (r) => r.websiteVariantId ?? "", width: 38 },
        { header: "State", value: (r) => MAPPING_STATE_LABELS[r.state] },
      ],
    });
  }
  sendData(res, result);
}

export async function setMapping(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  const input = setMappingSchema.parse(req.body);
  sendData(res, await mapping.setMapping(id, input, requestContext(req)));
}
