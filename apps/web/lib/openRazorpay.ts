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

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js"
let loadPromise: Promise<boolean> | null = null

/**
 * Lazy-load the Razorpay checkout script on demand — only when the user actually
 * initiates a payment (plan W6). It previously loaded on every route from the
 * root layout, putting a third-party script on the critical path of every page
 * (an INP/CWV cost). Deferring it costs the checkout flow nothing: the modal is
 * opened after an explicit click, so a few hundred ms to fetch the script here
 * is imperceptible.
 */
function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  if ((window as any).Razorpay) return Promise.resolve(true)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      if (!ok) loadPromise = null // let a later attempt retry
      resolve(ok)
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SRC}"]`,
    )
    if (existing) {
      if ((window as any).Razorpay) return done(true)
      existing.addEventListener("load", () => done(true))
      existing.addEventListener("error", () => done(false))
      return
    }

    const s = document.createElement("script")
    s.src = RAZORPAY_SRC
    s.async = true
    s.onload = () => done(true)
    s.onerror = () => done(false)
    document.body.appendChild(s)
  })

  return loadPromise
}

/**
 * Opens the Razorpay checkout modal and resolves with the payment response,
 * or null if dismissed/failed. Loads the SDK on first use.
 */
export async function openRazorpay(
  init: RazorpayInit,
): Promise<RazorpayResult | null> {
  const loaded = await loadRazorpay()
  if (!loaded || typeof (window as any).Razorpay === "undefined") {
    toast.error("Payment gateway couldn't load. Please check your connection and try again.")
    return null
  }

  return new Promise((resolve) => {
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
