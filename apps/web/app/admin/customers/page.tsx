"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowUpDown } from "lucide-react"
import {
  AdminCustomerService,
  type AdminCustomer,
  type CustomerSegment,
  type CustomerSort,
} from "../../../lib/services/admin-customer.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"

const SEGMENTS: { value: CustomerSegment; label: string }[] = [
  { value: "all", label: "All Customers" },
  { value: "with-orders", label: "With Orders" },
  { value: "without-orders", label: "Without Orders" },
  { value: "affiliates", label: "Affiliates" },
]

const SORTS: { value: CustomerSort; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "spend", label: "Highest spend" },
  { value: "orders", label: "Most orders" },
]

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const date = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

export default function AdminCustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [segment, setSegment] = useState<CustomerSegment>("all")
  const [sort, setSort] = useState<CustomerSort>("recent")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  // Debounced so a typed query doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await AdminCustomerService.list({
        page,
        limit: 20,
        segment,
        sort,
        ...(search ? { search } : {}),
      })
      setCustomers(res.customers ?? [])
      setTotalPages(res.pagination?.totalPages ?? 1)
      setTotal(res.pagination?.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, segment, sort, search])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Customers"
        subtitle={total ? `${total} total customers` : undefined}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email or phone"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-faint focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={segment}
          onChange={(e) => { setSegment(e.target.value as CustomerSegment); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:border-primary"
        >
          {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as CustomerSort); setPage(1) }}
          className="px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:border-primary"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : customers.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">No customers match this filter.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Total spend</th>
                    <th className="px-4 py-3 text-right">AOV</th>
                    <th className="px-4 py-3">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/admin/customers/${c.id}`)}
                      className="border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text">{c.name}</span>
                          {c.isAffiliate && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-full">
                              Affiliate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{c.email}</td>
                      <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{date(c.registeredAt)}</td>
                      <td className="px-4 py-3 text-right text-text">{c.orders}</td>
                      <td className="px-4 py-3 text-right font-medium text-text whitespace-nowrap">{inr(c.totalSpend)}</td>
                      <td className="px-4 py-3 text-right text-muted whitespace-nowrap">{inr(c.aov)}</td>
                      <td className="px-4 py-3 text-muted">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/admin/customers/${c.id}`)}
                className="w-full text-left bg-surface border border-border rounded-2xl p-4 hover:border-primary transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text truncate">{c.name}</p>
                      {c.isAffiliate && (
                        <span className="text-[9px] font-bold uppercase bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-full shrink-0">
                          Affiliate
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">{c.email}</p>
                    {c.phone && <p className="text-xs text-faint mt-0.5">{c.phone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-text text-sm">{inr(c.totalSpend)}</p>
                    <p className="text-[11px] text-faint">{c.orders} order{c.orders === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border text-[11px] text-faint">
                  <span>Joined {date(c.registeredAt)}</span>
                  <span>AOV {inr(c.aov)}</span>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs sm:text-sm text-muted">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40 text-lg"
                >‹</button>
                <span className="text-sm text-muted font-medium px-2">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40 text-lg"
                >›</button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <ArrowUpDown size={12} />
        Total spend counts only orders with a successful payment.
      </p>
    </div>
  )
}
