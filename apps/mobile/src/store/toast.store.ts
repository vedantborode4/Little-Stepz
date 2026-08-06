import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  show: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
}

const TOAST_DURATION = 2200;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Show one toast at a time — a new toast replaces any currently visible one
    // instead of stacking (client 6.2).
    set({ toasts: [{ id, type, message }] });
    setTimeout(() => get().dismiss(id), TOAST_DURATION);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Convenience API mirroring sonner's `toast.success(...)`.
export const toast = {
  success: (m: string) => useToastStore.getState().show("success", m),
  error: (m: string) => useToastStore.getState().show("error", m),
  info: (m: string) => useToastStore.getState().show("info", m),
};
