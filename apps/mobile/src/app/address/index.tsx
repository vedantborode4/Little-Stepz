import { useCallback } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAddressStore } from "../../store/address.store";
import { AddressService } from "../../lib/services/address.service";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function AddressList() {
  const { addresses, loading, fetchAddresses } = useAddressStore();

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses])
  );

  const onDelete = (id: string) => {
    Alert.alert("Delete address", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AddressService.remove(id);
            toast.success("Address deleted");
            fetchAddresses();
          } catch {
            toast.error("Could not delete address");
          }
        },
      },
    ]);
  };

  const onSetDefault = async (id: string) => {
    try {
      await AddressService.setDefault(id);
      fetchAddresses();
    } catch {
      toast.error("Could not set default");
    }
  };

  return (
    <ScreenContainer>
      <Header title="Addresses" />
      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState icon="location-outline" title="No addresses yet" subtitle="Add a delivery address to check out faster." />
          )
        }
        renderItem={({ item }) => (
          <Card className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">{item.name}</Text>
              {item.isDefault ? (
                <View className="rounded-full bg-primary/10 px-2 py-0.5">
                  <Text className="text-xs font-jakarta-medium text-primary">Default</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-sm text-muted">{item.phone}</Text>
            <Text className="text-sm text-text">
              {item.address}, {item.city}, {item.state} - {item.pincode}
            </Text>
            <View className="mt-2 flex-row gap-4">
              <Pressable onPress={() => router.push(`/address/${item.id}`)} className="flex-row items-center gap-1">
                <Ionicons name="create-outline" size={16} color={colors.text} />
                <Text className="text-sm text-text">Edit</Text>
              </Pressable>
              {!item.isDefault ? (
                <Pressable onPress={() => onSetDefault(item.id)} className="flex-row items-center gap-1">
                  <Ionicons name="star-outline" size={16} color={colors.text} />
                  <Text className="text-sm text-text">Set default</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => onDelete(item.id)} className="flex-row items-center gap-1">
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text className="text-sm text-danger">Delete</Text>
              </Pressable>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View className="mt-2">
            <Button label="Add New Address" onPress={() => router.push("/address/new")} left={<Ionicons name="add" size={18} color="#fff" />} />
          </View>
        }
      />
    </ScreenContainer>
  );
}
