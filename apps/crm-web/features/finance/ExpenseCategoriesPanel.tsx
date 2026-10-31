"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { ExpenseCategoryDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ListToolbar } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { useExpenseCategories, useSaveExpenseCategory } from "./api"
import { ExpenseTabs } from "./ExpensesList"

function CategoryModal({ category, onClose }: { category: ExpenseCategoryDto | null; onClose: () => void }) {
  const save = useSaveExpenseCategory()
  const [name, setName] = useState(category?.name ?? "")
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title={category ? `Rename ${category.name}` : "New expense category"}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={async () => {
              setError(null)
              try {
                await save.mutateAsync({ id: category?.id, input: { name: name.trim() } })
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <Field label="Name" htmlFor="ec-name" required>
          <Input id="ec-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

export default function ExpenseCategoriesPanel() {
  const { data, isLoading } = useExpenseCategories(true)
  const save = useSaveExpenseCategory()
  const [editing, setEditing] = useState<ExpenseCategoryDto | null | undefined>(undefined)

  const toggle = async (c: ExpenseCategoryDto) => {
    try {
      await save.mutateAsync({ id: c.id, input: { isActive: !c.isActive } })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: ColumnDef<ExpenseCategoryDto>[] = [
    { id: "name", header: "Category", meta: { cellClassName: "font-medium" }, cell: ({ row }) => row.original.name },
    { id: "count", header: "Expenses", meta: { align: "right", cellClassName: "tabular" }, cell: ({ row }) => row.original.expenseCount },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge tone={row.original.isActive ? "green" : "gray"}>{row.original.isActive ? "Active" : "Hidden"}</Badge>,
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
            Rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggle(row.original)}>
            {row.original.isActive ? "Hide" : "Show"}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Categories for grouping spending in reports. Hidden ones keep their history." />
      <ExpenseTabs />
      <ListToolbar
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setEditing(null)}>
            Add category
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        total={data?.length ?? 0}
        page={1}
        limit={100}
        loading={isLoading}
        onPageChange={() => {}}
        getRowId={(c) => c.id}
        emptyTitle="No categories"
        mobileCard={(c) => (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{c.name}</p>
            <Badge tone={c.isActive ? "green" : "gray"}>{c.isActive ? "Active" : "Hidden"}</Badge>
          </div>
        )}
      />
      {editing !== undefined && <CategoryModal category={editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
