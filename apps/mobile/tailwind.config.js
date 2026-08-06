/** @type {import('tailwindcss').Config} */
// Colours resolve to the CSS variables in src/global.css (:root + the
// prefers-color-scheme:dark media query), so every utility — including opacity
// modifiers like bg-primary/10 — flips with the active colour scheme.
// darkMode "media" matches that: the scheme (which colorScheme.set() controls)
// drives dark, not an unmatchable `.dark` class. Never hardcode hex in components.
const withOpacity = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: withOpacity("--color-primary"),
        secondary: withOpacity("--color-secondary"),

        bg: withOpacity("--color-bg"),
        surface: withOpacity("--color-surface"),
        "surface-2": withOpacity("--color-surface-2"),
        "surface-3": withOpacity("--color-surface-3"),

        text: withOpacity("--color-text"),
        muted: withOpacity("--color-muted"),
        faint: withOpacity("--color-faint"),
        border: withOpacity("--color-border"),

        // Status palette (order/payment/affiliate badges)
        success: withOpacity("--color-success"),
        warning: withOpacity("--color-warning"),
        danger: withOpacity("--color-danger"),
        info: withOpacity("--color-info"),
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      fontFamily: {
        jakarta: ["Jakarta", "sans-serif"],
        "jakarta-medium": ["Jakarta-Medium", "sans-serif"],
        "jakarta-semibold": ["Jakarta-SemiBold", "sans-serif"],
        "jakarta-bold": ["Jakarta-Bold", "sans-serif"],
        // Hero headings → Anton · Buttons → Sora SemiBold
        anton: ["Anton", "sans-serif"],
        sora: ["Sora-SemiBold", "sans-serif"],
      },
    },
  },
  plugins: [],
};
