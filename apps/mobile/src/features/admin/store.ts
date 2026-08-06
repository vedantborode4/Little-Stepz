import { create } from "zustand";
import type { AdminOrder } from "./services/admin.services";

// Admin order detail has no GET-by-id endpoint; seed the selected order from the
// list tap, with a paged-scan fallback in the detail screen.
interface AdminUiState {
  selectedOrder: AdminOrder | null;
  setSelectedOrder: (o: AdminOrder) => void;
}

export const useAdminUi = create<AdminUiState>((set) => ({
  selectedOrder: null,
  setSelectedOrder: (o) => set({ selectedOrder: o }),
}));
