import { api } from "../api-client"

export const AdminProductImageService = {
  getSignature: async (productId: string) => {
    const res = await api.get(
      "/admin/products/images/upload-signature",
      { params: { productId } }
    )
    return res.data.data
  },

  addImage: async (productId: string, payload: any) => {
    const res = await api.post(`/admin/products/${productId}/images`, payload)
    return res.data.data
  },

  deleteImage: async (imageId: string) => {
    await api.delete(`/admin/products/images/${imageId}`)
  },

  reorderImage: async (imageId: string, sortOrder: number) => {
    const res = await api.put(
      `/admin/products/images/${imageId}/reorder`,
      { sortOrder }
    )
    return res.data.data
  },

  replaceImage: async (imageId: string, payload: any) => {
    const res = await api.put(
      `/admin/products/images/${imageId}/replace`,
      payload
    )
    return res.data.data
  },
}