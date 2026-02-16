import { api } from "../api-client"

export const CouponService = {
  validate: async (code: string, orderAmount: number) => {
    const res = await api.post("/coupons/validate", {
      code,
      orderAmount,
    })

    return res.data.data
  },
}
