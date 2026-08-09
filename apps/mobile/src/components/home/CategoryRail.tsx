import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CategoryNode } from "../../lib/services/category.service";
import { colors } from "../../theme/tokens";

export function CategoryRail({ categories }: { categories: CategoryNode[] }) {
  if (!categories.length) return null;
  return (
    <FlatList
      data={categories}
      keyExtractor={(c) => c.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/category/${item.slug}`)}
          className="items-center"
          style={{ width: 72 }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-surface" >
            <Ionicons name="pricetag-outline" size={24} color={colors.primary} />
          </View>
          <Text numberOfLines={1} className="mt-1 text-xs font-jakarta-medium text-text">
            {item.name}
          </Text>
        </Pressable>
      )}
    />
  );
}
