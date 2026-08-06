import { Text, View } from "react-native";
import { cn } from "../../lib/utils/cn";
import { formatPrice } from "../../lib/utils/format";
import type { DisplayPrices } from "../../lib/pricing";

interface PriceProps {
  /** Simple single-value rendering (cart, totals, etc.) */
  value?: number | string | null | undefined;
  /** Two-price display computed via getDisplayPrices (storefront cards / detail) */
  prices?: DisplayPrices;
  size?: "sm" | "lg";
  className?: string;
}

export function Price({ value, prices, size = "sm", className }: PriceProps) {
  const mainClass = cn("font-jakarta-bold text-text", className);

  if (!prices) {
    return <Text className={mainClass}>{formatPrice(value)}</Text>;
  }

  const { regular, sale, mode, showDiscount, discountPct } = prices;
  const struckSize = size === "lg" ? "text-base" : "text-xs";

  if (mode === "REGULAR" || (mode === "BOTH" && !showDiscount)) {
    return <Text className={mainClass}>{formatPrice(regular)}</Text>;
  }

  if (mode === "SALE") {
    return <Text className={mainClass}>{formatPrice(sale ?? regular)}</Text>;
  }

  // mode === "BOTH" && showDiscount
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
      <Text className={mainClass}>{formatPrice(sale!)}</Text>
      <Text
        className={cn("font-jakarta-medium text-faint", struckSize)}
        style={{ textDecorationLine: "line-through" }}
      >
        {formatPrice(regular)}
      </Text>
      {discountPct != null ? (
        <View className="rounded-full bg-success/10 px-1.5 py-0.5">
          <Text className="text-[10px] font-jakarta-bold text-success">-{discountPct}%</Text>
        </View>
      ) : null}
    </View>
  );
}
