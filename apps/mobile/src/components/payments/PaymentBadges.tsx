import { View, Text } from "react-native";
import { SvgXml } from "react-native-svg";

import { PAYMENT_BRANDS } from "./paymentLogos";

// Every chip is the same fixed box; each logo scales to fit inside it
// (preserveAspectRatio) so the badges all look uniform regardless of the
// logo's own aspect ratio.
const CHIP_W = 56;
const CHIP_H = 34;
const LOGO_BOX_W = 40;
const LOGO_BOX_H = 22;

/**
 * Row of accepted-payment brand logos (UPI / Visa / Mastercard / RuPay).
 * Each logo sits on a white chip so the colored marks stay legible regardless
 * of the surrounding surface. Purely decorative (a trust signal), so it's
 * marked non-accessible to avoid noisy screen-reader output.
 */
export function PaymentBadges({ label = "We accept" }: { label?: string }) {
  return (
    <View className="items-center gap-2">
      {label ? (
        <Text className="text-[11px] font-jakarta-medium uppercase tracking-wider text-faint">{label}</Text>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-center gap-2">
        {PAYMENT_BRANDS.map((b) => (
          <View
            key={b.key}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="items-center justify-center rounded-md border border-border bg-white"
            style={{ width: CHIP_W, height: CHIP_H }}
          >
            <SvgXml xml={b.xml} width={LOGO_BOX_W} height={LOGO_BOX_H} />
          </View>
        ))}
      </View>
    </View>
  );
}
