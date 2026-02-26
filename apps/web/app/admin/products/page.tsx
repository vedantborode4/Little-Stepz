"use client"

import { useEffect } from "react"
import { useAdminProductStore } from "../../../store/adminProduct.store"
import ProductTable from "../../../components/admin/products/ProductTable"

export default function Page() {
  const { fetchProducts } = useAdminProductStore()

  useEffect(() => {
    fetchProducts({ page: 1, limit: 20 })
  }, [])

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Products</h1>

        <a
          href="/admin/products/new"
          className="bg-primary text-white px-5 py-2 rounded-lg"
        >
          + Add Product
        </a>
      </div>

      <ProductTable />

    </div>
  )
}