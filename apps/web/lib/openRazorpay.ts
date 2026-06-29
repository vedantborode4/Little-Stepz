import { toast } from "sonner"

export interface RazorpayInit {
  keyId: string
  amount: number // rupees
  currency?: string
  razorpayOrderId: string
  name?: string
  description?: string
}

export interface RazorpayResult {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

/**
 * Opens the Razorpay checkout modal and resolves with the payment response,
 * or null if dismissed/failed. Mirrors the checkout store flow.
 */
export function openRazorpay(init: RazorpayInit): Promise<RazorpayResult | null> {
  return new Promise((resolve) => {
    if (typeof (window as any).Razorpay === "undefined") {
      toast.error("Payment gateway not loaded. Please refresh the page.")
      return resolve(null)
    }

    const rzp = new (window as any).Razorpay({
      key: init.keyId,
      amount: init.amount * 100,
      currency: init.currency || "INR",
      order_id: init.razorpayOrderId,
      name: init.name || "Little Stepz",
      description: init.description || "Payment",
      handler: (response: any) =>
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: {
        ondismiss: () => {
          toast.error("Payment cancelled")
          resolve(null)
        },
      },
      theme: { color: "#FF383C" },
    })

    rzp.on("payment.failed", (response: any) => {
      toast.error(response?.error?.description || "Payment failed. Please try again.")
      resolve(null)
    })

    rzp.open()
  })
}
