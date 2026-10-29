"use client"

import { use } from "react"
import RequirePermission from "@/components/shell/RequirePermission"
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { useProduct } from "@/features/products/api"
import { ProductEditForm } from "@/features/products/ProductForms"

function EditProduct({ id }: { id: string }) {
  const { data, isLoading } = useProduct(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Product not found" />
  return (
    <>
      <PageHeader title={`Edit ${data.code}`} subtitle="Variant prices and SKUs are edited on the product page." />
      <ProductEditForm product={data} />
    </>
  )
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <RequirePermission permission="products.manage">
      <EditProduct id={id} />
    </RequirePermission>
  )
}
