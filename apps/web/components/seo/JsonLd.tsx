/**
 * Renders JSON-LD into the initial HTML.
 *
 * Server component by design — structured data must be in the HTML response.
 * Do not add "use client" to this file.
 *
 * Why the wrapper element instead of a plain <script>:
 *
 * React 19 treats <script> as a hoistable resource and lifts it into <head>.
 * Hoisting only works while the document shell is still open, so a <script>
 * rendered from an async route segment (Product schema in products/[slug],
 * CollectionPage in the category route) arrives after the shell has flushed,
 * gets dropped from the HTML, and survives only inside the RSC flight payload.
 * Crawlers that do not execute JavaScript — which is all of the AI crawlers —
 * then see no structured data at all.
 *
 * Emitting the <script> as raw markup inside a hidden wrapper opts out of that
 * hoisting path, so the tag lands in the served HTML exactly where it was
 * rendered. Verified against a production build: without this, product pages
 * ship 2 JSON-LD blocks (the root layout's); with it, 4.
 *
 * The script never needs to execute — `application/ld+json` is data, and
 * consumers parse it out of the markup.
 */
export default function JsonLd({ schema }: { schema: object | object[] }) {
  const payload = Array.isArray(schema) ? schema : [schema]

  const html = payload
    .map((s) => {
      // Schema objects are built server-side from our own data, never from user
      // input. Escaping `<` means a stray value cannot break out of the tag.
      const json = JSON.stringify(s).replace(/</g, "\\u003c")
      return `<script type="application/ld+json">${json}</script>`
    })
    .join("")

  return <div hidden dangerouslySetInnerHTML={{ __html: html }} />
}
