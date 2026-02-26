"use client"

import { useEffect, useState } from "react"
import { AdminProductService, AdminProduct } from "../../../lib/services/admin-product.service"
import { useRouter } from "next/navigation"
import { Button, Input } from "@repo/ui/index"

export default function AdminProductsTable() {
  const router = useRouter()

  const [data, setData] = useState<AdminProduct[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  /* ---------------- FETCH ---------------- */

  const fetchProducts = async () => {
    setLoading(true)

    try {
      const res = await AdminProductService.getProducts({
        page,
        limit: 10,
        q: search || undefined,
      })

      setData(res.products)
      setPages(res.pages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [page, search])

  /* ---------------- DELETE ---------------- */

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return

    await AdminProductService.deleteProduct(id)

    setData((prev) => prev.filter((p) => p.id !== id))
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="bg-white border rounded-xl p-6 space-y-6">

      {/* HEADER */}

      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Products</h1>

        <Button
          className="w-auto px-6"
          onClick={() => router.push("/admin/products/new")}
        >
          + Add Product
        </Button>
      </div>

      {/* SEARCH */}

      <Input
        placeholder="Search products..."
        value={search}
        onChange={(e) => {
          setPage(1)
          setSearch(e.target.value)
        }}
      />

      {/* TABLE */}

      {loading ? (
        <p>Loading products...</p>
      ) : !data.length ? (
        <p>No products found.</p>
      ) : (
        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="text-left border-b">
              <tr className="text-muted">
                <th className="py-3">Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Variants</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b">

                  {/* PRODUCT */}

                  <td className="py-3 flex items-center gap-3">

                    <img
                      src={p.images?.[0]?.url || "/placeholder.png"}
                      className="w-12 h-12 object-cover rounded-lg border"
                    />

                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.slug}</p>
                    </div>

                  </td>

                  {/* CATEGORY */}

                  <td>{p.category?.name || "—"}</td>

                  {/* PRICE */}

                  <td>₹{p.price}</td>

                  {/* STOCK */}

                  <td>{p.quantity}</td>

                  {/* VARIANTS COUNT (if any) */}
                  <td>{p.variants?.length || 0}</td>

                  {/* STATUS */}

                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        p.inStock
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {p.inStock ? "In stock" : "Out of stock"}
                    </span>
                  </td>

                  {/* ACTIONS */}

                  <td className="text-right space-x-2">

                    <button
                      onClick={() =>
                        router.push(`/admin/products/${p.id}`)
                      }
                      className="text-primary"
                    >
                      Edit
                    </button>

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
      )}

      {/* PAGINATION */}

      <div className="flex justify-between items-center">

        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>

        <p className="text-sm">
          Page {page} of {pages}
        </p>

        <button
          disabled={page === pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>

      </div>
    </div>
  )
}