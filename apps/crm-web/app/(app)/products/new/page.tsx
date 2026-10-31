"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import RequirePermission from "@/components/shell/RequirePermission"
import { PageHeader, Skeleton } from "@/components/ui/Display"
import { useProduct } from "@/features/products/api"
import { ProductCreateForm } from "@/features/products/ProductForms"

/** `?from=<id>` duplicates an existing product into a new draft (fresh SKUs, no website ids). */
function NewProduct() {
  const from = useSearchParams().get("from")
  const source = useProduct(from)
  if (from && source.isLoading) return <Skeleton className="h-96 rounded-2xl" />
  return (
    <>
      <PageHeader
        title={source.data ? `Duplicate ${source.data.code}` : "New product"}
        subtitle="Add the product once; colours, models and styles become variants with their own SKU and stock."
      />
      <ProductCreateForm key={source.data?.id ?? "new"} source={source.data} />
    </>
  )
}

export default function NewProductPage() {
  return (
    <RequirePermission permission="products.manage">
      <Suspense>
        <NewProduct />
      </Suspense>
    </RequirePermission>
  )
}
