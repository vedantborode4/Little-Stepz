import { create } from "zustand";
import { AddressService, type Address } from "../lib/services/address.service";

interface AddressState {
  addresses: Address[];
  selectedAddressId: string | null;
  loading: boolean;
  fetchAddresses: () => Promise<void>;
  setSelectedAddress: (id: string) => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddressId: null,
  loading: false,

  fetchAddresses: async () => {
    set({ loading: true });
    try {
      const data = await AddressService.getAll();
      const addresses = Array.isArray(data) ? data : [];
      const { selectedAddressId } = get();
      let autoSelect = selectedAddressId;
      if (!autoSelect) {
        const def = addresses.find((a) => a.isDefault);
        autoSelect = def?.id ?? addresses[0]?.id ?? null;
      }
      set({ addresses, selectedAddressId: autoSelect });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedAddress: (id) => set({ selectedAddressId: id }),
}));
