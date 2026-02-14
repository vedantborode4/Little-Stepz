export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-[52px] px-4 rounded-xl border border-border
      focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  )
}
