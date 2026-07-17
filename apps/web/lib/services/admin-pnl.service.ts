import { api } from "../api-client"

export type PnlRange = "today" | "7d" | "30d" | "6m" | "year" | "all"

export interface PnlMonthly {
  label: string
  revenue: number
  grossProfit: number
}

export interface PnlData {
  range: PnlRange
  orderCount: number
  revenue: number
  gst: number
  taxable: number
  productCost: number
  grossProfit: number
  shippingCost: number
  commissions: number
  discounts: number
  netProfit: number
  margin: number
  hasActualCosts: boolean
  costRatio: number
  shippingPerOrder: number
  gstRate: number
  monthly: PnlMonthly[]
}

export const AdminPnlService = {
  async getPnl(range: string): Promise<PnlData> {
    const res = await api.get("/admin/pnl", { params: { range } })
    return res.data.data
  },
}
