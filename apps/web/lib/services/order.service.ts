import { api } from "../api-client"

/** Fetch a PDF and hand it to the browser's downloader. Shared by invoice and receipt. */
async function downloadPdf(path: string, fallbackName: string): Promise<void> {
  const res = await api.get(path, { responseType: "blob" })
  const disposition = res.headers?.["content-disposition"] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? fallbackName

  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick so the click has already started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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
    return downloadPdf(`/orders/${orderId}/invoice`, `invoice-${orderId.slice(0, 8)}.pdf`)
  },

  /**
   * The deposit acknowledgement on a partial-payment order. A different document from
   * the invoice with different rules — available as soon as the deposit is captured,
   * while the tax invoice only exists once the order ships.
   */
  downloadReceipt: async (orderId: string) => {
    return downloadPdf(`/orders/${orderId}/receipt`, `receipt-${orderId.slice(0, 8)}.pdf`)
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
  /**
   * `confirmForfeit` is the record that the customer saw, and accepted, that cancelling a
   * deposit-paid order keeps the deposit. The server refuses without it, so it must only
   * be sent when the UI has actually shown the amount.
   */
  cancelOrder: async (id: string, reason?: string, confirmForfeit?: boolean) => {
    const res = await api.post(`/orders/${id}/cancel`, {
      reason,
      ...(confirmForfeit ? { confirmForfeit: true } : {}),
    })
    return res.data.data
  },
}
