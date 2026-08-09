import { Badge } from "./Badge";
import { badgeFor, type BadgeColor } from "../../lib/enums";

interface StatusBadgeProps {
  value: string | null | undefined;
  map: Record<string, { label: string; color: BadgeColor }>;
}

export function StatusBadge({ value, map }: StatusBadgeProps) {
  const { label, color } = badgeFor(map, value);
  return <Badge label={label} color={color} />;
}
