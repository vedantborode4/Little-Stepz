import { Package } from "lucide-react"
import type { MappingState, ProductDetailDto, ProductStatus } from "@repo/crm-schema"
import { MAPPING_STATE_LABELS, PRODUCT_STATUS_LABELS } from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"
import { formatMoney } from "@/lib/format"

const STATUS_TONES: Record<ProductStatus, BadgeTone> = { ACTIVE: "green", DRAFT: "yellow", DISCONTINUED: "gray", ARCHIVED: "gray" }
const MAPPING_TONES: Record<MappingState, BadgeTone> = { MAPPED: "blue", PARTIAL: "yellow", UNMAPPED: "gray" }

export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => (
  <Badge tone={STATUS_TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>
)
export const MappingBadge = ({ state }: { state: MappingState }) => <Badge tone={MAPPING_TONES[state]}>{MAPPING_STATE_LABELS[state]}</Badge>

export function ProductThumb({ src, alt, size = 40 }: { src: string | null; alt: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-xl bg-surface-2 border border-border overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts; next/image would need each one allow-listed
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <Package size={size * 0.45} className="text-faint" />
      )}
    </div>
  )
}

export function PriceRange({ min, max }: { min: string | null; max: string | null }) {
  if (!min) return <span className="text-faint">—</span>
  return <span className="tabular">{min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`}</span>
}

/** Same rule as the API: every id present → mapped, none → unmapped, otherwise partial. Archived variants don't count. */
export function productMappingState(p: ProductDetailDto): MappingState {
  const flags = [!!p.websiteProductId, ...p.variants.filter((v) => v.status === "ACTIVE").map((v) => !!v.websiteVariantId)]
  if (flags.every(Boolean)) return "MAPPED"
  return flags.some(Boolean) ? "PARTIAL" : "UNMAPPED"
}
