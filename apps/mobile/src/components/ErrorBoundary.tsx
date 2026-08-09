import React from "react";
import { ScrollView, Text, View } from "react-native";
import { colors } from "../theme/tokens";

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors anywhere below it and shows the message + stack
 * on screen instead of letting the whole app close. Lets us diagnose release
 * crashes that would otherwise just "not open".
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 72 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.danger }}>Something went wrong</Text>
            <Text selectable style={{ marginTop: 12, fontSize: 14, color: colors.text }}>
              {error.message || String(error)}
            </Text>
            <Text selectable style={{ marginTop: 16, fontSize: 11, color: colors.muted }}>
              {error.stack || "no stack"}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
