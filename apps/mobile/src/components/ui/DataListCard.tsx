import { Text, View } from "react-native";
import { Card } from "./Card";
import { StatusBadge } from "./StatusBadge";
import type { BadgeColor } from "../../lib/enums";

export interface DataRow {
  label: string;
  value: string;
}

interface DataListCardProps {
  title: string;
  rows: DataRow[];
  amount?: string;
  status?: { value: string | null | undefined; map: Record<string, { label: string; color: BadgeColor }> };
}

/** Generic card that replaces table rows on mobile. */
export function DataListCard({ title, rows, amount, status }: DataListCardProps) {
  return (
    <Card className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-jakarta-semibold text-text">{title}</Text>
        {status ? <StatusBadge value={status.value} map={status.map} /> : null}
      </View>
      {rows.map((r) => (
        <View key={r.label} className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">{r.label}</Text>
          <Text className="text-sm text-text">{r.value}</Text>
        </View>
      ))}
      {amount ? (
        <View className="mt-1 flex-row justify-end">
          <Text className="font-jakarta-bold text-text">{amount}</Text>
        </View>
      ) : null}
    </Card>
  );
}
