"use client"

import ProductForm from "../../../../components/admin/products/ProductForm"

export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create Product</h1>
      <ProductForm />
    </div>
  )
}