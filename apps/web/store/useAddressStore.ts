import { create } from "zustand"

interface AddressState {
  selectedAddressId: string | null
  setSelectedAddress: (id: string) => void
}

export const useAddressStore = create<AddressState>((set) => ({
  selectedAddressId: null,
  setSelectedAddress: (id) => set({ selectedAddressId: id }),
}))
