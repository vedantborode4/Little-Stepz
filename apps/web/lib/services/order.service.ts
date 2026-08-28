import { api } from "../api-client"

export const OrderService = {
  getAll: async () => {
    const res = await api.get("/orders")
    return res.data.data
  },

  /**
   * Download the tax invoice PDF.
   *
   * Fetched through the axios client rather than linked directly so the request
   * carries the auth header (and the 401-refresh interceptor); the response is a
   * blob, saved via a temporary object URL.
   */
  downloadInvoice: async (orderId: string) => {
    const res = await api.get(`/orders/${orderId}/invoice`, { responseType: "blob" })
    const disposition = res.headers?.["content-disposition"] as string | undefined
    const match = disposition?.match(/filename="?([^"]+)"?/)
    const filename = match?.[1] ?? `invoice-${orderId.slice(0, 8)}.pdf`

    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked on the next tick so the click has already started the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },

  getById: async (id: string) => {
    const res = await api.get(`/orders/${id}`)
    return res.data.data
  },

  /** POST /orders/:id/return — customer initiates a return request */
  requestReturn: async (id: string, reason: string) => {
    const res = await api.post(`/orders/${id}/return`, { reason })
    return res.data.data
  },

  /** POST /orders/:id/cancel — customer cancels a pending/confirmed order */
  cancelOrder: async (id: string, reason?: string) => {
    const res = await api.post(`/orders/${id}/cancel`, { reason })
    return res.data.data
  },
}
