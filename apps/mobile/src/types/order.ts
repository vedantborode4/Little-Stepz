export interface OrderItem {
  id?: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: string | number;
  product?: {
    id: string;
    name: string;
    slug: string;
    price: string | number;
    images?: { url: string }[];
  };
  variant?: { id: string; name: string; images?: { url: string }[] } | null;
}

export interface OrderAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface Order {
  id: string;
  status: string;
  paymentMethod?: "ONLINE" | "COD";
  subtotal?: string | number;
  discount?: string | number;
  shippingCharges?: string | number;
  total: string | number;
  items: OrderItem[];
  address?: OrderAddress;
  payment?: { status: string; amount?: string | number } | null;
  trackingUrl?: string | null;
  awbCode?: string | null;
  customerNote?: string | null;
  createdAt: string;
  updatedAt?: string;
}
