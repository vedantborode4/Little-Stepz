"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Archive, ArchiveRestore, Copy, History, Layers, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import type { ProductDetailDto, VariantDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, DetailRow, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { errorMessage } from "@/lib/api-error"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useProduct, useUpdateProduct, useUpdateVariant } from "./api"
import ProductGallery from "./ProductGallery"
import { MappingBadge, productMappingState, ProductStatusBadge, ProductThumb } from "./shared"
import { StockCardModal, StockDocumentModal } from "../inventory/StockModals"
import { AddVariantModal, EditVariantModal, PriceHistoryModal, PriceTiersModal } from "./VariantModals"

type VariantModal =
  | { kind: "edit" | "tiers" | "history" | "archive" | "stock"; variant: VariantDto }
  | { kind: "add" }
  | { kind: "archive-product" }
  | { kind: "document"; documentId: string }

const money = (v: string | null) => (v ? formatMoney(v) : <span className="text-faint">—</span>)

function VariantActions({ variant, manage, open }: { variant: VariantDto; manage: boolean; open: (m: VariantModal) => void }) {
  return (
    <div className="flex justify-end gap-1">
      {manage && (
        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => open({ kind: "edit", variant })}>
          Edit
        </Button>
      )}
      {manage && (
        <Button variant="ghost" size="sm" icon={<Layers size={14} />} onClick={() => open({ kind: "tiers", variant })}>
          Tiers
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={<History size={14} />}
        onClick={() => open({ kind: "history", variant })}
        aria-label="Price history"
      />
      {manage && (
        <Button
          variant="ghost"
          size="sm"
          icon={variant.status === "ACTIVE" ? <Archive size={14} /> : <ArchiveRestore size={14} />}
          onClick={() => open({ kind: "archive", variant })}
          aria-label={variant.status === "ACTIVE" ? "Archive variant" : "Restore variant"}
          title={variant.status === "ACTIVE" ? "Archive variant" : "Restore variant"}
        />
      )}
    </div>
  )
}

function ProductView({ product }: { product: ProductDetailDto }) {
  const can = useCan()
  const manage = can("products.manage")
  const [modal, setModal] = useState<VariantModal | null>(null)
  const updateVariant = useUpdateVariant()
  const updateProduct = useUpdateProduct(product.id)
  const close = () => setModal(null)

  const toggleVariant = async (variant: VariantDto) => {
    try {
      await updateVariant.mutateAsync({
        id: variant.id,
        input: { status: variant.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
      })
      toast.success(variant.status === "ACTIVE" ? `${variant.sku} archived` : `${variant.sku} restored`)
      close()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const toggleProduct = async () => {
    const archiving = product.status !== "ARCHIVED"
    try {
      await updateProduct.mutateAsync({
        status: archiving ? "ARCHIVED" : "ACTIVE",
      })
      toast.success(archiving ? `${product.code} archived` : `${product.code} restored`)
      close()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const archived = product.status === "ARCHIVED"

  const columns: ColumnDef<VariantDto>[] = [
    {
      id: "variant",
      header: "Variant",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.imageUrl && <ProductThumb src={row.original.imageUrl} alt={row.original.name} size={32} />}
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-faint font-mono whitespace-nowrap">{row.original.sku}</p>
          </div>
        </div>
      ),
    },
    {
      id: "regular",
      header: "Regular",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => money(row.original.regularPrice),
    },
    {
      id: "offer",
      header: "Offer",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => money(row.original.offerPrice),
    },
    {
      id: "wholesale",
      header: "Wholesale",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => money(row.original.wholesalePrice),
    },
    {
      id: "tiers",
      header: "Qty tiers",
      cell: ({ row }) =>
        row.original.priceTiers.length ? (
          <span className="text-xs text-muted">
            {row.original.priceTiers.map((t) => `${t.minQty}+ @ ${formatMoney(t.price)}`).join(", ")}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      id: "stock",
      header: "Available",
      meta: { align: "right" },
      cell: ({ row }) => (
        <button
          className="tabular font-semibold text-primary hover:underline"
          title={`${row.original.physicalQty} physical — open stock card`}
          onClick={() => setModal({ kind: "stock", variant: row.original })}
        >
          {row.original.availableQty}
          {row.original.physicalQty !== row.original.availableQty && (
            <span className="text-xs text-faint font-normal"> / {row.original.physicalQty}</span>
          )}
        </button>
      ),
    },
    {
      id: "reorder",
      header: "Reorder at",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => row.original.reorderLevel,
    },
    {
      id: "web",
      header: "Website ID",
      meta: { defaultHidden: true },
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.websiteVariantId ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={row.original.status === "ACTIVE" ? "green" : "gray"}>{row.original.status === "ACTIVE" ? "Active" : "Archived"}</Badge>
      ),
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => <VariantActions variant={row.original} manage={manage && !archived} open={setModal} />,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={product.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{product.code}</span>
            <ProductStatusBadge status={product.status} />
          </span>
        }
        action={
          manage && (
            <>
              {!archived && (
                <Link href={`/products/${product.id}/edit`}>
                  <Button variant="secondary" icon={<Pencil size={15} />}>
                    Edit
                  </Button>
                </Link>
              )}
              <Link href={`/products/new?from=${product.id}`}>
                <Button variant="secondary" icon={<Copy size={15} />}>
                  Duplicate
                </Button>
              </Link>
              <Button
                variant={archived ? "secondary" : "ghost"}
                icon={archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                onClick={() => setModal({ kind: "archive-product" })}
              >
                {archived ? "Restore" : "Archive"}
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="2xl:col-span-2 space-y-4 sm:space-y-5">
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-text">
                Variants ({product.variants.length})
                <span className="ml-2 font-normal text-muted">
                  · {product.variants.reduce((n, v) => n + v.availableQty, 0)} available,{" "}
                  {product.variants.reduce((n, v) => n + v.physicalQty, 0)} physical in total
                </span>
              </h2>
              {manage && !archived && product.options.length > 0 && (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setModal({ kind: "add" })}>
                  Add variant
                </Button>
              )}
            </div>
            <DataTable
              columns={columns}
              data={product.variants}
              total={product.variants.length}
              page={1}
              limit={500}
              onPageChange={() => undefined}
              getRowId={(v) => v.id}
              mobileCard={(v) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{v.name}</p>
                      <p className="text-xs text-faint font-mono">{v.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular">{formatMoney(v.offerPrice ?? v.regularPrice)}</p>
                      {v.offerPrice && <p className="text-xs text-faint line-through tabular">{formatMoney(v.regularPrice)}</p>}
                    </div>
                  </div>
                  <VariantActions variant={v} manage={manage && !archived} open={setModal} />
                </div>
              )}
            />
          </section>
          {product.options.length > 0 && (
            <Card title="Options">
              <dl className="space-y-2">
                {product.options.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2">
                    <dt className="text-sm text-muted w-24">{o.name}</dt>
                    {o.values.map((v) => (
                      <Badge key={v.id}>{v.value}</Badge>
                    ))}
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          <ProductGallery product={product} manage={manage && !archived} />
          <Card title="Details">
            <dl>
              <DetailRow label="Category">{product.category.name}</DetailRow>
              <DetailRow label="Brand">{product.brand?.name ?? "—"}</DetailRow>
              <DetailRow label="Scale">{product.scale ?? "—"}</DetailRow>
              <DetailRow label="Main supplier">{product.supplier?.name ?? "—"}</DetailRow>
              <DetailRow label="GST">
                {product.gstRate}%{product.gstFromCategory ? " (category rate)" : ""}
              </DetailRow>
              <DetailRow label="HSN">{product.hsnCode ?? "—"}</DetailRow>
              <DetailRow label="Website">
                <MappingBadge state={productMappingState(product)} />
              </DetailRow>
              <DetailRow label="Updated">{formatDateTime(product.updatedAt)}</DetailRow>
            </dl>
          </Card>
          {(product.description || product.notes) && (
            <Card title="Description & notes">
              {product.description && <p className="text-sm text-text whitespace-pre-line">{product.description}</p>}
              {product.notes && (
                <div className="mt-3 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-200 whitespace-pre-line">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Internal notes</p>
                  {product.notes}
                </div>
              )}
            </Card>
          )}
          {product.options.length === 0 && (
            <p className="text-xs text-faint px-1">
              Simple product — it has one variant. Create a new product to sell it in several colours or styles.
            </p>
          )}
        </div>
      </div>

      {modal?.kind === "edit" && <EditVariantModal variant={modal.variant} onClose={close} />}
      {modal?.kind === "tiers" && <PriceTiersModal variant={modal.variant} onClose={close} />}
      {modal?.kind === "history" && <PriceHistoryModal variant={modal.variant} onClose={close} />}
      {modal?.kind === "stock" && (
        <StockCardModal
          variantId={modal.variant.id}
          onClose={close}
          onOpenDocument={(documentId) => setModal({ kind: "document", documentId })}
        />
      )}
      {modal?.kind === "document" && (
        <StockDocumentModal
          documentId={modal.documentId}
          onClose={close}
          onOpenDocument={(documentId) => setModal({ kind: "document", documentId })}
        />
      )}
      {modal?.kind === "add" && <AddVariantModal product={product} onClose={close} />}
      {modal?.kind === "archive" && (
        <ConfirmDialog
          title={modal.variant.status === "ACTIVE" ? `Archive ${modal.variant.sku}?` : `Restore ${modal.variant.sku}?`}
          message={
            modal.variant.status === "ACTIVE"
              ? "It will no longer be offered for sale or purchase. Its history is kept and it can be restored."
              : "It will be available for sale and purchase again."
          }
          confirmLabel={modal.variant.status === "ACTIVE" ? "Archive" : "Restore"}
          tone={modal.variant.status === "ACTIVE" ? "danger" : "primary"}
          loading={updateVariant.isPending}
          onConfirm={() => toggleVariant(modal.variant)}
          onCancel={close}
        />
      )}
      {modal?.kind === "archive-product" && (
        <ConfirmDialog
          title={archived ? `Restore ${product.code}?` : `Archive ${product.code}?`}
          message={
            archived
              ? "The product returns to the active catalogue."
              : "It disappears from product lists and can't be sold or purchased. Nothing is deleted — you can restore it any time."
          }
          confirmLabel={archived ? "Restore" : "Archive"}
          tone={archived ? "primary" : "danger"}
          loading={updateProduct.isPending}
          onConfirm={toggleProduct}
          onCancel={close}
        />
      )}
    </div>
  )
}

export default function ProductDetail({ id }: { id: string }) {
  const { data, isLoading, isError } = useProduct(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (isError || !data) return <EmptyState title="Product not found" hint="It may have been archived or the link is wrong." />
  return <ProductView product={data} />
}
