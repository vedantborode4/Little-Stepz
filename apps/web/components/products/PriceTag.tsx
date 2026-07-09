import { DisplayPrices, formatINR } from "../../lib/pricing"

interface Props {
  prices: DisplayPrices
  size?: "sm" | "lg"
  className?: string
}

/**
 * Renders product pricing according to the admin-selected display mode:
 * - REGULAR: regular price only
 * - SALE: sale price only (falls back to regular)
 * - BOTH: sale price + struck-through regular when on sale, otherwise regular only
 */
export default function PriceTag({ prices, size = "sm", className = "" }: Props) {
  const { regular, sale, mode, showDiscount, discountPct } = prices

  const main = size === "lg" ? "font-anton text-3xl font-bold text-text" : "font-anton text-primary font-semibold text-sm sm:text-base"
  const struck = size === "lg" ? "font-anton text-base text-faint line-through" : "font-anton text-xs text-faint line-through"
  const badge = size === "lg" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0.5"

  if (mode === "REGULAR" || (mode === "BOTH" && !showDiscount)) {
    return <span className={`${main} ${className}`}>{formatINR(regular)}</span>
  }

  if (mode === "SALE") {
    return <span className={`${main} ${className}`}>{formatINR(sale ?? regular)}</span>
  }

  // mode === "BOTH" && showDiscount
  return (
    <span className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 ${className}`}>
      <span className={main}>{formatINR(sale!)}</span>
      <span className={struck}>{formatINR(regular)}</span>
      {discountPct != null && (
        <span className={`${badge} rounded-full bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 font-semibold`}>-{discountPct}%</span>
      )}
    </span>
  )
}
