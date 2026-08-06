import { useWindowDimensions } from "react-native";
import RenderHtml from "react-native-render-html";
import { colors } from "../../theme/tokens";

// The stored HTML sometimes arrives escaped (e.g. "&lt;p&gt;…"), which makes the
// renderer print the tags literally. Decode the common entities first so the
// markup is parsed. Proper (unescaped) HTML passes through unchanged.
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last, so we don't double-decode
}

/** Renders sanitized product HTML (from the web Tiptap editor) as native views. */
export function RichTextView({ html, inset = 64 }: { html: string; inset?: number }) {
  const { width } = useWindowDimensions();
  return (
    <RenderHtml
      contentWidth={width - inset}
      source={{ html: decodeEntities(html ?? "") }}
      baseStyle={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}
      tagsStyles={{
        h2: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 4 },
        h3: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 6, marginBottom: 3 },
        p: { marginTop: 4, marginBottom: 4 },
        ul: { marginTop: 4, marginBottom: 4 },
        ol: { marginTop: 4, marginBottom: 4 },
        strong: { fontWeight: "700" },
      }}
    />
  );
}
