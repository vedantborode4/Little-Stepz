import { Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

export function ReferralLinkCard({ link, code }: { link?: string; code?: string }) {
  const value = link ?? "";

  const copy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    toast.success("Link copied");
  };

  const share = async () => {
    if (!value) return;
    try {
      await Share.share({ message: `Shop at Little Stepz: ${value}` });
    } catch {
      // user cancelled
    }
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="link-outline" size={18} color={colors.primary} />
        <Text className="font-jakarta-semibold text-text">Your referral link</Text>
      </View>
      {code ? <Text className="text-xs text-muted">Code: {code}</Text> : null}
      <View className="rounded-lg border border-border bg-bg px-3 py-2.5">
        <Text numberOfLines={1} className="text-sm text-text">{value || "—"}</Text>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="Copy" variant="outline" onPress={copy} left={<Ionicons name="copy-outline" size={16} color={colors.primary} />} />
        </View>
        <View className="flex-1">
          <Button label="Share" onPress={share} left={<Ionicons name="share-social-outline" size={16} color="#fff" />} />
        </View>
      </View>
    </Card>
  );
}
