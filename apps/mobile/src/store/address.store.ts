import { create } from "zustand";
import { AddressService, type Address } from "../lib/services/address.service";

interface AddressState {
  addresses: Address[];
  selectedAddressId: string | null;
  loading: boolean;
  /** Set when the last load failed, so "no addresses" isn't shown for a network error. */
  loadError: boolean;
  hasLoaded: boolean;
  fetchAddresses: () => Promise<void>;
  setSelectedAddress: (id: string) => void;
  reset: () => void;
}

let inFlight: Promise<void> | null = null;

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddressId: null,
  loading: false,
  loadError: false,
  hasLoaded: false,

  fetchAddresses: async () => {
    if (inFlight) return inFlight;

    const run = (async () => {
      set({ loading: true });
      try {
        const data = await AddressService.getAll();
        const addresses = Array.isArray(data) ? data : [];
        // Keep the current selection only if it still exists server-side.
        const { selectedAddressId } = get();
        const stillValid = addresses.some((a) => a.id === selectedAddressId);
        const autoSelect = stillValid
          ? selectedAddressId
          : addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null;
        set({ addresses, selectedAddressId: autoSelect, loadError: false, hasLoaded: true });
      } catch {
        // Previously swallowed — the checkout screen then told the user they had no
        // saved addresses and invited them to re-enter one they already had.
        set({ loadError: true });
      } finally {
        set({ loading: false });
        inFlight = null;
      }
    })();

    inFlight = run;
    return run;
  },

  setSelectedAddress: (id) => set({ selectedAddressId: id }),

  reset: () =>
    set({ addresses: [], selectedAddressId: null, loadError: false, hasLoaded: false }),
}));
