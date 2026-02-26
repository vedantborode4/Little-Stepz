"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminProductService } from "../../../../lib/services/admin-product.service"
import ProductForm from "../../../../components/admin/products/ProductForm"

export default function AdminEditProductPage() {
  const { id } = useParams()
  const router = useRouter()

  const [product, setProduct] = useState<any>(null)

  useEffect(() => {
    AdminProductService.getProductById(id as string)
      .then(setProduct)
      .catch(() => router.push("/admin/products"))
  }, [])

  if (!product) return <div className="p-10 text-center">Loading…</div>

  return (
    <div className="max-w-6xl space-y-8">
      <h1 className="text-2xl font-bold">Edit Product</h1>
      <ProductForm mode="edit" initialData={product} />
    </div>
  )
}