import type { PriceSource } from "@repo/crm-schema";
import { Decimal } from "../../core/money";

export interface ListPrices {
  regularPrice: Decimal;
  offerPrice: Decimal | null;
  wholesalePrice: Decimal | null;
  /** Quantity breaks: buying >= minQty costs `price` each. */
  tiers: { minQty: number; price: Decimal }[];
  customerPrice: Decimal | null;
}

export interface ResolvedPrice {
  unitPrice: Decimal;
  source: PriceSource;
}

/**
 * The price a line sells at before discounts. A customer's negotiated price
 * wins outright. Quantity tiers and the wholesale price only apply to wholesale
 * sales (a wholesale customer or channel); everyone else gets the offer price
 * if there is one, otherwise the regular price.
 */
export function resolveUnitPrice(prices: ListPrices, quantity: number, wholesale: boolean): ResolvedPrice {
  if (prices.customerPrice) return { unitPrice: prices.customerPrice, source: "CUSTOMER" };
  if (wholesale) {
    const tier = prices.tiers.filter((t) => t.minQty <= quantity).sort((a, b) => b.minQty - a.minQty)[0];
    if (tier) return { unitPrice: tier.price, source: "TIER" };
    if (prices.wholesalePrice) return { unitPrice: prices.wholesalePrice, source: "WHOLESALE" };
  }
  if (prices.offerPrice) return { unitPrice: prices.offerPrice, source: "OFFER" };
  return { unitPrice: prices.regularPrice, source: "REGULAR" };
}
