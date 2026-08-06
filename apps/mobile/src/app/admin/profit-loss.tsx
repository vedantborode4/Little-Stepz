import { useState } from "react";
import { Dimensions, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { AdminService, PnlData } from "../../features/admin/services/admin.services";
import { qk } from "../../lib/api/query-client";
import { formatPrice } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";

const RANGES: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "6m", label: "6 Months" },
  { value: "year", label: "Year" },
  { value: "all", label: "All Time" },
];

const CHART_W = Dimensions.get("window").width - 64;

function BarChart({
  data,
  color,
}: {
  data: Array<{ label: string; value: number }>;
  color: string;
}) {
  const h = 140;
  const labelH = 20;
  const barAreaH = h - labelH;
  const pts = data ?? [];
  const max = Math.max(...pts.map((p) => p.value), 1);
  const n = Math.max(pts.length, 1);
  const slot = CHART_W / n;
  const barW = Math.max(slot * 0.55, 4);

  return (
    <Svg width={CHART_W} height={h}>
      {pts.map((p, i) => {
        const barH = max > 0 ? (Math.max(p.value, 0) / max) * (barAreaH - 8) : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = barAreaH - barH;
        return (
          <Rect key={`${p.label}-${i}`} x={x} y={y} width={barW} height={barH} rx={3} fill={color} />
        );
      })}
      {pts.map((p, i) => (
        <SvgText
          key={`lbl-${p.label}-${i}`}
          x={i * slot + slot / 2}
          y={h - 6}
          fontSize={10}
          fill={colors.muted}
          textAnchor="middle"
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 basis-[45%] rounded-2xl border border-border bg-surface p-4">
      <Text className="text-[10px] font-jakarta-medium uppercase tracking-wide text-muted">{label}</Text>
      <Text className="mt-1 font-jakarta-bold text-text">{value}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  valueClassName,
  bold,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className={`text-sm ${bold ? "font-jakarta-semibold text-text" : "text-muted"}`}>{label}</Text>
      <Text className={valueClassName ?? (bold ? "font-jakarta-semibold text-text" : "text-sm text-text")}>{value}</Text>
    </View>
  );
}

export default function ProfitLossScreen() {
  const [range, setRange] = useState("30d");
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: qk.adminPnl(range),
    queryFn: () => AdminService.getPnl(range),
  });

  const d: PnlData | undefined = data;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;
  const pct = d ? Math.round(d.costRatio * 100) : 0;
  const positive = (d?.netProfit ?? 0) >= 0;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="pnl" title="Profit & Loss">
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <Text className="text-sm text-muted">
            Estimated P&L based on {pct}% cost ratio
          </Text>

          {/* Range toggle */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {RANGES.map((r) => {
              const on = r.value === range;
              return (
                <Text
                  key={r.value}
                  onPress={() => setRange(r.value)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    on
                      ? "bg-primary font-jakarta-semibold text-white"
                      : "border border-border font-jakarta-medium text-muted"
                  }`}
                >
                  {r.label}
                </Text>
              );
            })}
          </ScrollView>

          {isLoading || !d ? (
            <Text className="py-10 text-center text-muted">Loading…</Text>
          ) : (
            <>
              {/* Hero */}
              <Card className="items-center gap-1 rounded-2xl border border-border p-5">
                <Text className="text-[10px] font-jakarta-medium uppercase tracking-wide text-muted">
                  Net Profit / Loss ({rangeLabel})
                </Text>
                <Text
                  className={`text-3xl font-jakarta-bold ${positive ? "text-success" : "text-danger"}`}
                >
                  {positive ? "+" : "−"}
                  {formatPrice(Math.abs(d.netProfit))}
                </Text>
                <Text className="text-sm text-muted">
                  Margin {(d.margin * 100).toFixed(1)}% · {d.orderCount} orders
                </Text>
              </Card>

              {/* Stat cards */}
              <View className="flex-row flex-wrap gap-3">
                <StatTile label="Total Revenue" value={formatPrice(d.revenue)} />
                <StatTile label="GST Liability" value={formatPrice(d.gst)} />
                <StatTile label="Product Cost" value={formatPrice(d.productCost)} />
                <StatTile label="Gross Profit" value={formatPrice(d.grossProfit)} />
                <StatTile label="Commissions" value={formatPrice(d.commissions)} />
                <StatTile label="Discounts" value={formatPrice(d.discounts)} />
              </View>

              {/* Breakdown */}
              <Card className="rounded-2xl border border-border">
                <Text className="mb-1 font-jakarta-semibold text-text">P&L Breakdown</Text>
                <Row label="Revenue (incl. GST)" value={formatPrice(d.revenue)} />
                <Row
                  label="GST Collected (liability)"
                  value={`−${formatPrice(d.gst)}`}
                  valueClassName="text-sm text-warning"
                />
                <Row label="Taxable Revenue" value={formatPrice(d.taxable)} />
                <Row
                  label={`Product Cost (${d.hasActualCosts ? "actual" : `est. ${pct}%`})`}
                  value={`−${formatPrice(d.productCost)}`}
                  valueClassName="text-sm text-danger"
                />
                <Row
                  label="Gross Profit"
                  value={formatPrice(d.grossProfit)}
                  valueClassName="text-sm text-info"
                />
                <Row
                  label="Shipping Cost (est.)"
                  value={`−${formatPrice(d.shippingCost)}`}
                  valueClassName="text-sm text-danger"
                />
                <Row
                  label="Affiliate Commissions"
                  value={`−${formatPrice(d.commissions)}`}
                  valueClassName="text-sm"
                />
                <Row
                  label="Discounts Given"
                  value={`−${formatPrice(d.discounts)}`}
                  valueClassName="text-sm text-danger"
                />
                <View className="my-2 h-px bg-border" />
                <Row
                  label="Net Profit (est.)"
                  bold
                  value={`${positive ? "+" : "−"}${formatPrice(Math.abs(d.netProfit))}`}
                  valueClassName={`font-jakarta-bold ${positive ? "text-success" : "text-danger"}`}
                />
                <Text className="mt-3 text-xs text-muted">
                  Product cost estimated at {pct}% of taxable value
                  {d.hasActualCosts ? " where no actual cost is set" : ""}. Shipping estimated at ₹
                  {d.shippingPerOrder}/order. Enter actual purchase costs on products for exact P&L.
                </Text>
              </Card>

              {/* Charts */}
              <Card className="gap-2 rounded-2xl border border-border">
                <Text className="font-jakarta-semibold text-text">Monthly Revenue (6 months)</Text>
                <BarChart
                  data={d.monthly.map((m) => ({ label: m.label, value: m.revenue }))}
                  color={colors.info}
                />
              </Card>

              <Card className="gap-2 rounded-2xl border border-border">
                <Text className="font-jakarta-semibold text-text">Monthly Gross Profit</Text>
                <BarChart
                  data={d.monthly.map((m) => ({ label: m.label, value: m.grossProfit }))}
                  color={colors.success}
                />
              </Card>
            </>
          )}
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
