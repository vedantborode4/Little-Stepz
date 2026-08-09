import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Input } from "../ui/Input";
import { Sheet } from "../ui/Sheet";
import { NotificationService } from "../../lib/services/notification.service";
import { useThemeColors } from "../../theme/useThemeColors";
import type { TargetSearchKind, TargetSearchResult } from "../../types/notification";

export function EntityPicker({
  kind,
  label,
  value,
  onChange,
}: {
  kind: TargetSearchKind;
  label: string;
  value: TargetSearchResult | null;
  onChange: (v: TargetSearchResult | null) => void;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TargetSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await NotificationService.searchTargets(kind, q);
        if (alive) setResults(res);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, kind, open]);

  return (
    <View>
      <Text className="mb-1.5 text-sm font-jakarta-medium text-text">{label}</Text>

      {value ? (
        <View className="flex-row items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <View className="flex-1">
            <Text className="text-sm font-jakarta-medium text-text" numberOfLines={1}>{value.label}</Text>
            {value.sublabel ? <Text className="text-xs text-muted" numberOfLines={1}>{value.sublabel}</Text> : null}
          </View>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setOpen(true); setQ(""); }}
          className="flex-row items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3"
        >
          <Ionicons name="search" size={16} color={colors.muted} />
          <Text className="text-sm text-muted">Search {kind}s…</Text>
        </Pressable>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <Input value={q} onChangeText={setQ} placeholder={`Search ${kind}s…`} autoCapitalize="none" autoFocus />
        <ScrollView style={{ maxHeight: 320 }} className="mt-2" keyboardShouldPersistTaps="handled">
          {loading ? (
            <View className="py-6">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : results.length === 0 ? (
            <Text className="py-6 text-center text-sm text-muted">No matches</Text>
          ) : (
            results.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => { onChange(r); setOpen(false); }}
                className="border-b border-border py-3"
              >
                <Text className="text-sm text-text" numberOfLines={1}>{r.label}</Text>
                {r.sublabel ? <Text className="text-xs text-muted" numberOfLines={1}>{r.sublabel}</Text> : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}
