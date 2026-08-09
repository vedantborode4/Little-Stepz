import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { cn } from "../../lib/utils/cn";

interface ScreenContainerProps {
  children: React.ReactNode;
  className?: string;
  edges?: Edge[];
  /** Override the content background (default brand bg). */
  bgClassName?: string;
}

/**
 * Safe-area wrapper used by every screen.
 * The safe-area strips (status bar / nav bar) are white so headers read as fully
 * white; the content area keeps the brand background unless overridden.
 */
export function ScreenContainer({
  children,
  className,
  edges = ["top", "left", "right"],
  bgClassName = "bg-bg",
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-surface">
      <View className={cn("flex-1", bgClassName, className)}>{children}</View>
    </SafeAreaView>
  );
}
