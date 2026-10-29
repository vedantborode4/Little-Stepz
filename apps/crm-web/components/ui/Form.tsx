import clsx from "clsx"
import { forwardRef } from "react"

/** Shared input look, taken from the admin panel's StyledInput. */
export const controlClass =
  "w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-surface text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-red-400"

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-muted">
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(controlClass, className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={clsx(controlClass, "pr-8", className)} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={clsx(controlClass, "min-h-20", className)} {...rest} />
})

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  return (
    <label htmlFor={id} className={clsx("flex items-start gap-3 cursor-pointer select-none", className)}>
      <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-[var(--color-primary)]" {...rest} />
      <span>
        <span className="block text-sm font-medium text-text">{label}</span>
        {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
      </span>
    </label>
  )
})

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </div>
  )
}
