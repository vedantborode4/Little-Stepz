export interface ProductImage {
  id?: string;
  url: string;
  alt?: string | null;
  sortOrder?: number;
}

export type PriceDisplay = "BOTH" | "REGULAR" | "SALE";

export interface Variant {
  id: string;
  name: string;
  price?: string | number | null;
  salePrice?: string | number | null;
  isOnSale?: boolean;
  stock?: number;
  inStock?: boolean;
  /** Per-variant pre-order terms; null bookingAmount inherits the product's. */
  preOrderEnabled?: boolean;
  bookingAmount?: string | number | null;
  preOrderLimit?: number | null;
  preOrderCount?: number;
  images?: ProductImage[];
  optionValues?: { optionValueId: string }[];
}

export interface ProductOptionValue {
  id: string;
  value: string;
  swatchHex?: string | null;
  sortOrder?: number;
}

export interface ProductOption {
  id: string;
  name: string;
  sortOrder?: number;
  values: ProductOptionValue[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  longDescription?: string | null;
  price: string | number;
  salePrice?: string | number | null;
  isOnSale?: boolean;
  priceDisplay?: PriceDisplay;
  quantity?: number;
  inStock?: boolean;
  preOrderEnabled?: boolean;
  bookingAmount?: string | number | null;
  preOrderLimit?: number | null;
  preOrderCount?: number;
  preOrderNote?: string | null;
  specifications?: { label: string; value: string }[] | null;
  category?: ProductCategory | null;
  images: ProductImage[];
  variants?: Variant[];
  options?: ProductOption[];
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
}

export interface PaginatedProducts {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
