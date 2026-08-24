import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CheckoutService, type ServiceabilityResult } from "../../lib/services/checkout.service";
import { colors } from "../../theme/tokens";

/**
 * Pincode serviceability check on the PDP — mirrors the web DeliveryCheck.
 * Tells the user whether we deliver to their pincode.
 */
export function DeliveryCheck() {
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);

  const valid = /^\d{6}$/.test(pincode);

  const check = async () => {
    if (!valid) {
      setError("Enter a valid 6-digit pincode");
      setResult(null);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setResult(await CheckoutService.checkServiceability(pincode));
    } catch {
      setError("Couldn't check right now. Please try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-2 rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="location-outline" size={16} color={colors.primary} />
        <Text className="font-jakarta-semibold text-text">Check delivery</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center rounded-lg border border-border bg-surface px-3">
          <TextInput
            value={pincode}
            onChangeText={(t) => {
              setPincode(t.replace(/[^0-9]/g, "").slice(0, 6));
              setError(null);
              setResult(null);
            }}
            keyboardType="number-pad"
            placeholder="Enter 6-digit pincode"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={check}
            className="flex-1 py-2.5 text-text"
          />
        </View>
        <Pressable
          onPress={check}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2.5"
          style={loading ? { opacity: 0.6 } : undefined}
        >
          <Text className="text-sm font-jakarta-semibold text-white">{loading ? "Checking…" : "Check"}</Text>
        </Pressable>
      </View>

      {error ? <Text className="text-xs text-danger">{error}</Text> : null}

      {result ? (
        result.serviceable ? (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text className="text-sm font-jakarta-medium text-success">Delivery available to {pincode}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="close-circle" size={15} color={colors.danger} />
            <Text className="text-sm text-muted">Sorry, we don&apos;t deliver to {pincode} yet.</Text>
          </View>
        )
      ) : null}
    </View>
  );
}
