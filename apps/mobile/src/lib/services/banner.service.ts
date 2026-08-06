import { api } from "../api/client";

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  altText?: string | null;
  position: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const BannerService = {
  /** GET /banners?position=&isActive=true */
  getByPosition: async (position: string): Promise<Banner[]> => {
    try {
      const res = await api.get("/banners", { params: { position, isActive: true } });
      const d = res.data.data;
      return Array.isArray(d) ? d : d?.banners ?? [];
    } catch {
      return [];
    }
  },

  /** GET /banners — all active banners */
  getActive: async (): Promise<Banner[]> => {
    try {
      const res = await api.get("/banners");
      const d = res.data.data;
      return Array.isArray(d) ? d : d?.banners ?? [];
    } catch {
      return [];
    }
  },

  trackClick: async (id: string) => {
    try {
      await api.post(`/banners/${id}/click`);
    } catch {
      // analytics — non-fatal
    }
  },
};
