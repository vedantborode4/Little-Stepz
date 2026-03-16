"use client"

import ProductForm from "../../../../components/admin/products/ProductForm"

export default function Page() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Create Product</h1>
      <ProductForm />
    </div>
  )
}
