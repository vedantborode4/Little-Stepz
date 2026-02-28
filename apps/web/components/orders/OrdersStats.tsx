"use client"

import { AdminOrder } from "../../lib/services/admin-order.service"

type Props = {
  orders: AdminOrder[]
}

export default function OrdersStats({ orders }: Props) {
  const totalOrders = orders.length

  const paidOrders = orders.filter(
    (o) => o.payment?.status === "SUCCESS"
  )

  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + o.total,
    0
  )

  const cancelled = orders.filter(
    (o) => o.status === "CANCELLED"
  ).length

  const refunded = orders.filter(
    (o) => o.status === "REFUNDED"
  ).length

  return (
    <div className="grid md:grid-cols-3 gap-4">

      <StatCard
        title="Total Order"
        value={totalOrders}
      />

      <StatCard
        title="Total Revenue"
        value={`₹${totalRevenue.toFixed(2)}`}
      />

      <div className="bg-white border border-gray-300 rounded-xl p-4 flex flex-col justify-center gap-4">

        <StatusRow
          label="Paid"
          value={paidOrders.length}
          color="bg-green-500"
          percent={getPercent(paidOrders.length, totalOrders)}
        />

        <StatusRow
          label="Cancelled"
          value={cancelled}
          color="bg-red-400"
          percent={getPercent(cancelled, totalOrders)}
        />

        <StatusRow
          label="Refunded"
          value={refunded}
          color="bg-gray-300"
          percent={getPercent(refunded, totalOrders)}
        />

      </div>

    </div>
  )
}


const getPercent = (value: number, total: number) =>
  total ? (value / total) * 100 : 0


function StatCard({
  title,
  value,
}: {
  title: string
  value: string | number
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-xl p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <h2 className="text-2xl font-bold mt-1 text-gray-700">{value}</h2>
    </div>
  )
}

function StatusRow({
  label,
  value,
  color,
  percent,
}: {
  label: string
  value: number
  color: string
  percent: number
}) {
  return (
    <div className="space-y-1 text-sm">

      <div className="flex justify-between">
        <span>{label} ({value})</span>
        <span>{percent.toFixed(0)}%</span>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded">
        <div
          className={`h-2 rounded ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>

    </div>
  )
}