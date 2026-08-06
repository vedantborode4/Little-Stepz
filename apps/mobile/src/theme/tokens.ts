import { colorScheme } from "nativewind";

// Design tokens. Keep in sync with src/global.css (:root / dark media query).
//
// Class-based styling (bg-surface, text-muted, …) flips automatically via the
// CSS variables. These raw values exist for places that can't take a class:
// Ionicons `color=`, StatusBar, charts, inline styles.
//
// Prefer useThemeColors() (src/theme/useThemeColors.ts) inside components. The
// `colors` export below resolves against the active scheme at access time, so
// existing `colors.x` call-sites are theme-aware without edits.

export interface ThemeColors {
  primary: string;
  secondary: string;

  bg: string;
  surface: string;
  surface2: string;
  surface3: string;

  text: string;
  muted: string;
  faint: string;
  border: string;

  success: string;
  warning: string;
  danger: string;
  info: string;
}

export const lightColors: ThemeColors = {
  primary: "#FF383C",
  secondary: "#4ECDC4",

  bg: "#FFF7F7",
  surface: "#FFFFFF",
  surface2: "#F5F6F8",
  surface3: "#E9EBEF",

  text: "#1F2937",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "#F1F5F9",

  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
};

export const darkColors: ThemeColors = {
  primary: "#FF4D50",
  secondary: "#4ECDC4",

  bg: "#0B0B0F",
  surface: "#16161C",
  surface2: "#1E1E26",
  surface3: "#2A2A34",

  text: "#F3F4F6",
  muted: "#A1A1AA",
  faint: "#71717A",
  border: "#2C2C36",

  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#F87171",
  info: "#60A5FA",
};

// The scheme NativeWind is actually applying to classes, pushed here by
// useThemeColors(). `colorScheme.get()` is only a boot-time fallback: it reports
// the *device* appearance and ignores an in-app override, so on a dark-mode phone
// set to "Light" it hands back the dark palette while every class renders light —
// which paints `colors.text` icons near-white on a white card (invisible).
let resolvedScheme: "light" | "dark" | null = null;

/** Called by useThemeColors() so the raw palette below tracks the applied scheme. */
export function setResolvedScheme(scheme: "light" | "dark") {
  resolvedScheme = scheme;
}

function activePalette(): ThemeColors {
  const scheme = resolvedScheme ?? colorScheme.get();
  return scheme === "dark" ? darkColors : lightColors;
}

/**
 * Live palette — each property resolves against the *active* scheme at access
 * time, so existing `colors.muted` call-sites become theme-aware with no edits.
 *
 * ⚠️ Capturing at module scope (e.g. `const MAP = { tint: colors.warning }`)
 * freezes the value at import time. Use useThemeColors() inside components, or
 * read `colors.x` lazily during render.
 */
export const colors: ThemeColors = {
  get primary() { return activePalette().primary; },
  get secondary() { return activePalette().secondary; },

  get bg() { return activePalette().bg; },
  get surface() { return activePalette().surface; },
  get surface2() { return activePalette().surface2; },
  get surface3() { return activePalette().surface3; },

  get text() { return activePalette().text; },
  get muted() { return activePalette().muted; },
  get faint() { return activePalette().faint; },
  get border() { return activePalette().border; },

  get success() { return activePalette().success; },
  get warning() { return activePalette().warning; },
  get danger() { return activePalette().danger; },
  get info() { return activePalette().info; },
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;
