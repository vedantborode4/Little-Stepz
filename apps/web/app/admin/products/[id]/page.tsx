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

  if (!product) return <div className="p-10 text-center text-faint">Loading…</div>

  return (
    <div className="space-y-5 sm:space-y-8">
      <h1 className="text-lg sm:text-2xl font-bold text-text">Edit Product</h1>
      <ProductForm mode="edit" initialData={product} />
    </div>
  )
}
