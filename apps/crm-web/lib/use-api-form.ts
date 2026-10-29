"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm, type DefaultValues, type FieldValues, type Path, type Resolver } from "react-hook-form"
import type { z } from "zod"
import { errorMessage, isApiError } from "./api-error"

/**
 * react-hook-form wired to a shared Zod schema, plus server-error handling: field
 * errors from the API land on their inputs, anything else becomes `formError`.
 */
export function useApiForm<S extends z.ZodType<FieldValues, FieldValues>>(schema: S, defaultValues: DefaultValues<z.input<S>>) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const submitWith = (action: (values: z.output<S>) => Promise<unknown>) =>
    form.handleSubmit(async (values) => {
      setFormError(null)
      try {
        await action(values)
      } catch (err) {
        const fieldErrors = isApiError(err) ? Object.entries(err.fieldErrors) : []
        const current = form.getValues() as Record<string, unknown>
        let unplaced = fieldErrors.length === 0
        for (const [field, messages] of fieldErrors) {
          if (!messages?.[0]) continue
          // Errors for fields this form doesn't render (e.g. a SKU inside a list) would be invisible.
          if (field.split(".")[0]! in current) form.setError(field as Path<z.input<S>>, { message: messages[0] })
          else unplaced = true
        }
        if (unplaced) setFormError(errorMessage(err))
      }
    })

  return { form, formError, submitWith }
}
