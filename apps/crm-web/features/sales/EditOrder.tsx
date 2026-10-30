"use client"

import { EmptyState, Skeleton } from "@/components/ui/Display"
import { useOrder } from "./api"
import OrderForm from "./OrderForm"

export default function EditOrder({ id }: { id: string }) {
  const { data, isLoading } = useOrder(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Order not found" />
  if (data.status !== "DRAFT") return <EmptyState title={`${data.code} is no longer a draft`} hint="Confirmed orders can't be edited." />
  return <OrderForm order={data} />
}
