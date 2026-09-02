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

/**
 * The partial-payment view of an order. Null on a full-payment order, so nothing has to
 * infer the plan from a scatter of nullable fields.
 *
 * Every amount is server-computed. The client renders them and never derives them —
 * the split follows rounding rules the server owns.
 */
export interface OrderPartial {
  depositAmount: number;
  balanceAmount: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  balanceStatus: "DUE" | "PAID" | "WRITTEN_OFF";
  balanceMethod: "ONLINE" | "COD" | "MANUAL" | null;
  /** A COD parcel is committed, so the courier collects the balance at the door. */
  collectedAtDoor: boolean;
  depositForfeited: boolean;
  depositForfeitedAt: string | null;
}

export interface Order {
  id: string;
  status: string;
  /** Stays ONLINE on a partial order — the deposit is a real online capture. */
  paymentMethod?: "ONLINE" | "COD";
  paymentPlan?: "FULL" | "PARTIAL";
  partial?: OrderPartial | null;
  /**
   * Whether a tax invoice exists yet. Not the same as `payment.status === "SUCCESS"`:
   * a partial order's invoice is raised at dispatch so it can travel with the goods,
   * while its balance stays outstanding until delivery.
   */
  invoiceAvailable?: boolean;
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
