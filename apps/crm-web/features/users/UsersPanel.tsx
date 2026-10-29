"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { KeyRound, Pencil, Plus, Wand2 } from "lucide-react"
import { useState } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"
import { toast } from "sonner"
import { createUserSchema, resetPasswordSchema, ROLE_LABELS, ROLES, updateUserSchema, type UserDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Display"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatDateTime } from "@/lib/format"
import { useApiForm } from "@/lib/use-api-form"
import { useListState } from "@/lib/use-list-state"
import { useAuthStore } from "@/store/auth.store"
import { generateTemporaryPassword, useCreateUser, useResetPassword, useUpdateUser, useUsers } from "./api"

const ROLE_HINTS = {
  ADMIN: "Everything, including costs, profit, settings and approvals.",
  CASHIER: "POS, payments, customers and cash closing. Cannot see costs or profit.",
  OPS: "Receiving, stock moves, counts and shipping. No financials.",
} as const

function TemporaryPasswordField({
  registration,
  error,
  onGenerate,
}: {
  registration: UseFormRegisterReturn
  error?: string
  onGenerate: () => void
}) {
  return (
    <Field
      label="Temporary password"
      htmlFor="temporaryPassword"
      required
      error={error}
      hint="Share it privately. They must replace it at first sign-in."
    >
      <div className="flex gap-2">
        <Input id="temporaryPassword" autoComplete="off" className="font-mono" {...registration} />
        <Button variant="secondary" icon={<Wand2 size={15} />} onClick={onGenerate} aria-label="Generate password" />
      </div>
    </Field>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const create = useCreateUser()
  const { form, formError, submitWith } = useApiForm(createUserSchema, {
    name: "",
    email: "",
    role: "CASHIER",
    temporaryPassword: generateTemporaryPassword(),
  })
  const { register, formState, watch, setValue } = form

  const onSubmit = submitWith(async (values) => {
    await create.mutateAsync(values)
    toast.success(`${values.name} can now sign in with the temporary password`)
    onClose()
  })

  return (
    <Modal
      title="Add team member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={formState.isSubmitting}>
            Create user
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Full name" htmlFor="name" required error={formState.errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Email (used to sign in)" htmlFor="email" required error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="off" {...register("email")} />
        </Field>
        <Field label="Role" htmlFor="role" required hint={ROLE_HINTS[watch("role") as keyof typeof ROLE_HINTS]}>
          <Select id="role" {...register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <TemporaryPasswordField
          registration={register("temporaryPassword")}
          error={formState.errors.temporaryPassword?.message}
          onGenerate={() => setValue("temporaryPassword", generateTemporaryPassword(), { shouldDirty: true })}
        />
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const update = useUpdateUser()
  const isSelf = useAuthStore((s) => s.user?.id === user.id)
  const { form, formError, submitWith } = useApiForm(updateUserSchema, { name: user.name, role: user.role })
  const { register, formState, watch } = form

  const onSubmit = submitWith(async (values) => {
    await update.mutateAsync({ id: user.id, input: values })
    toast.success("User updated")
    onClose()
  })

  return (
    <Modal
      title={`Edit ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" loading={formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Full name" htmlFor="name" required error={formState.errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field
          label="Role"
          htmlFor="role"
          hint={
            isSelf
              ? "You can't change your own role."
              : `${ROLE_HINTS[(watch("role") ?? user.role) as keyof typeof ROLE_HINTS]} Changing the role signs them out.`
          }
        >
          <Select id="role" disabled={isSelf} {...register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const reset = useResetPassword()
  const { form, formError, submitWith } = useApiForm(resetPasswordSchema, { temporaryPassword: generateTemporaryPassword() })

  const onSubmit = submitWith(async (values) => {
    await reset.mutateAsync({ id: user.id, input: values })
    toast.success(`Password reset. ${user.name} has been signed out everywhere.`)
    onClose()
  })

  return (
    <Modal
      title={`Reset password for ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reset-form" variant="danger" loading={form.formState.isSubmitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <p className="text-sm text-muted">
          This unlocks the account, signs it out on every device and requires a new password at next sign-in.
        </p>
        <TemporaryPasswordField
          registration={form.register("temporaryPassword")}
          error={form.formState.errors.temporaryPassword?.message}
          onGenerate={() => form.setValue("temporaryPassword", generateTemporaryPassword())}
        />
      </form>
    </Modal>
  )
}

export default function UsersPanel() {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const { state, update, params } = useListState({ sort: "name:asc" })
  const { data, isLoading } = useUsers(params)
  const updateUser = useUpdateUser()
  const [modal, setModal] = useState<{ kind: "create" } | { kind: "edit" | "reset" | "toggle"; user: UserDto } | null>(null)

  const toggleActive = async (user: UserDto) => {
    try {
      await updateUser.mutateAsync({ id: user.id, input: { isActive: !user.isActive } })
      toast.success(user.isActive ? `${user.name} deactivated and signed out` : `${user.name} reactivated`)
      setModal(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: ColumnDef<UserDto>[] = [
    {
      id: "name",
      header: "Name",
      meta: { sortKey: "name" },
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.name}
            {row.original.id === currentUserId && <span className="text-xs text-faint"> (you)</span>}
          </p>
          <p className="text-xs text-muted">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      meta: { sortKey: "role" },
      cell: ({ row }) => (
        <Badge tone={row.original.role === "ADMIN" ? "red" : row.original.role === "CASHIER" ? "blue" : "purple"}>
          {ROLE_LABELS[row.original.role]}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const u = row.original
        if (!u.isActive) return <Badge>Inactive</Badge>
        if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return <Badge tone="red">Locked</Badge>
        if (u.mustChangePassword) return <Badge tone="yellow">Awaiting first sign-in</Badge>
        return <Badge tone="green">Active</Badge>
      },
    },
    {
      id: "lastLoginAt",
      header: "Last sign-in",
      meta: { sortKey: "lastLoginAt" },
      cell: ({ row }) => <span className="text-muted">{formatDateTime(row.original.lastLoginAt)}</span>,
    },
    {
      id: "actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        const u = row.original
        const isSelf = u.id === currentUserId
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setModal({ kind: "edit", user: u })}>
              Edit
            </Button>
            {!isSelf && (
              <Button variant="ghost" size="sm" icon={<KeyRound size={14} />} onClick={() => setModal({ kind: "reset", user: u })}>
                Reset
              </Button>
            )}
            {!isSelf && (
              <Button variant="ghost" size="sm" onClick={() => setModal({ kind: "toggle", user: u })}>
                {u.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <ListToolbar
        actions={
          <>
            <ExportMenu onExport={(format) => downloadExport("/users", params, format)} />
            <Button icon={<Plus size={16} />} onClick={() => setModal({ kind: "create" })}>
              Add user
            </Button>
          </>
        }
      >
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Search name or email" />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        getRowId={(u) => u.id}
        emptyTitle="No users match"
        mobileCard={(u) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{u.name}</p>
              <p className="text-xs text-muted truncate">{u.email}</p>
              <div className="mt-1.5">
                <Badge>{ROLE_LABELS[u.role]}</Badge>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setModal({ kind: "edit", user: u })}>
              Edit
            </Button>
          </div>
        )}
      />

      {modal?.kind === "create" && <CreateUserModal onClose={() => setModal(null)} />}
      {modal?.kind === "edit" && <EditUserModal user={modal.user} onClose={() => setModal(null)} />}
      {modal?.kind === "reset" && <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />}
      {modal?.kind === "toggle" && (
        <ConfirmDialog
          title={modal.user.isActive ? `Deactivate ${modal.user.name}?` : `Reactivate ${modal.user.name}?`}
          message={
            modal.user.isActive
              ? "They will be signed out immediately and can't sign in until reactivated. Their history stays in the audit log."
              : "They will be able to sign in again with their existing password."
          }
          confirmLabel={modal.user.isActive ? "Deactivate" : "Reactivate"}
          tone={modal.user.isActive ? "danger" : "primary"}
          loading={updateUser.isPending}
          onConfirm={() => toggleActive(modal.user)}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  )
}
