import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/** Simple bottom sheet built on RN Modal (no native deps — Expo Go safe). */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    // statusBarTranslucent: without it the dim backdrop stops below the Android
    // status bar, leaving an undimmed strip across the top.
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ paddingBottom: insets.bottom + 12 }}
          className="rounded-t-xl bg-surface px-4 pt-3"
        >
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-border" />
          {title ? (
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-jakarta-semibold text-text">{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
