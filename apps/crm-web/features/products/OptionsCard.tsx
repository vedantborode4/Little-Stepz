"use client"

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { addOptionSchema, MAX_OPTIONS, renameOptionSchema, renameOptionValueSchema, type ProductDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Badge, Card } from "@/components/ui/Display"
import { Field, FormError, Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { useApiForm } from "@/lib/use-api-form"
import { useAddOption, useRemoveOption, useRemoveOptionValue, useRenameOption, useRenameOptionValue, useReorderOptions } from "./api"
import { isValueInUse } from "./shared"

type Option = ProductDetailDto["options"][number]
type Value = Option["values"][number]

type OptionModal =
  | { kind: "add" }
  | { kind: "rename-option" | "remove-option"; option: Option }
  | { kind: "rename-value" | "remove-value"; option: Option; value: Value }

function FormModal({
  title,
  formId,
  submitting,
  submitLabel = "Save",
  onClose,
  children,
}: {
  title: string
  formId: string
  submitting: boolean
  submitLabel?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/**
 * Adds an option to a saved product. Every existing variant gets `existingValue`,
 * so a simple product's "Default" variant becomes the first colour, model, etc.
 */
export function AddOptionModal({
  product,
  onClose,
  onAdded,
}: {
  product: ProductDetailDto
  onClose: () => void
  onAdded?: (product: ProductDetailDto) => void
}) {
  const add = useAddOption(product.id)
  const simple = product.options.length === 0
  const { form, formError, submitWith } = useApiForm(addOptionSchema, { name: simple ? "Colour" : "", existingValue: "" })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    const updated = await add.mutateAsync(values)
    toast.success(`${values.name} added`)
    if (onAdded) onAdded(updated)
    else onClose()
  })

  const only = product.variants[0]
  return (
    <FormModal
      title={simple ? "Add variants" : "Add option"}
      formId="add-option-form"
      submitting={formState.isSubmitting}
      submitLabel={simple ? "Continue" : "Add option"}
      onClose={onClose}
    >
      <form id="add-option-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field
          label={simple ? "What makes the variants different?" : "Option name"}
          htmlFor="option-name"
          required
          error={formState.errors.name?.message}
          hint="e.g. Colour, Size, Model"
        >
          <Input id="option-name" {...register("name")} />
        </Field>
        <Field
          label={simple ? "What is the current item?" : "Value for existing variants"}
          htmlFor="existing-value"
          required
          error={formState.errors.existingValue?.message}
          hint={
            simple && only
              ? `${only.sku} (${only.name}) becomes this, keeping its stock, prices and history. You add the others next.`
              : "Every variant you already have gets this value, e.g. Red becomes Red / Standard."
          }
        >
          <Input id="existing-value" placeholder={simple ? "e.g. Red" : "e.g. Standard"} {...register("existingValue")} />
        </Field>
      </form>
    </FormModal>
  )
}

function RenameOptionModal({ productId, option, onClose }: { productId: string; option: Option; onClose: () => void }) {
  const rename = useRenameOption(productId)
  const { form, formError, submitWith } = useApiForm(renameOptionSchema, { name: option.name })
  const onSubmit = submitWith(async (input) => {
    await rename.mutateAsync({ optionId: option.id, input })
    toast.success(`Renamed to ${input.name}`)
    onClose()
  })
  return (
    <FormModal title={`Rename ${option.name}`} formId="rename-option-form" submitting={form.formState.isSubmitting} onClose={onClose}>
      <form id="rename-option-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Option name" htmlFor="rename-option" required error={form.formState.errors.name?.message}>
          <Input id="rename-option" {...form.register("name")} />
        </Field>
      </form>
    </FormModal>
  )
}

function RenameValueModal({ productId, option, value, onClose }: { productId: string; option: Option; value: Value; onClose: () => void }) {
  const rename = useRenameOptionValue(productId)
  const { form, formError, submitWith } = useApiForm(renameOptionValueSchema, { value: value.value })
  const onSubmit = submitWith(async (input) => {
    await rename.mutateAsync({ optionId: option.id, valueId: value.id, input })
    toast.success(`Renamed to ${input.value}`)
    onClose()
  })
  return (
    <FormModal title={`Rename ${value.value}`} formId="rename-value-form" submitting={form.formState.isSubmitting} onClose={onClose}>
      <form id="rename-value-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field
          label={option.name}
          htmlFor="rename-value"
          required
          error={form.formState.errors.value?.message}
          hint="Every variant with this value is renamed. SKUs don't change."
        >
          <Input id="rename-value" {...form.register("value")} />
        </Field>
      </form>
    </FormModal>
  )
}

export default function OptionsCard({ product, manage }: { product: ProductDetailDto; manage: boolean }) {
  const [modal, setModal] = useState<OptionModal | null>(null)
  const reorder = useReorderOptions(product.id)
  const removeOption = useRemoveOption(product.id)
  const removeValue = useRemoveOptionValue(product.id)
  const close = () => setModal(null)

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      toast.success(success)
      close()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = product.options.map((o) => o.id)
    ;[ids[index], ids[index + by]] = [ids[index + by]!, ids[index]!]
    void run(() => reorder.mutateAsync(ids), "Options reordered")
  }

  const variantsWith = (valueId: string) => product.variants.filter((v) => v.status === "ACTIVE" && v.optionValueIds.includes(valueId))

  return (
    <Card
      title="Options"
      action={
        manage &&
        product.options.length < MAX_OPTIONS && (
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setModal({ kind: "add" })}>
            Add option
          </Button>
        )
      }
    >
      <dl className="space-y-3">
        {product.options.map((option, i) => (
          <div key={option.id} className="flex flex-wrap items-center gap-2">
            <dt className="text-sm text-muted w-24 shrink-0 truncate" title={option.name}>
              {option.name}
            </dt>
            <dd className="flex flex-1 flex-wrap items-center gap-1.5">
              {option.values
                .filter((v) => isValueInUse(product, v.id))
                .map((value) =>
                  manage ? (
                    <span key={value.id} className="inline-flex items-center rounded-full bg-surface-2 text-xs font-medium">
                      <button
                        className="pl-2.5 pr-1 py-0.5 hover:underline"
                        title={`Rename ${value.value}`}
                        onClick={() => setModal({ kind: "rename-value", option, value })}
                      >
                        {value.value}
                      </button>
                      <button
                        className="pr-2 pl-0.5 py-0.5 text-faint hover:text-red-500"
                        aria-label={`Remove ${value.value}`}
                        title={`Remove ${value.value}`}
                        onClick={() => setModal({ kind: "remove-value", option, value })}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : (
                    <Badge key={value.id}>{value.value}</Badge>
                  ),
                )}
            </dd>
            {manage && (
              <div className="flex gap-0.5 ml-auto">
                {product.options.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowUp size={14} />}
                      disabled={i === 0 || reorder.isPending}
                      onClick={() => move(i, -1)}
                      aria-label={`Move ${option.name} up`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowDown size={14} />}
                      disabled={i === product.options.length - 1 || reorder.isPending}
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${option.name} down`}
                    />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={14} />}
                  onClick={() => setModal({ kind: "rename-option", option })}
                  aria-label={`Rename ${option.name}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => setModal({ kind: "remove-option", option })}
                  aria-label={`Remove ${option.name}`}
                />
              </div>
            )}
          </div>
        ))}
      </dl>
      {manage && <p className="mt-3 text-xs text-faint">Click a value to rename it. SKUs, stock and history never change.</p>}

      {modal?.kind === "add" && <AddOptionModal product={product} onClose={close} />}
      {modal?.kind === "rename-option" && <RenameOptionModal productId={product.id} option={modal.option} onClose={close} />}
      {modal?.kind === "rename-value" && (
        <RenameValueModal productId={product.id} option={modal.option} value={modal.value} onClose={close} />
      )}
      {modal?.kind === "remove-value" && (
        <ConfirmDialog
          title={`Remove ${modal.value.value}?`}
          message={
            <>
              These variants will be archived:{" "}
              <strong>
                {variantsWith(modal.value.id)
                  .map((v) => v.sku)
                  .join(", ")}
              </strong>
              . They keep their history and can be restored. Variants with stock can&apos;t be archived.
            </>
          }
          confirmLabel="Remove"
          loading={removeValue.isPending}
          onConfirm={() =>
            run(() => removeValue.mutateAsync({ optionId: modal.option.id, valueId: modal.value.id }), `${modal.value.value} removed`)
          }
          onCancel={close}
        />
      )}
      {modal?.kind === "remove-option" && (
        <ConfirmDialog
          title={`Remove ${modal.option.name}?`}
          message={
            product.options.length === 1
              ? "The product goes back to a single variant named Default. Only possible while it has one variant."
              : `Variant names drop their ${modal.option.name}. Only possible if no two variants would end up the same.`
          }
          confirmLabel="Remove"
          loading={removeOption.isPending}
          onConfirm={() => run(() => removeOption.mutateAsync(modal.option.id), `${modal.option.name} removed`)}
          onCancel={close}
        />
      )}
    </Card>
  )
}
