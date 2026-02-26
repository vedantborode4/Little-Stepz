export default function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DELIVERED: "bg-green-100 text-green-600",
    CANCELLED: "bg-red-100 text-red-600",
    CONFIRMED: "bg-blue-100 text-blue-600",
    PROCESSING: "bg-yellow-100 text-yellow-700",
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[status] || "bg-gray-100"}`}>
      {status}
    </span>
  )
}