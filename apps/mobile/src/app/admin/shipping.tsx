import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AdminShell } from "../../features/admin/components/AdminShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AdminShippingService } from "../../features/admin/services/admin.services";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

/**
 * Delhivery pickup-warehouse status — the app twin of the website's /admin/shipping.
 *
 * Shipments name the pickup location only, so a name Delhivery doesn't know fails every
 * manifest with "ClientWarehouse matching query does not exist". This checks it and, when
 * it's missing, registers it from the server's DELHIVERY_WAREHOUSE_* settings.
 */
export default function AdminShipping() {
  const [registering, setRegistering] = useState(false);
  const { data: status, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "shipping", "warehouse"],
    queryFn: () => AdminShippingService.getWarehouse(),
  });

  const register = () => {
    Alert.alert("Register warehouse?", "Registers the configured pickup warehouse with Delhivery.", [
      { text: "Back", style: "cancel" },
      {
        text: "Register",
        onPress: async () => {
          setRegistering(true);
          try {
            const res = await AdminShippingService.registerWarehouse();
            toast.success(res.alreadyRegistered ? "This warehouse was already registered." : "Pickup warehouse registered.");
            refetch();
          } catch (e) {
            toast.error(getErrorMessage(e, "Couldn't register the warehouse"));
          } finally {
            setRegistering(false);
          }
        },
      },
    ]);
  };

  // Three different states need three different fixes: bad credentials, a missing
  // warehouse, and all-clear. `registered === null` means "can't be read back", not missing.
  const authFailed = status?.authenticated === false;
  const ok = status?.registered === true;
  const unverifiable = !!status && !authFailed && status.registered === null;

  const tone = ok
    ? { icon: "checkmark-circle" as const, color: colors.success, title: "Pickup warehouse is registered" }
    : authFailed
      ? { icon: "key-outline" as const, color: colors.danger, title: "Delhivery rejected our API token" }
      : unverifiable
        ? { icon: "information-circle-outline" as const, color: colors.info ?? colors.primary, title: "Shipping is configured" }
        : { icon: "warning-outline" as const, color: colors.warning, title: "Pickup warehouse is not registered" };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell
        active="shipping"
        title="Shipping"
        right={
          <Pressable onPress={() => refetch()} disabled={isRefetching} hitSlop={8} accessibilityLabel="Refresh">
            {isRefetching ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={22} color={colors.text} />}
          </Pressable>
        }
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
        ) : isError || !status ? (
          <EmptyState icon="car-outline" title="Couldn't load the warehouse status" actionLabel="Try again" onAction={() => refetch()} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text className="text-sm text-muted">Delhivery pickup warehouse used for every shipment.</Text>
            <Card className="gap-3">
              <View className="flex-row items-start gap-3">
                <Ionicons name={tone.icon} size={22} color={tone.color} />
                <View className="flex-1">
                  <Text className="font-jakarta-semibold text-text">{tone.title}</Text>
                  <Text className="mt-1 text-sm text-muted">{status.message}</Text>
                </View>
              </View>
              <View className="flex-row gap-4 border-t border-border pt-3">
                <View className="flex-1">
                  <Text className="text-xs text-faint">Configured name</Text>
                  <Text className="mt-0.5 text-sm font-jakarta-medium text-text">{status.configuredName ?? "— not set —"}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-faint">Credentials</Text>
                  <Text className="mt-0.5 text-sm font-jakarta-medium text-text">{authFailed ? "Rejected" : "Accepted"}</Text>
                </View>
              </View>
              {!ok ? (
                <View className="gap-3 border-t border-border pt-3">
                  {authFailed ? (
                    <Text className="text-sm text-muted">
                      Fix DELHIVERY_API_TOKEN on the server first. The warehouse can&apos;t be checked or created until the token is valid.
                    </Text>
                  ) : (
                    <>
                      <Text className="text-sm text-muted">
                        {unverifiable
                          ? "If shipping fails with \"ClientWarehouse matching query does not exist\", the pickup name is wrong or unregistered — register it here, or correct DELHIVERY_PICKUP_NAME to match the Delhivery panel exactly."
                          : "Register it using the warehouse address configured on the server. If it already exists in the Delhivery panel under another name, correct DELHIVERY_PICKUP_NAME instead."}
                      </Text>
                      <Button label="Register Warehouse" loading={registering} onPress={register} />
                    </>
                  )}
                </View>
              ) : null}
            </Card>
          </ScrollView>
        )}
      </AdminShell>
    </ScreenContainer>
  );
}
