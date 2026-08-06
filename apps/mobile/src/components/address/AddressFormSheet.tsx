import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AddressForm } from "./AddressForm";
import { AddressService, type Address } from "../../lib/services/address.service";
import { useAddressStore } from "../../store/address.store";
import { toast } from "../../store/toast.store";
import { getErrorMessage } from "../../lib/utils/errors";
import { colors } from "../../theme/tokens";
import type { AddressData, UpdateAddressData } from "@repo/zod-schema/index";

/**
 * Inline add/edit address modal — mirrors the website's AddressFormDialog so the
 * user can add or edit a delivery address without leaving the checkout flow.
 */
export function AddressFormSheet({
  visible,
  onClose,
  editing,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  /** An existing address to edit, or undefined to add a new one. */
  editing?: Address;
  onSaved?: (address: Address) => void;
}) {
  const insets = useSafeAreaInsets();
  const fetchAddresses = useAddressStore((s) => s.fetchAddresses);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: AddressData) => {
    setSubmitting(true);
    try {
      const saved = editing
        ? await AddressService.update(editing.id, data as UpdateAddressData)
        : await AddressService.create(data);
      toast.success(editing ? "Address updated" : "Address added");
      await fetchAddresses();
      onSaved?.(saved);
      onClose();
    } catch (e: any) {
      toast.error(getErrorMessage(e, editing ? "Could not update address" : "Could not add address"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-jakarta-bold text-text">
            {editing ? "Edit Address" : "Add New Address"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-lg bg-surface-2"
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
        {/* key forces the form to re-init its defaults when switching add/edit target */}
        <AddressForm key={editing?.id ?? "new"} initial={editing} submitting={submitting} onSubmit={onSubmit} />
      </View>
    </Modal>
  );
}
