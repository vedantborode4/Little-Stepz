import { api } from "../api/client";

export interface CouponValidation {
  valid: boolean;
  discount: number;
  type?: string;
  message?: string;
}

export const CouponService = {
  validate: async (code: string, orderAmount: number): Promise<CouponValidation> => {
    const res = await api.post("/coupons/validate", { code, orderAmount });
    return res.data.data;
  },
};
