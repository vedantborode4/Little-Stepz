import { Dimensions, Text, View } from "react-native";
import Svg, { Circle, Path, Polyline, Line } from "react-native-svg";
import { Card } from "../../../components/ui/Card";
import { ORDER_STATUS } from "../../../lib/enums";
import { formatPrice } from "../../../lib/utils/format";
import { colors } from "../../../theme/tokens";

const W = Dimensions.get("window").width - 64; // card padding

export function RevenueChart({ data }: { data: Array<{ day: string; revenue: number }> }) {
  const h = 120;
  const pts = data ?? [];
  if (pts.length < 2) {
    return (
      <Card>
        <Text className="font-jakarta-semibold text-text">Revenue (30 days)</Text>
        <Text className="mt-6 text-center text-muted">Not enough data</Text>
      </Card>
    );
  }
  const max = Math.max(...pts.map((p) => p.revenue), 1);
  const stepX = W / (pts.length - 1);
  const coords = pts.map((p, i) => `${i * stepX},${h - (p.revenue / max) * (h - 10)}`).join(" ");
  const total = pts.reduce((a, p) => a + p.revenue, 0);

  return (
    <Card>
      <Text className="font-jakarta-semibold text-text">Revenue (30 days)</Text>
      <Text className="mb-2 text-sm text-muted">{formatPrice(total)} total</Text>
      <Svg width={W} height={h}>
        <Line x1="0" y1={h - 1} x2={W} y2={h - 1} stroke={colors.border} strokeWidth="1" />
        <Polyline points={coords} fill="none" stroke={colors.primary} strokeWidth="2" />
      </Svg>
    </Card>
  );
}

const DONUT_COLORS = ["#FF383C", "#4ECDC4", "#2563EB", "#16A34A", "#D97706", "#7E22CE", "#6B7280", "#DC2626"];

export function OrderStatusDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const size = 140;
  const r = 55;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <Card>
        <Text className="font-jakarta-semibold text-text">Orders by status</Text>
        <Text className="mt-6 text-center text-muted">No orders yet</Text>
      </Card>
    );
  }

  let offset = 0;
  return (
    <Card>
      <Text className="mb-2 font-jakarta-semibold text-text">Orders by status</Text>
      <View className="flex-row items-center gap-4">
        <Svg width={size} height={size}>
          {entries.map(([status, v], i) => {
            const frac = v / total;
            const dash = frac * circ;
            const seg = (
              <Circle
                key={status}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${cx}, ${cy}`}
              />
            );
            offset += dash;
            return seg;
          })}
        </Svg>
        <View className="flex-1 gap-1">
          {entries.map(([status, v], i) => (
            <View key={status} className="flex-row items-center gap-2">
              <View style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} className="h-2.5 w-2.5 rounded-full" />
              <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
                {ORDER_STATUS[status]?.label ?? status}
              </Text>
              <Text className="text-xs font-jakarta-medium text-text">{v}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
