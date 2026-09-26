import { Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import { colors } from "../theme/tokens";

/**
 * Shown when the previous launch died before finishing startup. The last line of
 * the trace is the step that killed the process — see ../lib/boot-trace.
 *
 * This exists because the iOS crash reports for this abort name no module or
 * method, and the app has no crash-reporting SDK, so the only way to see where
 * startup dies is to have the app tell us on the next launch.
 */
export function BootTraceScreen({
  trace,
  onContinue,
}: {
  trace: string;
  onContinue: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 64 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.danger }}>
          Previous launch failed
        </Text>
        <Text style={{ marginTop: 8, fontSize: 13, color: colors.muted }}>
          The last line below is the startup step that crashed the app.
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Pressable
            onPress={() => Clipboard.setStringAsync(trace)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: colors.danger,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={onContinue}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Continue</Text>
          </Pressable>
        </View>

        <Text
          selectable
          style={{
            marginTop: 20,
            fontSize: 11,
            lineHeight: 16,
            color: colors.text,
            fontFamily: "Courier",
          }}
        >
          {trace}
        </Text>
      </ScrollView>
    </View>
  );
}
