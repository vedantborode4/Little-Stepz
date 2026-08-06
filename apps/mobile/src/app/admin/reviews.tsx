import { Alert, FlatList, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Rating } from "../../components/ui/Rating";
import { EmptyState } from "../../components/ui/EmptyState";
import { AdminReviewService } from "../../features/admin/services/admin.services";
import { formatDate } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function AdminReviews() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => AdminReviewService.getAll({ limit: 50 }),
  });

  const remove = (id: string) => {
    Alert.alert("Delete review", "Remove this review?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminReviewService.delete(id);
            toast.success("Review deleted");
            qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
          } catch {
            toast.error("Could not delete review");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="reviews" title="Reviews">
        <FlatList
          data={data?.reviews ?? []}
          keyExtractor={(r) => r.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={isLoading ? null : <EmptyState icon="star-outline" title="No reviews" />}
          renderItem={({ item }) => (
            <Card className="gap-1">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-jakarta-medium text-text">{item.product?.name ?? "Product"}</Text>
                  <Text className="text-xs text-muted">{item.user?.name ?? "Customer"} · {formatDate(item.createdAt)}</Text>
                </View>
                <Ionicons name="trash-outline" size={20} color={colors.danger} onPress={() => remove(item.id)} />
              </View>
              <Rating value={item.rating} />
              {item.comment ? <Text className="text-sm text-text">{item.comment}</Text> : null}
            </Card>
          )}
        />
      </AdminShell>
    </ScreenContainer>
  );
}
