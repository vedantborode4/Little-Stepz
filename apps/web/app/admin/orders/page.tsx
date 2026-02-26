"use client"

import { useEffect, useState } from "react"
import { AdminOrderService } from "../../../lib/services/admin-order.service"
import OrdersTable from "../../../components/admin/orders/OrdersTable"
import OrdersFilters from "../../../components/admin/orders/OrdersFilters"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [filters, setFilters] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    setLoading(true)
    const res = await AdminOrderService.getOrders(filters)
    setOrders(res.orders)
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [filters])

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Orders List</h1>
        <OrdersFilters filters={filters} setFilters={setFilters} />
      </div>

      {loading ? (
        <div className="text-center py-10">Loading…</div>
      ) : (
        <OrdersTable data={orders} refresh={fetchOrders} />
      )}
    </div>
  )
}