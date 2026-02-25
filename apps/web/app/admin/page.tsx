"use client"

import { useEffect, useState } from "react"
import { AdminService } from "../../lib/services/admin.service"

export default function Page() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    AdminService.getStats().then(setStats)
  }, [])

  if (!stats) return <p>Loading dashboard…</p>

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-6">
        <Card title="Total Sales" value={stats.totalSales} />
        <Card title="Total Orders" value={stats.totalOrders} />
        <Card title="Revenue" value={stats.totalRevenue} />
        <Card title="Customers" value={stats.totalCustomers} />
      </div>

    </div>
  )
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white border rounded-xl p-5">
      <p className="text-sm text-muted">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  )
}