import { cn } from "./utils"

export function Button({
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}) {
  return (
    <button
      className={cn(
        "w-full h-[52px] rounded-xl bg-primary text-white font-semibold",
        "transition active:scale-[0.98] disabled:opacity-60",
        className
      )}
      disabled={loading}
      {...props}
    >
      {loading ? "Please wait..." : props.children}
    </button>
  )
}
