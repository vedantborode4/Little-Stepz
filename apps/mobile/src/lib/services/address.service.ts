import { api } from "../api/client";
import type { AddressData, UpdateAddressData } from "@repo/zod-schema/index";

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

export const AddressService = {
  getAll: async (): Promise<Address[]> => {
    const res = await api.get("/address");
    return res.data.data;
  },
  create: async (data: AddressData): Promise<Address> => {
    const res = await api.post("/address", data);
    return res.data.data;
  },
  update: async (id: string, data: UpdateAddressData): Promise<Address> => {
    const res = await api.put(`/address/${id}`, data);
    return res.data.data;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/address/${id}`);
    return res.data.data;
  },
  setDefault: async (id: string) => {
    const res = await api.patch(`/address/${id}/default`);
    return res.data.data;
  },
};
