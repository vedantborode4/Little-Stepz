export default function OrderTimeline({ status }: { status: string }) {
  const steps = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"]

  return (
    <div className="flex justify-between text-xs">
      {steps.map((s) => (
        <div
          key={s}
          className={status === s ? "text-primary font-semibold" : "text-muted"}
        >
          {s}
        </div>
      ))}
    </div>
  )
}
