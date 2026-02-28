"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminOrderService } from "../../../lib/services/admin-order.service"
import OrdersTable from "../../../components/admin/orders/OrdersTable"
import OrdersFilters from "../../../components/admin/orders/OrdersFilters"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await AdminOrderService.getOrders({ ...filters, page, limit: 15 })
      setOrders(res.orders ?? res.data ?? [])
      setTotalPages(res.pages ?? 1)
      setTotal(res.total ?? 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchOrders() }, [filters, page])

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Orders"
        subtitle={total ? `${total} total orders` : undefined}
        action={<OrdersFilters filters={filters} setFilters={handleFilterChange} />}
      />

      {loading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <>
          <OrdersTable data={orders} refresh={fetchOrders} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 text-lg"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${pg === page ? "bg-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {pg}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 text-lg"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
