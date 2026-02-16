import { api } from "../api-client"
import type { AddressData, UpdateAddressData } from "@repo/zod-schema/index"

export const AddressService = {
  getAll: async () => {
    const res = await api.get("/address")
    return res.data.data
  },

  create: async (data: AddressData) => {
    const res = await api.post("/address", data)
    return res.data.data
  },

  update: async (id: string, data: UpdateAddressData) => {
    const res = await api.put(`/address/${id}`, data)
    return res.data.data
  },

  remove: async (id: string) => {
    const res = await api.delete(`/address/${id}`)
    return res.data.data
  },

  setDefault: async (id: string) => {
    const res = await api.patch(`/address/${id}/default`)
    return res.data.data
  },
}
