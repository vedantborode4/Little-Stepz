import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useThemeColors } from "../../../theme/useThemeColors";
import type { ThemeColors } from "../../../theme/tokens";

/**
 * WYSIWYG editor for product HTML, mirroring the web admin's Tiptap editor
 * (apps/web/components/admin/RichTextEditor.tsx) — same seven controls, same
 * output tags, so both panels write markup that RichTextView already renders.
 *
 * Tiptap is DOM-only, so the editing surface is a contenteditable document in a
 * WebView (react-native-webview is already a dependency and is Expo Go safe).
 * The toolbar stays native: it posts commands in and receives active-state back.
 */

interface EditorState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  block: string;
  ul: boolean;
  ol: boolean;
}

const EMPTY_STATE: EditorState = {
  bold: false,
  italic: false,
  strike: false,
  block: "p",
  ul: false,
  ol: false,
};

/** Embeds arbitrary HTML in a <script> string literal without escaping risk. */
const toJsString = (html: string) => JSON.stringify(html ?? "").replace(/</g, "\\u003c");

function buildDocument(initialHtml: string, c: ThemeColors, placeholder: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${c.surface}; }
  #editor {
    min-height: 100vh;
    padding: 12px 14px;
    font-family: -apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: ${c.text};
    caret-color: ${c.primary};
    outline: none;
    word-wrap: break-word;
  }
  #editor:empty::before { content: attr(data-placeholder); color: ${c.muted}; }
  #editor h2 { font-size: 18px; font-weight: 700; margin: 10px 0 6px; }
  #editor h3 { font-size: 16px; font-weight: 600; margin: 8px 0 5px; }
  #editor p { margin: 6px 0; }
  #editor ul, #editor ol { margin: 6px 0; padding-left: 22px; }
  #editor li { margin: 2px 0; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder}"></div>
<script>
(function () {
  var editor = document.getElementById('editor');
  editor.innerHTML = ${toJsString(initialHtml)};

  // Match Tiptap's output: paragraphs (not divs) and semantic tags (not inline CSS).
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}

  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  // execCommand emits b/i/strike; the storefront renderer and the web editor
  // both expect strong/em/s, so normalise on the way out.
  function normalise(html) {
    return html
      .replace(/<(\\/?)b>/gi, '<$1strong>')
      .replace(/<(\\/?)i>/gi, '<$1em>')
      .replace(/<(\\/?)(strike|del)>/gi, '<$1s>')
      .replace(/<(\\/?)div>/gi, '<$1p>')
      .replace(/<p><br\\s*\\/?><\\/p>/gi, '<p></p>')
      .trim();
  }

  function emitChange() {
    post({ type: 'change', html: editor.innerHTML === '<br>' ? '' : normalise(editor.innerHTML) });
  }

  function emitState() {
    var block = '';
    try { block = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
    post({
      type: 'state',
      value: {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strike: document.queryCommandState('strikeThrough'),
        block: block,
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList')
      }
    });
  }

  // Called from React Native via injectJavaScript.
  window.__cmd = function (name, arg) {
    editor.focus();
    if (name === 'formatBlock') {
      var current = '';
      try { current = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
      // Second tap on an active heading returns the block to a paragraph.
      document.execCommand('formatBlock', false, current === arg ? 'p' : arg);
    } else {
      document.execCommand(name, false, arg || null);
    }
    emitChange();
    emitState();
  };

  window.__setContent = function (html) {
    editor.innerHTML = html;
    emitState();
  };

  editor.addEventListener('input', emitChange);
  document.addEventListener('selectionchange', function () {
    if (document.activeElement === editor) emitState();
  });

  emitState();
})();
</script>
</body>
</html>`;
}

function ToolbarButton({
  icon,
  active,
  tint,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  active: boolean;
  tint: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      className={`h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-primary/10" : ""}`}
    >
      <MaterialCommunityIcons name={icon} size={17} color={active ? tint.primary : tint.muted} />
    </Pressable>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  height?: number;
}

export function RichTextEditor({ value, onChange, placeholder = "Write the product description…", height = 260 }: Props) {
  const colors = useThemeColors();
  const webRef = useRef<WebView>(null);
  const [state, setState] = useState<EditorState>(EMPTY_STATE);
  const [focused, setFocused] = useState(false);

  // Tracks what the editor last sent us, so an incoming `value` that merely
  // echoes our own change never re-injects content (which would drop the caret).
  const lastEmitted = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Rebuilt only when the theme flips; the ref keeps the seeded content current.
  const source = useMemo(
    () => ({ html: buildDocument(valueRef.current, colors, placeholder) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, placeholder]
  );

  // Only fires for genuinely external changes (e.g. the product finishing load),
  // never for the round-trip of our own edits.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    webRef.current?.injectJavaScript(`window.__setContent(${toJsString(value)}); true;`);
  }, [value]);

  const exec = useCallback((name: string, arg?: string) => {
    webRef.current?.injectJavaScript(
      `window.__cmd(${JSON.stringify(name)}, ${arg ? JSON.stringify(arg) : "null"}); true;`
    );
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "change") {
          lastEmitted.current = msg.html;
          onChange(msg.html);
        } else if (msg.type === "state") {
          setState(msg.value);
        }
      } catch {
        // ignore malformed bridge messages
      }
    },
    [onChange]
  );

  return (
    <View className="w-full">
      <Text className="mb-1.5 text-sm font-jakarta-medium text-text">Long Description</Text>
      <View className={`overflow-hidden rounded-lg border bg-surface ${focused ? "border-primary" : "border-border"}`}>
        <View className="flex-row flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
          <ToolbarButton icon="format-bold" tint={colors} active={state.bold} onPress={() => exec("bold")} />
          <ToolbarButton icon="format-italic" tint={colors} active={state.italic} onPress={() => exec("italic")} />
          <ToolbarButton icon="format-strikethrough-variant" tint={colors} active={state.strike} onPress={() => exec("strikeThrough")} />
          <View className="mx-1 h-5 w-px bg-surface-3" />
          <ToolbarButton icon="format-header-2" tint={colors} active={state.block === "h2"} onPress={() => exec("formatBlock", "h2")} />
          <ToolbarButton icon="format-header-3" tint={colors} active={state.block === "h3"} onPress={() => exec("formatBlock", "h3")} />
          <View className="mx-1 h-5 w-px bg-surface-3" />
          <ToolbarButton icon="format-list-bulleted" tint={colors} active={state.ul} onPress={() => exec("insertUnorderedList")} />
          <ToolbarButton icon="format-list-numbered" tint={colors} active={state.ol} onPress={() => exec("insertOrderedList")} />
        </View>

        <View style={{ height }}>
          <WebView
            ref={webRef}
            source={source}
            originWhitelist={["*"]}
            onMessage={onMessage}
            // The editor scrolls internally; without this it fights the form's
            // parent ScrollView on Android.
            nestedScrollEnabled
            hideKeyboardAccessoryView
            keyboardDisplayRequiresUserAction={false}
            automaticallyAdjustContentInsets={false}
            scrollEnabled
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ flex: 1, backgroundColor: colors.surface }}
          />
        </View>
      </View>
    </View>
  );
}
