import { OrderStatus } from "../../../lib/services/admin-order.service"

interface Props {
  status: OrderStatus
  createdAt: string
}

const STEPS = [
  {
    key: "PENDING",
    label: "Order placed",
    statuses: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"],
    dateLabel: (date: string) => `Placed on ${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
  },
  {
    key: "CONFIRMED",
    label: "Order confirmed",
    statuses: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"],
    dateLabel: (date: string) => `Estimate: ${new Date(new Date(date).getTime() + 0).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
  },
  {
    key: "SHIPPED",
    label: "Order Shipped",
    statuses: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"],
    dateLabel: (date: string) => `Estimate: ${new Date(new Date(date).getTime() + 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
  },
  {
    key: "DELIVERED",
    label: "Order Delivered",
    statuses: ["DELIVERED"],
    dateLabel: (date: string) => {
      const d1 = new Date(new Date(date).getTime() + 2 * 86400000)
      const d2 = new Date(new Date(date).getTime() + 3 * 86400000)
      const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      return `Estimate: ${fmt(d1)} – ${fmt(d2)}`
    },
  },
]

export default function AdminOrderTimeline({ status, createdAt }: Props) {
  const activeIndex = STEPS.findIndex(s => s.statuses.includes(status))

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const isActive = i === activeIndex
        const isDone = i < activeIndex
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.key} className="flex gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                  isActive
                    ? "border-primary bg-white"
                    : isDone
                    ? "border-primary bg-primary"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isDone && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 my-1 ${isDone || isActive ? "bg-gray-200" : "bg-gray-200"}`} style={{ minHeight: 32 }} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
              <p className={`text-sm font-semibold ${isActive || isDone ? "text-gray-900" : "text-gray-400"}`}>
                {step.label}
              </p>
              <p className={`text-xs mt-0.5 ${isActive || isDone ? "text-gray-500" : "text-gray-300"}`}>
                {step.dateLabel(createdAt)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
