import { api } from "../api-client"

export interface WarehouseStatus {
  configuredName: string | null
  registered: boolean
  /** False when Delhivery rejected the API token — the warehouse can't be checked at all. */
  authenticated?: boolean
  warehouse: unknown | null
  message: string
}

export interface WarehouseRegisterResult {
  created: boolean
  alreadyRegistered: boolean
  warehouse: unknown
}

export const AdminShippingService = {
  async getWarehouse(): Promise<WarehouseStatus> {
    const res = await api.get<{ data: WarehouseStatus }>("/admin/shipping/warehouse")
    return res.data.data
  },

  async registerWarehouse(): Promise<WarehouseRegisterResult> {
    const res = await api.post<{ data: WarehouseRegisterResult }>("/admin/shipping/warehouse")
    return res.data.data
  },
}
