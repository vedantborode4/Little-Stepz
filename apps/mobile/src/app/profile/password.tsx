import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { UserService } from "../../lib/services/user.service";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function ChangePassword() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const newErr = newPassword.length > 0 && newPassword.length < 6 ? "At least 6 characters" : undefined;
  const confirmErr = confirm.length > 0 && confirm !== newPassword ? "Passwords do not match" : undefined;
  const matches = confirm.length > 0 && confirm === newPassword && !newErr;
  const canSubmit = !!currentPassword && newPassword.length >= 6 && confirm === newPassword;

  const onSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await UserService.changePassword({ currentPassword, newPassword });
      toast.success("Password changed");
      router.back();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Change Password" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Input label="Current password" secure value={currentPassword} onChangeText={setCurrent} />
        <Input label="New password" secure value={newPassword} onChangeText={setNew} error={newErr} />
        <Input label="Confirm new password" secure value={confirm} onChangeText={setConfirm} error={confirmErr} />
        {confirm.length > 0 && !confirmErr && matches ? (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text className="text-xs text-success">Passwords match</Text>
          </View>
        ) : null}
        <Button label="Update Password" loading={saving} disabled={!canSubmit} onPress={onSave} />
      </ScrollView>
    </ScreenContainer>
  );
}
