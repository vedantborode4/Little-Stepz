"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"
import { OrderService } from "../../../lib/services/order.service"
import Link from "next/link"

type PaymentState = "loading" | "success" | "pending" | "failed"

export default function OrderPaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()

  const [state, setState] = useState<PaymentState>("loading")
  const [order, setOrder] = useState<any | null>(null)
  const [attempts, setAttempts] = useState(0)

  const MAX_POLLS = 8
  const POLL_INTERVAL = 3000

  const checkOrder = async () => {
    try {
      const data = await OrderService.getById(orderId)
      setOrder(data)

      const paymentStatus = data?.payment?.status?.toUpperCase()
      const orderStatus  = data?.status?.toUpperCase()

      if (paymentStatus === "SUCCESS" || orderStatus === "CONFIRMED" || orderStatus === "PROCESSING") {
        setState("success")
        return true
      }

      if (paymentStatus === "FAILED" || orderStatus === "CANCELLED") {
        setState("failed")
        return true
      }

      setState("pending")
      return false
    } catch {
      setState("failed")
      return true
    }
  }

  useEffect(() => {
    if (!orderId) return

    let interval: ReturnType<typeof setInterval>
    let poll = 0

    const run = async () => {
      const done = await checkOrder()
      poll++
      setAttempts(poll)
      if (done || poll >= MAX_POLLS) {
        clearInterval(interval)
        if (!done) setState("pending")
      }
    }

    run()
    interval = setInterval(run, POLL_INTERVAL)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Confirming your payment…</p>
        </div>
      </div>
    )
  }

  if (state === "success") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md w-full shadow-card text-center space-y-5">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="text-sm text-muted mt-1">Your order has been confirmed.</p>
          </div>
          {order && (
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Order ID</span>
                <span className="font-mono font-medium text-gray-800 text-xs">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Amount Paid</span>
                <span className="font-semibold text-gray-900">₹{Number(order.total).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Payment Method</span>
                <span className="text-gray-700 capitalize">{order.paymentMethod?.replace(/_/g, " ") ?? "Online"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className="text-green-600 font-medium capitalize">{order.status?.replace(/_/g, " ").toLowerCase()}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 pt-1">
            <Link href={`/account/orders/${orderId}`}
              className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:opacity-90 transition text-center">
              View Order Details
            </Link>
            <Link href="/products"
              className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (state === "failed") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md w-full shadow-card text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={32} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payment Failed</h1>
            <p className="text-sm text-muted mt-1">
              We couldn't process your payment. Your cart is intact — please try again.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-1">
            <Link href="/checkout"
              className="w-full bg-primary text-white py-3 rounded-xl text-sm font-medium hover:opacity-90 transition text-center">
              Try Again
            </Link>
            <Link href="/account/orders"
              className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-center">
              View Orders
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md w-full shadow-card text-center space-y-5">
        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto">
          <Clock size={32} className="text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payment Processing</h1>
          <p className="text-sm text-muted mt-1">
            Your payment is being verified. This usually takes a few seconds.
          </p>
        </div>
        {attempts >= MAX_POLLS && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-yellow-700">
            Taking longer than expected. Check your orders page for the latest status.
          </div>
        )}
        <div className="flex flex-col gap-3 pt-1">
          <button
            onClick={() => { setState("loading"); setAttempts(0); checkOrder() }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-sm font-medium hover:opacity-90 transition">
            <RefreshCw size={15} /> Check Again
          </button>
          <Link href="/account/orders"
            className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-center">
            View My Orders
          </Link>
        </div>
      </div>
    </div>
  )
}
