import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { UserService } from "../../lib/services/user.service";
import { useAuthStore } from "../../store/auth.store";
import { setUser as persistUser } from "../../lib/api/token";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const setUserOnly = useAuthStore((s) => s.setUserOnly);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await UserService.updateMe({ name, phone });
      const next = { ...user!, name: updated?.name ?? name, phone: updated?.phone ?? phone };
      setUserOnly(next);
      await persistUser(next);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="My Profile" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Text className="-mt-1 text-xs text-muted">Manage your account information and addresses</Text>

        {/* Avatar card */}
        <View className="overflow-hidden rounded-2xl border border-border bg-surface">
          <View className="h-16 bg-primary/10" />
          <View className="px-5 pb-5">
            <View className="-mt-7 h-14 w-14 items-center justify-center rounded-2xl border-4 border-white bg-primary">
              <Text className="text-lg font-jakarta-bold text-white">{initials}</Text>
            </View>
            <Text className="mt-3 text-lg font-jakarta-bold text-text">{user?.name || "User"}</Text>

            <View className="mt-3 gap-2.5">
              <InfoRow icon="mail-outline" label="Email" value={user?.email || "—"} />
              {user?.phone ? <InfoRow icon="call-outline" label="Phone" value={user.phone} /> : null}
            </View>
          </View>
        </View>

        {/* Edit form */}
        <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
          <Text className="font-jakarta-semibold text-text">Edit details</Text>
          <Input label="Full name" value={name} onChangeText={setName} />
          <Input label="Phone" value={phone ?? ""} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button label="Save Changes" loading={saving} onPress={onSave} />
        </View>

        <Button label="Manage Addresses" variant="outline" onPress={() => router.push("/address")} left={<Ionicons name="location-outline" size={18} color={colors.primary} />} />
        <Button label="Change Password" variant="outline" onPress={() => router.push("/profile/password")} left={<Ionicons name="lock-closed-outline" size={18} color={colors.primary} />} />
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
      <Ionicons name={icon} size={15} color={colors.muted} />
      <View>
        <Text className="text-[10px] font-jakarta-medium uppercase tracking-wide text-muted">{label}</Text>
        <Text className="mt-0.5 text-sm font-jakarta-semibold text-text">{value}</Text>
      </View>
    </View>
  );
}
