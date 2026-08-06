/**
 * Serialises a value for injection into a WebView `<script>` block.
 *
 * `JSON.stringify` alone is NOT safe here: it does not escape `<`, so a string
 * containing `</script>` (e.g. a user who set that as their account name) closes
 * the script tag early and injects arbitrary JS into a WebView that holds the
 * `ReactNativeWebView` bridge. Emitting each `<` as its unicode escape instead is
 * inert inside a JS string literal and parses back to the identical value.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
