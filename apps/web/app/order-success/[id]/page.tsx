"use client"

import { useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useOrderStore } from "../../../store/useOrderStore"
import { useCartStore } from "../../../store/useCartStore"
import { CheckCircle, Package, MapPin, ArrowRight, ShoppingBag } from "lucide-react"
import Link from "next/link"

/* ── Lightweight confetti — no external dependency ─────────────────────── */
const COLORS = ["#FF383C", "#4ECDC4", "#FFD700", "#A855F7", "#34D399"]

function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return () => {}

  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight

  const pieces = Array.from({ length: 120 }, () => ({
    x:        Math.random() * canvas.width,
    y:        Math.random() * canvas.height * 0.4 - canvas.height * 0.1,
    r:        Math.random() * 7 + 3,
    d:        Math.random() * 2 + 1,
    color:    COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    tilt:     Math.random() * 10 - 5,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    angle:    0,
  }))

  let frame = 0
  let rafId: number

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of pieces) {
      ctx.beginPath()
      ctx.fillStyle = p.color
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, p.tilt, 0, Math.PI * 2)
      ctx.fill()
      p.y     += p.d + frame * 0.01
      p.x     += Math.sin(p.angle) * 1.5
      p.angle += 0.05
      p.tilt  += p.tiltSpeed
    }
    frame++
    if (frame < 200) rafId = requestAnimationFrame(draw)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  rafId = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(rafId)
}

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>()
  const { currentOrder, fetchOrderById, loading } = useOrderStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (id) {
      fetchOrderById(id)
      useCartStore.getState().clearCart()
    }
    const t = setTimeout(() => {
      if (canvasRef.current) launchConfetti(canvasRef.current)
    }, 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const o = currentOrder

  // Backend returns `address` field; alias it here
  const addr = o?.shippingAddress ?? o?.address ?? null

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" />

      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-5">

          {/* Hero card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-card text-center space-y-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order Placed! 🎉</h1>
              <p className="text-sm text-muted mt-1">
                Thank you for shopping with Little Stepz. We'll get this packed right away!
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-muted">Order ID</p>
              <p className="font-mono font-semibold text-gray-800 text-sm mt-0.5">{id}</p>
            </div>
          </div>

          {/* Skeleton */}
          {loading && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          )}

          {o && !loading && (
            <>
              {/* Items */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Package size={15} className="text-primary" />
                  <h2 className="font-semibold text-gray-900 text-sm">
                    {o.items?.length ?? 0} {o.items?.length === 1 ? "Item" : "Items"} Ordered
                  </h2>
                </div>
                <div className="space-y-3">
                  {o.items?.slice(0, 3).map((item: any) => {
                    const itemTotal = Number(item.price ?? 0) * Number(item.quantity ?? 1)
                    return (
                      <div key={item.id ?? item.productId} className="flex items-center gap-3">
                        {item.product?.images?.[0]?.url ? (
                          <img
                            src={item.product.images[0].url}
                            alt={item.product.name}
                            className="w-11 h-11 object-cover rounded-lg border border-gray-100"
                          />
                        ) : (
                          <div className="w-11 h-11 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package size={14} className="text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product?.name ?? "Product"}
                          </p>
                          {item.variant?.name && (
                            <p className="text-xs text-muted">{item.variant.name}</p>
                          )}
                          <p className="text-xs text-muted">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          &#8377;{itemTotal.toLocaleString("en-IN")}
                        </p>
                      </div>
                    )
                  })}
                  {(o.items?.length ?? 0) > 3 && (
                    <p className="text-xs text-muted text-center pt-1">
                      +{o.items.length - 3} more items
                    </p>
                  )}
                </div>
              </div>

              {/* Totals + Delivery */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-card">
                  <p className="text-xs text-muted mb-1">Order Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    &#8377;{Number(o.total).toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted mt-1 capitalize">
                    via {o.paymentMethod?.replace(/_/g, " ") ?? "—"}
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-card">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin size={12} className="text-primary" />
                    <p className="text-xs text-muted">Delivering to</p>
                  </div>
                  {addr ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">
                        {addr.name ?? addr.fullName ?? "—"}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {addr.city}, {addr.state}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">—</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/account/orders/${id}`}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              Track Order <ArrowRight size={15} />
            </Link>
            <Link
              href="/products"
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              <ShoppingBag size={15} /> Continue Shopping
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}
