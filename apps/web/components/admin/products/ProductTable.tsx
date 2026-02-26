"use client"

import { useAdminProductStore } from "../../../store/adminProduct.store"

export default function ProductTable() {
  const { products, loading, deleteProduct } = useAdminProductStore()

  if (loading) return <p>Loading products...</p>

  return (
    <div className="bg-white border rounded-xl overflow-hidden">

      <table className="w-full text-sm">

        <thead className="bg-red-200 text-left">
          <tr>
            <th className="p-3">Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Variants</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          {products.map((p) => (
            <tr key={p.id} className="border-t">

              <td className="p-3 flex gap-3 items-center">
                <img
                  src={p.images?.[0]?.url}
                  className="w-12 h-12 rounded object-cover"
                />
                {p.name}
              </td>

              <td>{p.category?.name}</td>

              <td>₹{p.price}</td>

              <td>
                {p.inStock ? (
                  <span className="text-green-600">In stock</span>
                ) : (
                  <span className="text-red-500">Out</span>
                )}
              </td>

              <td>{p.variants?.length}</td>

              <td>
                {new Date(p.createdAt).toLocaleDateString()}
              </td>

              <td className="space-x-3">

                <a
                  href={`/admin/products/${p.id}`}
                  className="text-blue-600"
                >
                  Edit
                </a>

                <button
                  onClick={() => deleteProduct(p.id)}
                  className="text-red-500"
                >
                  Delete
                </button>

              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>
  )
}