export interface CartItemProduct {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  salePrice?: string | number | null;
  isOnSale?: boolean;
  priceDisplay?: "BOTH" | "REGULAR" | "SALE";
  images: { url: string }[];
}

export interface CartItemVariant {
  id: string;
  name: string;
  price?: string | number | null;
  salePrice?: string | number | null;
  isOnSale?: boolean;
  images?: { url: string }[];
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  product: CartItemProduct;
  variant?: CartItemVariant | null;
  subtotal: number;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: number;
  total?: number;
  discount?: number;
}
