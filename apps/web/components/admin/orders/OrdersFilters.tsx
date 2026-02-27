export default function OrdersFilters({ filters, setFilters }: any) {
  return (
    <div className="flex gap-3">

      <select
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        className="border border-gray-300 text-gray-500 rounded-lg px-3 py-2"
      >
        <option value="">Status</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <input
        type="date"
        onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        className="border border-gray-300 text-gray-500 rounded-lg px-3 py-2"
      />

      <input
        type="date"
        onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        className="border border-gray-300 text-gray-500 rounded-lg px-3 py-2"
      />
    </div>
  )
}